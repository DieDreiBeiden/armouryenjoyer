# web/: Armoury

Statische Seite unter https://armoury.starbane.de: Techbaum je Nation, Forschungskosten zwischen zwei Schiffen, Vergleich von bis zu sechs Schiffen. Gleicher Aufbau und Stil wie der Santa-Rechner (whaling.starbane.de): kein Build-Schritt, Deutsch/Englisch, Hell/Dunkel, WCAG 2.2 AA.

## Daten

Aus den Spieldateien (`GameParams.data` + `global.mo`), erzeugt mit `tools/wows_gp/export_web.py`. Ablauf nach jedem Patch (lokal, weil der Client nötig ist):

1. `GameParams.data` mit wowsunpack entpacken, `global.mo` (de, en) aus `bin/<build>/res/texts/<sprache>/LC_MESSAGES/` kopieren, alles nach `data/<build>/` (wird nicht eingecheckt).
2. Export mit Abgleich gegen die WG-Enzyklopädie; bei Abweichungen bricht er ab und schreibt nichts:

```bash
python3 -I tools/wows_gp/export_web.py data/15.9/GameParams.data --build 15.9 --loc-de data/15.9/de/global.mo --loc-en data/15.9/en/global.mo --out web/data/ships.json --compare web/data/api-reference.json
```

3. `npm test` in `web/`, committen, pushen. Die Seite wird automatisch veröffentlicht.

Was eingecheckt wird: nur `web/data/ships.json` mit den angezeigten Werten, keine Rohdaten. Öffentliche Testschiffe stehen ohne Werte darin, Event-, Hilfs- und entfernte Schiffe gar nicht.

Werte: Top-Konfiguration (jeweils das am weitesten erforschte Modul), Reichweite mit Feuerleitsystem, Geschwindigkeit mit Antrieb, Streuung bei maximaler Reichweite, Torpedoschaden wie im Spiel angezeigt (alphaDamage / 3 + damage), Flak-Zonen außen/Mitte/innen mit DPS.

Abgleich Build 15.9: 963 Schiffe mit Werten, Lebenspunkte, Wendekreis, Sichtbarkeit, Reichweite und Forschungs-EP ohne Abweichung. Geschwindigkeit wird nicht verglichen: die API liefert für viele ältere Schlachtschiffe zu niedrige Werte (Kongō 24,9 statt 30 kn).

`scripts/build-data.mjs` holt nur noch die Referenz `data/api-reference.json` und die Icon-Adressen; `scripts/icons.py` lädt neue Icons. Beides läuft montags per GitHub Actions (`data.yml`). Fehlt danach ein neues Schiff in `ships.json`, schlägt der Test fehl: Zeit für einen neuen GameParams-Export.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Markup, Sicherheitsregel (CSP: nur eigene Quellen) |
| `assets/js/boot.js` | Sprache und Farbschema vor dem ersten Zeichnen |
| `assets/js/i18n.js` | Texte Deutsch/Englisch |
| `assets/js/builder.js` | Shipbuilder: Werte aus Modulen und Upgrades; ohne DOM, getestet |
| `assets/js/research.js` | Forschungspfad, Kosten (Schiffe + nötige Module + Kaufpreise), Anordnung des Techbaums; ohne DOM, getestet |
| `assets/js/app.js` | Seitenlogik: Techbaum, Detail, Kosten, Premiumliste, Vergleich |
| `../tools/wows_gp/export_web.py` | Export GameParams → `data/ships.json`, Abgleich mit der API |

## Shipbuilder

Reiter „Shipbuilder“: Module je Typ (Rumpf, Hauptbatterie, Torpedos, Antrieb, Feuerleitsystem) und ein Upgrade je Slot wählen; die Werte rechnen sich neu, verglichen mit der Top-Konfiguration ohne Upgrades. Builds lassen sich als Link teilen (`?b=<id>.<Module>.<Upgrades>#builder`).

- Daten: `data/builder.json` (aus `export_web.py`, wird erst beim Öffnen des Reiters geladen): Moduloptionen je Schiff, wählbare Upgrades je Slot (Bedingungen wie im Spiel: Stufe, Klasse, Nation, Gruppe, Ausnahmelisten), Effekt-Texte aus `global.mo`.
- Rechnung: `assets/js/builder.js`, ohne DOM. Ohne Upgrades liefert sie für jedes Schiff exakt die Werte aus `ships.json` (Test).
- Angewendet werden nur Modifikatoren mit eindeutiger Wirkung auf angezeigte Werte (Liste `APPLIED` im Export, in der Seite mit ◆ markiert); alle anderen stehen als Text dabei. Streuungs-Modifikatoren wirken auf die Streuung bei maximaler Reichweite.
- Noch nicht enthalten: Kommandantenfähigkeiten, Signale, Verbrauchsmaterial.

## Forschungskosten

Für jeden Schritt A → B: EP für B laut Nachfolgerliste von A, plus EP und Credits der Module auf A, die bis zum B freischaltenden Modul nötig sind, plus Kaufpreis von B. Ohne Rabatte, Ausrüstung und Tarnungen.

## Tests

```bash
npm ci && npx playwright install chromium && npm test
```

- `tests/unit/`: Pfade und Kosten an einem kleinen Beispielbaum, alle echten Kanten (EP = Rohdaten), Techbaum ohne überlappende Schiffe, Daten und Texte.
- `tests/e2e/`: Techbaum, Kosten, Filter, Vergleich, Sprache, Farbschema, 320 px, axe in Hell und Dunkel. Jeder Test schlägt bei Konsolenfehlern oder Anfragen nach außen fehl.

## Veröffentlichung

`.github/workflows/web.yml` testet bei jedem Push auf `main` und veröffentlicht danach `index.html`, `assets`, `data`, `fonts` und `CNAME` über GitHub Pages (Quelle: GitHub Actions). Ändert man Scripts oder Styles, die Version `?v=` in `index.html` erhöhen.
