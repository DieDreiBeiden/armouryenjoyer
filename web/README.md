# web/: Armoury

Statische Seite unter https://armoury.starbane.de: Techbaum je Nation, Forschungskosten zwischen zwei Schiffen, Vergleich von bis zu sechs Schiffen. Gleicher Aufbau und Stil wie der Santa-Rechner (whaling.starbane.de): kein Build-Schritt, Deutsch/Englisch, Hell/Dunkel, WCAG 2.2 AA.

## Daten

Vorerst aus der öffentlichen Wargaming-Enzyklopädie (EU), nicht aus `GameParams.data`:

```bash
node scripts/build-data.mjs
```

```bash
python3 -I scripts/icons.py
```

- `data/ships.json`: kompakte Schiffsdaten (Stufe, Klasse, Nation, Preise, Nachfolger mit EP, Modulbaum, Standard-Profil).
- `assets/img/ships/<id>.webp`: Icons, 128 × 75 px, lokal, damit die Seite keine Anfragen an Dritte stellt.
- GitHub Actions (`data.yml`) holt beides jeden Montag neu und committet nur bei inhaltlichen Änderungen. Optional Secret `WG_APPLICATION_ID`, sonst die öffentliche ID der Seiten.

Grenzen der API: nur Standardausrüstung, Flugabwehr nur als Wertung, keine Streuungs- oder Durchschlagswerte. Sobald die Pipeline aus `GameParams.data` (Phasen 0–2) läuft, kann sie `data/ships.json` im selben Format erzeugen.

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Markup, Sicherheitsregel (CSP: nur eigene Quellen) |
| `assets/js/boot.js` | Sprache und Farbschema vor dem ersten Zeichnen |
| `assets/js/i18n.js` | Texte Deutsch/Englisch |
| `assets/js/research.js` | Forschungspfad, Kosten (Schiffe + nötige Module + Kaufpreise), Anordnung des Techbaums; ohne DOM, getestet |
| `assets/js/app.js` | Seitenlogik: Techbaum, Detail, Kosten, Premiumliste, Vergleich |

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
