// Holt alle Schiffe aus der Wargaming-Enzyklopädie. Die Seite nutzt Daten aus GameParams
// (tools/wows_gp/export_web.py); diese Datei dient als Referenz für den Abgleich und liefert die Icon-Adressen.
// Aufruf (im Ordner web/): node scripts/build-data.mjs [--from <ordner mit roh-json>]
// Ohne --from wird die API abgefragt (WG_APPLICATION_ID, sonst die öffentliche ID der Seite).
import fs from "node:fs";

const APP_ID = process.env.WG_APPLICATION_ID || "445aebe856370e69f1f98f7b7b743e22";
const API = "https://api.worldofwarships.eu/wows/encyclopedia";
const OUT = new URL("../data/api-reference.json", import.meta.url);

async function get(path, params = {}) {
  const u = new URL(`${API}/${path}/`);
  u.searchParams.set("application_id", APP_ID);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(u);
    const j = await res.json().catch(() => null);
    if (j && j.status === "ok") return j;
    // Anfragelimit: kurz warten und erneut versuchen
    if (attempt >= 5) throw new Error(`${path}: ${JSON.stringify(j && j.error)}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

async function fetchShips() {
  const all = {};
  for (let page = 1; ; page++) {
    const j = await get("ships", { page_no: page, limit: 100, language: "en" });
    Object.assign(all, j.data);
    if (page >= j.meta.page_total) break;
  }
  return all;
}

const num = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const range = (r) => (r && num(r.min) !== null && num(r.max) !== null ? [r.min, r.max] : null);
const sumSlots = (slots, key) => Object.values(slots || {}).reduce((a, s) => a + (s[key] || 0) * (s.guns || 1), 0);

// Nur die Werte, die die Seite zeigt; fehlende Werte bleiben null
export function compact(s) {
  const p = s.default_profile || {};
  const art = p.artillery, tor = p.torpedoes, mob = p.mobility, con = p.concealment, arm = p.armour;
  const slot0 = art && Object.values(art.slots || {})[0];
  const tslot = tor && Object.values(tor.slots || {})[0];
  return {
    id: s.ship_id, name: s.name, nation: s.nation, type: s.type, tier: s.tier,
    prem: !!s.is_premium, special: !!s.is_special, test: !!s.has_demo_profile,
    credit: num(s.price_credit), gold: num(s.price_gold),
    next: Object.fromEntries(Object.entries(s.next_ships || {}).map(([id, xp]) => [id, xp || 0])),
    // Module: [id, EP, Credits, nächste Schiffe, nächste Module, Standard]
    mods: Object.values(s.modules_tree || {}).map((m) => [m.module_id, m.price_xp || 0, m.price_credit || 0, m.next_ships || [], m.next_modules || [], !!m.is_default]),
    p: {
      hp: num(p.hull && p.hull.health),
      armor: arm ? range(arm.range) : null,
      speed: num(mob && mob.max_speed), turn: num(mob && mob.turning_radius), rudder: num(mob && mob.rudder_time),
      seen: num(con && con.detect_distance_by_ship), air: num(con && con.detect_distance_by_plane),
      gun: slot0 ? { name: slot0.name, barrels: sumSlots(art.slots, "barrels"), reload: num(art.shot_delay), range: num(art.distance),
        turn180: num(art.rotation_time), disp: num(art.max_dispersion),
        he: art.shells && art.shells.HE ? [num(art.shells.HE.damage), num(art.shells.HE.burn_probability)] : null,
        ap: art.shells && art.shells.AP ? num(art.shells.AP.damage) : null,
        sap: art.shells && art.shells.CS ? num(art.shells.CS.damage) : null } : null,
      torp: tslot ? { name: tor.torpedo_name, tubes: sumSlots(tor.slots, "barrels"), reload: num(tor.reload_time), range: num(tor.distance),
        dmg: num(tor.max_damage), speed: num(tor.torpedo_speed), seen: num(tor.visibility_dist) } : null,
      aa: num(p.anti_aircraft && p.anti_aircraft.defense),
      sec: num(p.atbas && p.atbas.distance) || null,
      planes: num(p.hull && p.hull.planes_amount),
      mm: [num(p.battle_level_range_min), num(p.battle_level_range_max)]
    },
    img: !!(s.images && s.images.small)
  };
}

// Icons und Texte für den Shipbuilder: Upgrades, Signale, Kommandantenfähigkeiten, Modultypen
async function fetchAssets() {
  const pages = async (path, params) => {
    const out = {};
    for (let page = 1; ; page++) {
      const j = await get(path, { ...params, page_no: page, limit: 100 });
      Object.assign(out, j.data);
      if (page >= (j.meta.page_total || 1)) break;
    }
    return out;
  };
  const idx = (url) => ((url || "").match(/\/(?:icon_modernization_)?(PC[A-Z]{1,2}\d+)_/) || [])[1] || null;
  const assets = { upgrades: {}, flags: {}, skills: {}, modules: {} };
  for (const lang of ["de", "en"]) {
    for (const type of ["Modernization", "Flags"]) {
      const items = await pages("consumables", { type, language: lang });
      for (const it of Object.values(items)) {
        const key = idx(it.image);
        if (!key) continue;
        const bucket = type === "Flags" ? assets.flags : assets.upgrades;
        const e = bucket[key] || (bucket[key] = { img: it.image, name: {}, desc: {} });
        e.name[lang] = it.name;
        e.desc[lang] = Object.values(it.profile || {}).map((x) => x.description).filter(Boolean);
      }
    }
    const skills = (await get("crewskills", { language: lang })).data;
    for (const [id, sk] of Object.entries(skills)) {
      const e = assets.skills[id] || (assets.skills[id] = { img: sk.icon, name: {}, grid: {}, perks: {} });
      e.name[lang] = sk.name;
      for (const [cls, c] of Object.entries(sk.customization || {})) {
        e.grid[cls] = [c.tier, c.column];
        (e.perks[cls] || (e.perks[cls] = {}))[lang] = (c.perks || []).map((x) => x.description);
      }
    }
  }
  for (const type of ["Hull", "Artillery", "Torpedoes", "Engine", "Suo"]) {
    const j = await get("modules", { type, limit: 1 });
    const m = Object.values(j.data)[0];
    if (m && m.image) assets.modules[type] = m.image;
  }
  return assets;
}

async function main() {
  const fromIdx = process.argv.indexOf("--from");
  let raw;
  if (fromIdx > 0) {
    raw = JSON.parse(fs.readFileSync(process.argv[fromIdx + 1], "utf8"));
  } else {
    raw = await fetchShips();
  }
  const [infoDe, infoEn] = await Promise.all([get("info", { language: "de" }), get("info", { language: "en" })]);
  const ships = Object.values(raw).filter(Boolean).map(compact).sort((a, b) => a.tier - b.tier || a.name.localeCompare(b.name, "en"));
  const out = {
    fetched: new Date().toISOString().slice(0, 10),
    version: infoEn.data.game_version || null,
    nations: { de: infoDe.data.ship_nations, en: infoEn.data.ship_nations },
    types: { de: infoDe.data.ship_types, en: infoEn.data.ship_types },
    ships
  };
  fs.writeFileSync(OUT, JSON.stringify(out));
  // Bild-Adressen getrennt: nur für scripts/icons.py, die Seite lädt sie nicht
  const icons = Object.fromEntries(Object.values(raw).filter((s) => s && s.images && s.images.small).map((s) => [s.ship_id, s.images.small]));
  fs.writeFileSync(new URL("../data/icon-urls.json", import.meta.url), JSON.stringify(icons, null, 0));
  // Shipbuilder: Texte und Bild-Adressen (wird von export_web.py eingebunden, Bilder lädt scripts/icons.py)
  const assets = await fetchAssets();
  fs.writeFileSync(new URL("../data/api-assets.json", import.meta.url), JSON.stringify(assets));
  console.log(`Assets: ${Object.keys(assets.upgrades).length} Upgrades, ${Object.keys(assets.flags).length} Signale, ${Object.keys(assets.skills).length} Fähigkeiten`);
  console.log(`${ships.length} Schiffe, Version ${out.version}, ${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
