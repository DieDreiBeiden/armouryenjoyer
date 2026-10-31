# armouryenjoyer

Extraktion, Aufbereitung, Analyse und Visualisierung von World-of-Warships-Spieldaten.

## Aufbau

```
Client (res_packages)
   │  extract/        Wrapper um wowsunpack: Build erkennen, GameParams + Lokalisierung entpacken
   ▼
data/<build>/         Rohdaten pro Build (nicht im Repo)
   │  tools/wows_gp/  Laden, Normalisieren, Suchen, Patch-Diff
   ▼
data/<build>/*.json   normalisierte Daten (ships, projectiles, modernizations, diffs)
   │  calc/           Ballistik, Durchschlag, Streuung
   ▼
web/                  statische Web-App ohne Build: Techbaum, Forschungskosten, Vergleich
```

| Ordner | Inhalt | Stand |
|---|---|---|
| `tools/wows_gp/` | CLI zum Auslesen von `GameParams.data` | funktionsfähig, nur mit synthetischen Daten getestet |
| `extract/` | Extraktions-Pipeline | offen (Phase 1) |
| `calc/` | Rechenmodul | offen (Phase 4) |
| `web/` | Frontend: Techbaum, Forschungskosten, Vergleich unter https://armoury.starbane.de | läuft, Daten vorerst aus der Wargaming-API ([web/README.md](web/README.md)) |
| `data/` | Daten pro Build | wird nicht eingecheckt |
| `docs/` | Fahrplan, Quellen | |

Fahrplan: [docs/ROADMAP.md](docs/ROADMAP.md) · Quellen und Lizenzen: [docs/SOURCES.md](docs/SOURCES.md)

## Schnellstart

```
python tools/wows_gp/wows_gp.py types  GameParams.data
python tools/wows_gp/wows_gp.py ships  GameParams.data --tier 10 --format csv --out t10.csv
python tools/wows_gp/wows_gp.py diff   alt/GameParams.data neu/GameParams.data --type Ship
```

Details: [tools/wows_gp/README.md](tools/wows_gp/README.md)

## Regeln

- Keine Spieldateien und keine daraus extrahierten Rohdaten einchecken (`data/` ist ignoriert).
- Keine Supertest-Daten (NDA) verarbeiten oder veröffentlichen.
- Keinen dekompilierten Client-Code einchecken.
