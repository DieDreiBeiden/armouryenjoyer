# Fahrplan

| Phase | Inhalt | Aufwand | Abbruch-/Rückfallkriterium |
|---|---|---|---|
| 0 | `wows_gp.py` gegen echte `GameParams.data` und `wowsunpack game-params` prüfen, Feldnamen korrigieren | 1 Tag | Blocker für alles Weitere |
| 1 | `extract/`: Wrapper um `wowsunpack` (Build erkennen, entpacken, nach Build ablegen, `metadata` für Datei-Diffs) | 2–3 Tage | `wowsunpack` bricht nach Patch → eigener Python-Loader als Fallback |
| 2 | Normalisiertes Datenmodell (alle Module, Top-Konfiguration, Lokalisierung), Patch-Diffs pro Build | 1–2 Wochen | Alternative Module nicht sauber abbildbar → Modell erweitern statt Sonderfälle |
| 3 | `web/`: Tabelle, Vergleich 2–4 Schiffe, Patch-Historie | 2 Wochen | — |
| 4 | `calc/`: Ballistik, Durchschlag, Streuung; gegen WoWs-ShipBuilder und Ingame-Werte validieren | 1–2 Wochen | Abweichung zu Referenz → nicht veröffentlichen |
| 5 | Optional: Panzerungsviewer (Vorlage wows-toolkit) | Monate | — |

## Risiken

- **Patch-Takt (~4 Wochen):** Feldnamen/Formate ändern sich. Gegenmaßnahme: Schema-Check bei jedem neuen Build, laut fehlschlagen statt leere Werte.
- **Fremdabhängigkeit wowsunpack:** Version auf Release-Tag pinnen, Python-Loader als Fallback pflegen.
- **Speicher:** Client-Installation bzw. `res_packages` belegen mehrere zehn GB.
- **Formeln:** Durchschlag, Normalisierung, Abpraller sind nicht im Client, sondern Community-Rekonstruktionen.
- **Scope Creep:** Nach Phase 3 bewusst entscheiden, ob Phase 4/5 nötig sind.
