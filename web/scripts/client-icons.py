"""Icons aus dem Spiel-Client (nicht in der WG-API) für die Seite umwandeln.

Aufruf (im Ordner web/): python3 -I scripts/client-icons.py ../data/<build>/gui
Erwartet <gui>/consumables/consumable_<Name>.png (entpackt mit wowsunpack aus gui/consumables).
Schreibt nur die Icons, die data/builder.json braucht, nach assets/img/consumables/<Name>.webp.
"""
import json
import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
gui = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
if not gui or not (gui / "consumables").is_dir():
    sys.exit("Ordner mit consumables/ angeben, z. B. ../data/15.9/gui")
builder = json.loads((ROOT / "data" / "builder.json").read_text())
names = sorted({o["a"] for sb in builder["ships"].values() for slot in sb.get("c", []) for o in slot})
out = ROOT / "assets" / "img" / "consumables"
out.mkdir(parents=True, exist_ok=True)
done, missing = 0, []
for n in names:
    src = gui / "consumables" / f"consumable_{n}.png"
    if not src.exists():
        missing.append(n)
        continue
    img = Image.open(src).convert("RGBA")
    img.thumbnail((80, 80), Image.LANCZOS)
    img.save(out / f"{n}.webp", "WEBP", quality=88, method=6)
    done += 1
print(f"Verbrauchsmaterial-Icons: {done} geschrieben, fehlend: {missing or 'keine'}")
sys.exit(1 if missing else 0)
