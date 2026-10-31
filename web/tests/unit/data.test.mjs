import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loadScripts, root } from "./load.mjs";

const DATA = JSON.parse(fs.readFileSync(root + "data/ships.json", "utf8"));

test("Schiffsdaten: eindeutige IDs, gültige Stufen und Klassen, Nationen benannt", () => {
  assert.ok(DATA.ships.length > 500);
  assert.equal(new Set(DATA.ships.map((s) => s.id)).size, DATA.ships.length);
  const types = new Set(["Destroyer", "Cruiser", "Battleship", "AirCarrier", "Submarine"]);
  for (const s of DATA.ships) {
    assert.ok(s.tier >= 1 && s.tier <= 11, s.name);
    assert.ok(types.has(s.type), `${s.name}: ${s.type}`);
    assert.ok(DATA.nations.de[s.nation] && DATA.nations.en[s.nation], `${s.name}: ${s.nation}`);
  }
});

test("Jedes Schiff mit Bild hat ein lokales Icon", () => {
  const missing = DATA.ships.filter((s) => s.img && !fs.existsSync(`${root}assets/img/ships/${s.id}.webp`)).map((s) => s.name);
  assert.deepEqual(missing, []);
});

test("Texte: Deutsch und Englisch haben dieselben Schlüssel und Platzhalter, jeder HTML-Schlüssel existiert", () => {
  const g = loadScripts(["i18n.js"], { LANG: "de" });
  const I = g("I18N");
  assert.deepEqual(Object.keys(I.de).sort(), Object.keys(I.en).sort());
  const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const k of Object.keys(I.de)) assert.equal(ph(I.de[k]), ph(I.en[k]), k);
  const html = fs.readFileSync(root + "index.html", "utf8");
  const keys = [...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map((m) => m[1])
    .concat([...html.matchAll(/data-i18n-attr="([^"]+)"/g)].flatMap((m) => m[1].split(";").map((p) => p.split(":")[1].trim())));
  assert.deepEqual([...new Set(keys)].filter((k) => !(k in I.de)), []);
});
