import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadScripts, root } from "./load.mjs";

const g = loadScripts(["research.js"]);
const indexShips = g("indexShips"), findPath = g("findPath"), edgeCost = g("edgeCost"), researchCost = g("researchCost"), layoutTree = g("layoutTree");
const DATA = JSON.parse(fs.readFileSync(root + "data/ships.json", "utf8"));

// Kleiner Baum: A -> B -> C, A -> D; B schaltet C erst über zwei Rumpf-Module frei
const ship = (id, tier, next, mods = [], extra = {}) => ({ id, name: "S" + id, nation: "x", type: "Destroyer", tier, prem: false, special: false, credit: tier * 1000, next, mods, ...extra });
const SYN = [
  ship(1, 1, { 2: 100, 4: 50 }),
  ship(2, 2, { 3: 1000 }, [[10, 0, 0, [], [11], true], [11, 200, 20, [], [12], false], [12, 300, 30, [3], [], false], [13, 999, 99, [], [], false]]),
  ship(3, 3, {}),
  ship(4, 2, {}),
  ship(5, 2, {}, [], { prem: true }),
  ship(6, 1, { 7: 10 }), ship(7, 1, {})
];

test("Pfad entlang der Nachfolger, kein Pfad rückwärts oder in andere Zweige", () => {
  const idx = indexShips(SYN);
  assert.deepEqual([...findPath(idx, 1, 3)], [1, 2, 3]);
  assert.equal(findPath(idx, 3, 1), null);
  assert.equal(findPath(idx, 4, 3), null);
  assert.deepEqual([...findPath(idx, 2, 2)], [2]);
});

test("Modulkosten: nur die Kette bis zum freischaltenden Modul, Standardmodule kostenlos", () => {
  const e = edgeCost(SYN[1], 3);
  assert.equal(e.shipXp, 1000);
  assert.equal(e.moduleXp, 500);          // 200 + 300, nicht das unbeteiligte Modul 13
  assert.equal(e.moduleCredits, 50);
});

test("Gesamtkosten summieren Schiffe, Module und Kaufpreise", () => {
  const c = researchCost(indexShips(SYN), 1, 3);
  assert.equal(c.shipXp, 1100);
  assert.equal(c.moduleXp, 500);
  assert.equal(c.xp, 1600);
  assert.equal(c.credits, 2000 + 3000 + 50); // Kauf von 2 und 3 plus Module
});

test("Techbaum: Premiumschiffe fehlen, keine Kante läuft rückwärts, keine doppelten Plätze", () => {
  const L = layoutTree(SYN, "x", null);
  assert.deepEqual([...L.nodes.map((n) => n.id)].sort(), [1, 2, 3, 4, 6, 7]);
  const pos = new Map(L.nodes.map((n) => [n.id, n]));
  for (const [a, b] of L.edges) assert.ok(pos.get(b).col >= pos.get(a).col);
  assert.equal(new Set(L.nodes.map((n) => `${n.col}/${n.row}`)).size, L.nodes.length);
});

test("Echte Daten: Schiffs-EP jeder Kante stimmen mit den Rohdaten, Modulkosten nie negativ", () => {
  const idx = indexShips(DATA.ships);
  let edges = 0;
  for (const s of DATA.ships) for (const [to, xp] of Object.entries(s.next)) {
    if (!idx.byId.has(+to)) continue;
    const c = researchCost(idx, s.id, +to);
    assert.ok(c, `${s.name} -> ${to}`);
    assert.equal(c.shipXp, xp);
    assert.ok(c.moduleXp >= 0 && c.credits >= 0);
    edges++;
  }
  assert.ok(edges > 300, `nur ${edges} Kanten`);
});

test("Echte Daten: jeder Nationen-Baum ohne überlappende Schiffe und reicht bis Stufe X", () => {
  const nations = [...new Set(DATA.ships.filter((s) => !s.prem && !s.special).map((s) => s.nation))];
  for (const n of nations) {
    const L = layoutTree(DATA.ships, n, null);
    if (!L.nodes.length) continue;
    assert.equal(new Set(L.nodes.map((x) => `${x.col}/${x.row}`)).size, L.nodes.length, n);
    const pos = new Map(L.nodes.map((x) => [x.id, x]));
    for (const [a, b] of L.edges) assert.ok(pos.get(b).col >= pos.get(a).col, n);
  }
  assert.ok(layoutTree(DATA.ships, "japan", null).maxTier >= 10);
});
