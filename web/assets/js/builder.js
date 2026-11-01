// Shipbuilder: Werte aus gewählten Modulen und Upgrades. Reine Funktionen ohne DOM (in Node getestet).
// Rechnet für die Top-Auswahl ohne Upgrades exakt wie tools/wows_gp/export_web.py (ships.json).

const BUILD_TYPES = ["hull", "artillery", "torpedoes", "engine", "fireControl"];
const BW_M = 30;  // BigWorld-Einheit in Metern (Streuungsformel)

// Top-Konfiguration: je Typ das am weitesten erforschte Modul (bei Gleichstand das erste, wie im Export)
function defaultSelection(sb) {
  const sel = {};
  for (const k of BUILD_TYPES) {
    const list = sb.o[k];
    if (!list || !list.length) continue;
    let best = list[0];
    for (const o of list) if (o.d > best.d) best = o;
    sel[k] = best.u;
  }
  return sel;
}

const option = (sb, k, u) => (sb.o[k] || []).find((o) => o.u === u) || null;

// Modul passend zum Rumpf: erstes Modul der Option, das der Rumpf erlaubt, sonst das erste
function pickModule(opt, allowed) {
  if (!opt || !opt.m) return null;
  const names = Object.keys(opt.m);
  const hit = names.find((n) => (allowed || []).includes(n));
  return opt.m[hit || names[0]] || null;
}

// Faktor eines Modifikators über alle gewählten Effekte (Upgrades, Fähigkeiten, Signale);
// Werte können je Schiffsklasse verschieden sein
function factor(mods, key, species) {
  let f = 1;
  for (const m of mods) {
    if (!m || !(key in m)) continue;
    const v = m[key];
    const x = typeof v === "object" && v !== null ? v[species] : v;
    if (typeof x === "number") f *= x;
  }
  return f;
}

const r = (x, n) => (x === null || x === undefined ? null : Math.round(x * 10 ** n) / 10 ** n);

// Flak-Zonen zusammenführen: größte Reichweite, Summe der DPS, höchste Trefferchance
function mergeAura(lists, dpsCoef) {
  const zones = {};
  for (const src of lists) for (const [k, list] of Object.entries(src || {})) for (const [rng, dps, hit] of list) {
    const z = zones[k] || (zones[k] = [0, 0, 0]);
    z[0] = Math.max(z[0], rng); z[1] += dps; z[2] = Math.max(z[2], hit);
  }
  const out = {};
  for (const [k, [rng, dps, hit]] of Object.entries(zones)) out[k] = [r(rng / 1000, 1), Math.round(dps * dpsCoef), hit];
  return Object.keys(out).length ? out : null;
}

function computeBuild(sb, sel, mods, species) {
  const F = (key) => factor(mods || [], key, species);
  const hull = option(sb, "hull", sel.hull);
  const art = pickModule(option(sb, "artillery", sel.artillery), hull && hull.art);
  const tor = pickModule(option(sb, "torpedoes", sel.torpedoes), hull && hull.tor);
  const eng = option(sb, "engine", sel.engine);
  const fc = option(sb, "fireControl", sel.fireControl);
  const p = {
    hp: hull && hull.hp !== null ? Math.round(hull.hp * F("healthHullCoeff")) : null,
    speed: hull && hull.speed !== null ? r(hull.speed * (1 + (eng ? eng.speedCoef : 0)) * F("speedCoef"), 2) : null,
    turn: hull ? hull.turn : null,
    rudder: hull && hull.rudder !== null ? r(hull.rudder * F("SGRudderTime"), 1) : null,
    seen: hull && hull.seen !== null ? r(hull.seen * F("visibilityDistCoeff"), 2) : null,
    air: hull && hull.air !== null ? r(hull.air * F("visibilityDistCoeff"), 2) : null,
    gun: null, torp: null, aa: null,
    sec: hull && hull.sec ? r(hull.sec * F("GSMaxDist"), 1) : null
  };
  if (art) {
    const rangeM = art.rangeM ? art.rangeM * (fc ? fc.distCoef : 1) * F("GMMaxDist") : null;
    let disp = null;
    if (rangeM && art.ir !== null && art.mr !== null && art.idist) disp = Math.round(((rangeM / BW_M) / art.idist * (art.ir - art.mr) + art.mr) * BW_M * F("GMIdealRadius"));
    const rot = art.rot ? art.rot * F("GMRotationSpeed") : null;
    const dmg = F("GMDamageCoeff");
    const shell = (s, extra = 1) => (s ? { ...s, dmg: s.dmg !== null ? Math.round(s.dmg * dmg * extra) : null } : null);
    p.gun = {
      caliber: art.caliber, barrels: art.barrels, mounts: art.mounts,
      reload: art.reload !== null ? r(art.reload * F("GMShotDelay"), 2) : null,
      range: rangeM ? r(rangeM / 1000, 2) : null,
      turn180: rot ? r(180 / rot, 1) : null,
      disp, he: shell(art.he), ap: shell(art.ap, F("GMAPDamageCoeff")), sap: shell(art.sap)
    };
  }
  if (tor) {
    p.torp = {
      ...tor,
      reload: tor.reload !== null ? r(tor.reload * F("GTShotDelay"), 1) : null,
      range: tor.range !== null ? r(tor.range * F("torpedoRangeCoefficient"), 1) : null,
      dmg: tor.dmg !== null ? Math.round(tor.dmg * F("torpedoDamageCoeff")) : null,
      speed: tor.speed !== null ? r(tor.speed * F("torpedoSpeedMultiplier"), 1) : null
    };
  }
  p.aa = mergeAura([hull && hull.aura, art && art.aura], F("AAAuraDamage"));
  return p;
}

// Verbrauchsmaterial: gewählte Variante je Slot mit Ladungen, Ladezeit, Wirkdauer nach Modifikatoren.
// Ladezeit und Dauer: Faktoren (allgemein und je Art), Ladungen: Zuschläge; -1 = unbegrenzt.
function computeConsumables(sb, choice, mods, species) {
  const F = (key) => factor(mods || [], key, species);
  const A = (key) => {
    let sum = 0;
    for (const m of mods || []) {
      const v = m && m[key];
      const x = typeof v === "object" && v !== null ? v[species] : v;
      if (typeof x === "number") sum += x;
    }
    return sum;
  };
  return (sb.c || []).map((opts, slot) => {
    const c = opts[(choice && choice[slot]) || 0] || opts[0];
    const ty = c.type || "";
    return {
      a: c.a, t: c.t, type: ty,
      n: typeof c.n === "number" && c.n > 0 ? c.n + A("additionalConsumables") + A(ty + "AdditionalConsumables") : c.n,
      reload: c.reload !== null ? r(c.reload * F("ConsumableReloadTime") * F(ty + "ReloadCoeff"), 1) : null,
      work: c.work !== null ? r(c.work * F("ConsumablesWorkTime") * F(ty + "WorkTimeCoeff"), 1) : null
    };
  });
}

