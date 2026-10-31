# wows_gp – GameParams-Datamining für World of Warships

Liest `GameParams.data`, zieht Schiffs-, Waffen-, Munitions- und Modernisierungsdaten heraus und vergleicht Patch-Versionen. Nur Python-Standardbibliothek (ab 3.8).

## 1. GameParams.data aus dem Client holen

Seit Patch 0.10.x liegt die Datei gepackt in `res_packages`. Entpacken mit dem offiziellen `wowsunpack.exe` (Wargaming-Modding-Kit) oder einem anderen Unpacker:

```
cd "<WoWS>\bin\<höchste Build-Nummer>\idx"
wowsunpack.exe -x . -p ..\..\..\res_packages -I content/GameParams.data -o C:\gp
```

Optional für Anzeigenamen: `<WoWS>\bin\<build>\res\texts\de\LC_MESSAGES\global.mo`.

## 2. Befehle

```
python wows_gp.py types   GameParams.data                       # Typen/Species zählen
python wows_gp.py ships   GameParams.data --tier 10 --class Destroyer --format csv --out t10_dd.csv
python wows_gp.py ships   GameParams.data --nation Germany --loc global.mo
python wows_gp.py ship    GameParams.data PGSB108               # Details (Name, Index oder ID)
python wows_gp.py ship    GameParams.data PGSB108 --raw         # kompletter Rohdatensatz
python wows_gp.py get     GameParams.data PGSB108 A_Hull.health
python wows_gp.py search  GameParams.data --key "^burnProb$" --type Projectile
python wows_gp.py search  GameParams.data --value "Smoke" --limit 50
python wows_gp.py export  GameParams.data --out gp.json         # alles als JSON (gestreamt)
python wows_gp.py export  GameParams.data --split out/ --type Ship
python wows_gp.py diff    alt/GameParams.data neu/GameParams.data --type Ship
python wows_gp.py diff    alt.data neu.data --format json --out patch.json --ignore "Cameras|Exterior"
```

Filter (`--nation`, `--type`, `--species`, `--name` als Regex) funktionieren bei `search`, `export` und `diff`. Als Eingabe geht auch ein JSON-Export, z. B. für schnelle Wiederholungen ohne erneutes Entpicklen.

## 3. Hinweise zu den Werten

- `ships` nimmt jeweils das Modul mit dem höchsten Buchstaben (`B_Hull` vor `A_Hull`) als Top-Konfiguration. Bei Schiffen mit alternativen Rümpfen oder Waffen (z. B. Wahl zwischen Torpedos und Geschützen) stimmt das nicht unbedingt; dann `ship` verwenden, das alle Module zeigt.
- Torpedoreichweite: `maxDist` × 30 m (BigWorld-Einheit).
- Werte sind Basiswerte ohne Kapitän, Module und Tarnung.
- Sicherheit: Der Pickle wird mit einem eingeschränkten Unpickler gelesen. Unbekannte Klassen werden zu Platzhaltern, es wird kein fremder Code ausgeführt. Ein normales `pickle.loads` auf Dateien aus fremden Quellen kann beliebigen Code ausführen.

## Export für die Seite

`export_web.py` schreibt `web/data/ships.json` (Top-Konfiguration, Forschungsbaum, Namen DE/EN) und prüft mit `--compare` die Standard-Konfiguration gegen die WG-Enzyklopädie. Details: [web/README.md](../../web/README.md).

Geprüft gegen Build 15.9: Module heißen in echten Daten frei (z. B. `AB_127_50`, `A1_610`), maßgeblich ist `ShipUpgradeInfo.components`; `global.mo` ist UTF-8 ohne Zeichensatz-Kopf und wird mit einem eigenen Leser gelesen.

## Tests

```
python -m unittest -v test_wows_gp
```
