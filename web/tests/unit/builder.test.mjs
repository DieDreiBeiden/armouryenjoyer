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
    if (JSON.stringify(p) !== JSON.stringify(want)) diffs.push(`${s.name}: ${JSON.stringify(p).slice(0, 120)} != ${JSON.stringify(want).slice(0, 120)}`);
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
});
