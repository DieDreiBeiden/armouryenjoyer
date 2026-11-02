import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadScripts, root } from "./load.mjs";

const g = loadScripts(["builder.js"]);
const defaultSelection = g("defaultSelection"), computeBuild = g("computeBuild");
const DATA = JSON.parse(fs.readFileSync(root + "data/ships.json", "utf8"));
const B = JSON.parse(fs.readFileSync(root + "data/builder.json", "utf8"));
const plain = (x) => JSON.parse(JSON.stringify(x));

test("Ohne Upgrades rechnet der Builder für jedes Schiff genau die Werte von ships.json", () => {
  const diffs = [];
  for (const s of DATA.ships) {
    if (s.test) continue;
    const sb = B.ships[s.id];
    assert.ok(sb, `${s.name} fehlt in builder.json`);
    const p = plain(computeBuild(sb, defaultSelection(sb), [], s.type));
    const want = plain(s.p);
    // Reihenfolge der Felder spielt keine Rolle
    const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort()) : v));
    if (canon(p) !== canon(want)) diffs.push(`${s.name}: ${canon(p)} != ${canon(want)}`);
  }
  assert.deepEqual(diffs.slice(0, 5), []);
});

test("Hauptbatterie-Modifikation 3 senkt die Nachladezeit um 12 %", () => {
  const s = DATA.ships.find((x) => x.name === "Shimakaze");
  const sb = B.ships[s.id];
  const i = B.upgrades.findIndex((u) => u.name.startsWith("PCM013_MainGun_Mod_III"));
  assert.ok(sb.up[5].includes(i), "Mod 3 in Slot 6 wählbar");
  const p = computeBuild(sb, defaultSelection(sb), [B.upgrades[i].mods], s.type);
  assert.equal(p.gun.reload, Math.round(s.p.gun.reload * 0.88 * 100) / 100);
  assert.ok(p.gun.turn180 > s.p.gun.turn180, "Mod 3 verlangsamt die Türme");
});

test("Modulwahl: anderes Torpedomodul ändert die Torpedowerte", () => {
  const s = DATA.ships.find((x) => x.name === "Shimakaze");
  const sb = B.ships[s.id];
  assert.ok(sb.o.torpedoes.length >= 2);
  const stock = { ...defaultSelection(sb), torpedoes: sb.o.torpedoes[0].u };
  const p = computeBuild(sb, stock, [], s.type);
  assert.notEqual(p.torp.range, s.p.torp.range);
});

test("Upgrades: fast alle Schiffe haben in Slot 1 eine Wahl, keine Indexfehler", () => {
  // Einzelne Schiffe stehen in GameParams ausdrücklich auf den Ausnahmelisten (Build 15.9: Schlieffen)
  const ids = Object.keys(B.ships);
  const empty = ids.filter((id) => !B.ships[id].up[0].length);
  assert.ok(empty.length <= ids.length * 0.01, `${empty.length} Schiffe ohne Slot 1`);
  for (const [id, sb] of Object.entries(B.ships)) for (const slot of sb.up) for (const i of slot) assert.ok(B.upgrades[i], `${id}: ${i}`);
});

test("Fähigkeiten und Signale: Raster wie im Spiel, Effekte werden eingerechnet", () => {
  for (const cls of ["Destroyer", "Cruiser", "Battleship"]) {
    const grid = B.skills.filter((s) => s.grid[cls]);
    assert.equal(grid.length, 24, cls);
    assert.deepEqual([1, 2, 3, 4].map((t) => grid.filter((s) => s.grid[cls][0] === t).length), [6, 6, 6, 6], cls);
  }
  const s = DATA.ships.find((x) => x.name === "Shimakaze");
  const sb = B.ships[s.id];
  const spec = B.skills.find((k) => k.key === "GmReloadAaDamageConstant");
  const sm = B.flags.find((f) => f.mods.speedCoef);
  const p = computeBuild(sb, defaultSelection(sb), [spec.mods, sm.mods], s.type);
  assert.equal(p.gun.reload, Math.round(s.p.gun.reload * 0.95 * 100) / 100);
  assert.equal(p.speed, Math.round(s.p.speed * sm.mods.speedCoef * 100) / 100);
});


test("Verbrauchsmaterial: Rohwerte ohne Effekte, Upgrades verlängern Dauer, jedes hat ein Icon", () => {
  const computeConsumables = g("computeConsumables");
  const s = DATA.ships.find((x) => x.name === "Shimakaze");
  const sb = B.ships[s.id];
  const base = plain(computeConsumables(sb, [], [], s.type));
  assert.deepEqual(base.map((c) => [c.a, c.n, c.reload, c.work]), sb.c.map((o) => [o[0].a, o[0].n, o[0].reload, o[0].work]));
  // Allgemeine Wirkdauer +10 % (Upgrade „Schiffsverbrauchsmaterial-Modifikation 1“)
  const up = B.upgrades.find((u) => u.mods.ConsumablesWorkTime && u.mods.ConsumablesWorkTime > 1);
  assert.ok(up, "Upgrade mit ConsumablesWorkTime");
  const smoke = sb.c.findIndex((o) => o[0].type === "smokeGenerator");
  const withUp = computeConsumables(sb, [], [up.mods], s.type);
  assert.equal(withUp[smoke].work, Math.round(sb.c[smoke][0].work * up.mods.ConsumablesWorkTime * 10) / 10);
  // Unbegrenzte Ladungen bleiben unbegrenzt
  const dcp = sb.c.findIndex((o) => o[0].type === "crashCrew");
  assert.equal(computeConsumables(sb, [], [{ additionalConsumables: 1 }], s.type)[dcp].n, -1);
  const names = new Set(Object.values(B.ships).flatMap((x) => x.c.flat().map((c) => c.a)));
  const missing = [...names].filter((n) => !fs.existsSync(`${root}assets/img/consumables/${n}.webp`));
  assert.deepEqual(missing, []);
  // Jedes Verbrauchsmaterial hat einen Spieltext in beiden Sprachen
  assert.deepEqual([...names].filter((n) => !(B.cdesc[n] && B.cdesc[n].de && B.cdesc[n].en)), []);
});

test("Signale verändern Brand, Flutung, Sekundärartillerie und Heilung", () => {
  const computeBuild = g("computeBuild"), defaultSelection = g("defaultSelection"), computeConsumables = g("computeConsumables");
  const flag = (key) => B.flags.find((f) => f.key === key).mods;
  const yam = DATA.ships.find((x) => x.name === "Yamato"), sb = B.ships[yam.id], sel = defaultSelection(sb);
  const base = computeBuild(sb, sel, [], yam.type);
  // Victor Lima: +1 Prozentpunkt über 160 mm (460 mm), +0,5 bis 160 mm (155-mm-Sekundärgeschütze)
  const vl = computeBuild(sb, sel, [flag("PCEF017")], yam.type);
  assert.equal(vl.gun.he.burn, base.gun.he.burn + 1);
  assert.equal(vl.secBurn, base.secBurn + 0.5);
  // India Yankee −20 % Branddauer, Juliet Yankee Bissotwo −20 % Flutungsdauer
  assert.equal(computeBuild(sb, sel, [flag("PCEF008")], yam.type).fireT, base.fireT * 0.8);
  assert.equal(computeBuild(sb, sel, [flag("PCEF009")], yam.type).floodT, base.floodT * 0.8);
  // Mike Yankee Soxisix −5 % Nachladezeit der Sekundärartillerie
  assert.equal(computeBuild(sb, sel, [flag("PCEF012")], yam.type).secR, Math.round(base.secR * 0.95 * 100) / 100);
  // India Delta: Reparaturmannschaft heilt 20 % mehr
  const heal = (mods) => computeConsumables(sb, [], mods, yam.type, base.hp).find((c) => c.type === "regenCrew").heal;
  assert.ok(heal([]) > 0);
  assert.equal(heal([flag("PCEF007")]), Math.round(heal([]) * 1.2));
  // Gesamtheilung je Einsatz = Rate × Wirkdauer, auch als Anteil der max. TP
  const rc = computeConsumables(sb, [], [], yam.type, base.hp).find((c) => c.type === "regenCrew");
  assert.equal(rc.healT, Math.round(rc.heal / base.hp * base.hp * rc.work));
  assert.equal(rc.healPct, Math.round(rc.healT / base.hp * 1000) / 10);
  // Juliet Whiskey Unaone: Flutungschance der Torpedos ×1,15
  const shima = DATA.ships.find((x) => x.name === "Shimakaze"), sb2 = B.ships[shima.id], sel2 = defaultSelection(sb2);
  const f0 = computeBuild(sb2, sel2, [], shima.type).torp.flood;
  assert.equal(computeBuild(sb2, sel2, [flag("PCEF019")], shima.type).torp.flood, Math.round(f0 * 1.15 * 10) / 10);
});

test("Kommandant: Sprengmeister, Trägheitszünder und schwere HE-Granaten wirken auf Haupt- und Sekundärbatterie", () => {
  const computeBuild = g("computeBuild"), defaultSelection = g("defaultSelection");
  const skill = (key) => B.skills.find((k) => k.key === key).mods;
  const yam = DATA.ships.find((x) => x.name === "Yamato"), sb = B.ships[yam.id], sel = defaultSelection(sb);
  const base = computeBuild(sb, sel, [], yam.type);
  // Sprengmeister: +1 Prozentpunkt Brandchance für HE von Haupt- und Sekundärbatterie
  const de = computeBuild(sb, sel, [skill("HeFireProbability")], yam.type);
  assert.equal(de.gun.he.burn, base.gun.he.burn + 1);
  assert.equal(de.secBurn, base.secBurn + 1);
  // Trägheitszünder: Grund-Brandchance halbiert, HE-Durchschlag +25 %
  const ifhe = computeBuild(sb, sel, [skill("HePenetration")], yam.type);
  assert.equal(ifhe.gun.he.burn, base.gun.he.burn / 2);
  assert.equal(ifhe.secBurn, base.secBurn / 2);
  assert.equal(ifhe.gun.he.pen, Math.round(base.gun.he.pen * 1.25 * 10) / 10);
  // Zusammen: erst halbieren, dann +1 Prozentpunkt
  assert.equal(computeBuild(sb, sel, [skill("HePenetration"), skill("HeFireProbability")], yam.type).gun.he.burn, base.gun.he.burn / 2 + 1);
  // Schwere Spreng- und SAP-Granaten: HE-Schaden +10 %
  assert.equal(computeBuild(sb, sel, [skill("HeSapDamage")], yam.type).gun.he.dmg, Math.round(base.gun.he.dmg * 1.1));
});

test("Verbrauchsmaterial: Erfassungsreichweiten und Kennwerte sind vorhanden", () => {
  const computeConsumables = g("computeConsumables");
  const need = { rls: "dist", sonar: "dist", hydrophone: "dist", submarineLocator: "dist", smokeGenerator: "radius", speedBoosters: "boost", artilleryBoosters: "boost", scout: "boost", fighter: "planes", torpedoReloader: "treload" };
  const missing = [];
  for (const [id, sb] of Object.entries(B.ships)) {
    const s = DATA.ships.find((x) => x.id === +id);
    sb.c.forEach((opts, slot) => opts.forEach((o, i) => {
      const ch = []; ch[slot] = i;
      const c = computeConsumables(sb, ch, [], s.type, 1000)[slot];
      if (need[c.type] && !(c[need[c.type]] > 0)) missing.push(`${s.name}: ${c.type}`);
    }));
  }
  assert.deepEqual(missing.slice(0, 5), []);
  // Des Moines: Radar 10 km, Hydro 5 km gegen Schiffe und 3,5 km gegen Torpedos
  const dm = DATA.ships.find((x) => x.name === "Des Moines"), sb = B.ships[dm.id];
  const pick = (type) => { const slot = sb.c.findIndex((o) => o.some((x) => x.type === type)); const ch = []; ch[slot] = sb.c[slot].findIndex((x) => x.type === type); return computeConsumables(sb, ch, [], dm.type, 1000)[slot]; };
  assert.equal(pick("rls").dist, 10);
  assert.equal(pick("sonar").dist, 5);
  assert.equal(pick("sonar").tdist, 3.5);
});
