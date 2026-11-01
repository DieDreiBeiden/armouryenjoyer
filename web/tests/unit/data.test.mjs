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

test("GameParams-Daten: Testschiffe ohne Werte, alle anderen mit Lebenspunkten", () => {
  assert.equal(DATA.source, "GameParams");
  const tests = DATA.ships.filter((s) => s.test);
  assert.ok(tests.length > 0);
  for (const s of tests) assert.ok(Object.values(s.p).every((x) => x === null), `${s.name} hat Werte`);
  const noHp = DATA.ships.filter((s) => !s.test && !(s.p.hp > 0)).map((s) => s.name);
  assert.deepEqual(noHp, []);
});

test("GameParams-Daten gegen die WG-Enzyklopädie: gleiche Schiffe, Top-Konfiguration nie schwächer als Standard", () => {
  const ref = JSON.parse(fs.readFileSync(root + "data/api-reference.json", "utf8"));
  const ids = new Set(DATA.ships.map((s) => s.id));
  assert.deepEqual(ref.ships.filter((s) => !ids.has(s.id)).map((s) => s.name), []);
  const byId = new Map(DATA.ships.map((s) => [s.id, s]));
  const weaker = ref.ships.filter((r) => r.p.hp && byId.get(r.id).p.hp && byId.get(r.id).p.hp < r.p.hp).map((r) => r.name);
  assert.deepEqual(weaker, []);
});

test("Texte: keine doppelten Schlüssel (sie überschreiben sich sonst still)", () => {
  const src = fs.readFileSync(root + "assets/js/i18n.js", "utf8");
  for (const lang of ["de", "en"]) {
    const block = src.slice(src.indexOf(`  ${lang}: {`), src.indexOf("\n  }", src.indexOf(`  ${lang}: {`)));
    const keys = [...block.matchAll(/"([a-z][\w.]*)":/g)].map((m) => m[1]);
    assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) !== i), [], lang);
  }
});
