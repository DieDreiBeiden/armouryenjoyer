"""Lädt die kleinen Schiffs-Icons der Wargaming-Enzyklopädie und speichert sie verkleinert als WebP.

Aufruf: python3 -I scripts/icons.py   (braucht Pillow; vorhandene Dateien werden übersprungen)
"""
import io
import json
import pathlib
import sys
import urllib.request

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
URLS = json.loads((ROOT / "data" / "icon-urls.json").read_text())
OUT = ROOT / "assets" / "img" / "ships"
OUT.mkdir(parents=True, exist_ok=True)
ALLOWED = "https://wows-gloss-icons.wgcdn.co/"

done = skipped = failed = 0
for ship_id, url in URLS.items():
    target = OUT / f"{ship_id}.webp"
    if target.exists():
        skipped += 1
        continue
    if not url.startswith(ALLOWED):
        failed += 1
        continue
    try:
        with urllib.request.urlopen(url, timeout=30) as res:
            data = res.read(2_000_000)
        img = Image.open(io.BytesIO(data)).convert("RGBA")
        img.thumbnail((128, 75), Image.LANCZOS)
        img.save(target, "WEBP", quality=82, method=6)
        done += 1
    except Exception as e:  # einzelne Fehler nicht abbrechen lassen
        failed += 1
        print(f"{ship_id}: {e}", file=sys.stderr)
print(f"Schiffe: neu {done}, vorhanden {skipped}, Fehler {failed}")

# Shipbuilder: Upgrades, Signale, Kommandantenfähigkeiten, Modultypen (quadratisch, Transparenz bleibt)
ASSETS = ROOT / "data" / "api-assets.json"
if ASSETS.exists():
    assets = json.loads(ASSETS.read_text())
    jobs = [(f"upgrades/{k}", v["img"]) for k, v in assets["upgrades"].items()]
    jobs += [(f"flags/{k}", v["img"]) for k, v in assets["flags"].items()]
    jobs += [(f"skills/{k}", v["img"]) for k, v in assets["skills"].items()]
    jobs += [(f"modules/{k}", v) for k, v in assets["modules"].items()]
    done = skipped = failed = 0
    for rel, url in jobs:
        target = ROOT / "assets" / "img" / f"{rel}.webp"
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            skipped += 1
            continue
        if not url or not url.startswith(ALLOWED):
            failed += 1
            continue
        try:
            with urllib.request.urlopen(url, timeout=30) as res:
                img = Image.open(io.BytesIO(res.read(2_000_000))).convert("RGBA")
            img.thumbnail((80, 80), Image.LANCZOS)
            img.save(target, "WEBP", quality=88, method=6)
            done += 1
        except Exception as e:
            failed += 1
            print(f"{rel}: {e}", file=sys.stderr)
    print(f"Builder-Icons: neu {done}, vorhanden {skipped}, Fehler {failed}")
