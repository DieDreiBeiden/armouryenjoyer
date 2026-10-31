"""Tests mit einer synthetischen GameParams.data (gleiches Containerformat wie
das Original: Pickle -> zlib -> Bytes umgekehrt)."""

import contextlib
import io
import json
import pickle
import sys
import tempfile
import types
import unittest
import zlib
from pathlib import Path

import wows_gp

# Fake-Modul "GameParams", damit der Pickle dieselben Klassenpfade enthaelt
_mod = types.ModuleType("GameParams")


class GPData:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class TypeInfo(GPData):
    pass


GPData.__module__ = TypeInfo.__module__ = "GameParams"
GPData.__qualname__, TypeInfo.__qualname__ = "GPData", "TypeInfo"
_mod.GPData, _mod.TypeInfo = GPData, TypeInfo
sys.modules["GameParams"] = _mod


def make_gp(hp=72000, extra=None):
    ti = lambda t, n, s: TypeInfo(type=t, nation=n, species=s)
    gp = {
        "PGSB108_Tirpitz": GPData(
            typeinfo=ti("Ship", "Germany", "Battleship"), level=8, index="PGSB108",
            id=3762190032, name="PGSB108_Tirpitz", group="premium",
            A_Hull=GPData(health=hp, maxSpeed=30.8, visibilityFactor=15.84,
                          visibilityFactorByPlane=12.6, rudderTime=17.8),
            A_Artillery=GPData(
                maxDist=21200.0,
                HP_GGM_1=GPData(typeinfo=ti("Gun", "Germany", "Main"), numBarrels=2,
                                shotDelay=26.0, ammoList=["PAPA001_380mm_HE", "PAPA002_380mm_AP"]),
                HP_GGM_2=GPData(typeinfo=ti("Gun", "Germany", "Main"), numBarrels=2,
                                shotDelay=26.0, ammoList=["PAPA001_380mm_HE", "PAPA002_380mm_AP"]),
            ),
            A_Torpedoes=GPData(
                HP_GGT_1=GPData(numBarrels=4, shotDelay=90.0, ammoList=["PAPT001_G7"]),
            ),
            ShipUpgradeInfo=GPData(costXP=0, AB1_Hull=GPData(ucType="_Hull", components={"hull": ["A_Hull"]})),
            tags={"x", "y"},
        ),
        "PAPA001_380mm_HE": GPData(typeinfo=ti("Projectile", "Germany", "Artillery"),
                                   ammoType="HE", alphaDamage=5700.0, bulletDiametr=0.38, burnProb=0.36),
        "PAPA002_380mm_AP": GPData(typeinfo=ti("Projectile", "Germany", "Artillery"),
                                   ammoType="AP", alphaDamage=11300.0, bulletDiametr=0.38),
        "PAPT001_G7": GPData(typeinfo=ti("Projectile", "Germany", "Torpedo"),
                             alphaDamage=14400.0, maxDist=200.0, speed=64.0),
        "PCM001_MainGun_Mod_I": GPData(typeinfo=ti("Modernization", "Common", None),
                                       slot=0, modifiers={"GMIdealRadius": 0.93}),
    }
    if extra:
        gp.update(extra)
    return gp


def write_gp(path, gp, protocol=2, wrap=True):
    obj = [{"": gp}] if wrap else gp
    path.write_bytes(zlib.compress(pickle.dumps(obj, protocol=protocol))[::-1])


def run(*argv):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
        wows_gp.main([str(a) for a in argv])
    return buf.getvalue()


class T(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.f = self.tmp / "GameParams.data"
        write_gp(self.f, make_gp())

    def test_load_protocols_and_wrapping(self):
        for proto in (0, 2):
            for wrap in (True, False):
                p = self.tmp / f"gp_{proto}_{wrap}.data"
                write_gp(p, make_gp(), proto, wrap)
                gp = wows_gp.load_gameparams(p)
                self.assertEqual(len(gp), 5)
                self.assertEqual(gp.entry("PGSB108")["A_Hull"]["health"], 72000)

    def test_no_foreign_classes_loaded(self):
        gp = wows_gp.load_gameparams(self.f)
        self.assertIsInstance(gp.raw("PGSB108_Tirpitz"), wows_gp.GPObject)

    def test_ships_row(self):
        rows = json.loads(run("ships", self.f, "--format", "json"))
        r = rows[0]
        self.assertEqual((r["tier"], r["hp"], r["guns"], r["caliber_mm"]), (8, 72000, "2x2", 380))
        self.assertEqual((r["he_dmg"], r["ap_dmg"], r["gun_range_km"]), (5700.0, 11300.0, 21.2))
        self.assertEqual((r["torp"], r["torp_range_km"]), ("1x4", 6.0))

    def test_filters(self):
        self.assertEqual(json.loads(run("ships", self.f, "--tier", "9-10", "--format", "json")), [])
        self.assertEqual(len(json.loads(run("ships", self.f, "--nation", "germany", "--format", "json"))), 1)

    def test_get_path_and_search(self):
        self.assertEqual(run("get", self.f, "PGSB108", "A_Artillery.HP_GGM_1.ammoList[1]").strip(),
                         '"PAPA002_380mm_AP"')
        out = run("search", self.f, "--key", "^burnProb$")
        self.assertIn("PAPA001_380mm_HE\tburnProb\t0.36", out)

    def test_export_roundtrip_json(self):
        out = self.tmp / "all.json"
        run("export", self.f, "--out", out)
        data = json.loads(out.read_text())
        self.assertEqual(data["PGSB108_Tirpitz"]["tags"], ["x", "y"])
        # JSON-Export ist selbst wieder als Eingabe nutzbar
        self.assertEqual(wows_gp.load_gameparams(out).entry("PGSB108")["level"], 8)
        run("export", self.f, "--split", self.tmp / "split", "--type", "Projectile")
        self.assertEqual(len(list((self.tmp / "split" / "Projectile").glob("*.json"))), 3)

    def test_diff(self):
        new = self.tmp / "new.data"
        write_gp(new, make_gp(hp=74000, extra={
            "PCM999_New": GPData(
                typeinfo=TypeInfo(type="Modernization", nation="Common", species=None), slot=5)}))
        rep = json.loads(run("diff", self.f, new, "--format", "json"))
        self.assertEqual([e["name"] for e in rep["added"]], ["PCM999_New"])
        self.assertEqual(rep["changed"]["PGSB108_Tirpitz"][0]["path"], "A_Hull.health")
        self.assertIn("A_Hull.health: 72000 -> 74000", run("diff", self.f, new))

def make_mo(entries):
    """Kleine .mo-Datei wie im Client: UTF-8, ohne Zeichensatz-Kopfzeile."""
    import struct
    keys = sorted(entries)
    ids = b"".join(k.encode() + b"\0" for k in keys)
    strs = b"".join(entries[k].encode() + b"\0" for k in keys)
    start = 28 + 16 * len(keys)
    otab, ttab, off = [], [], 0
    for k in keys:
        otab += [len(k.encode()), start + off]
        off += len(k.encode()) + 1
    off = 0
    for k in keys:
        ttab += [len(entries[k].encode()), start + len(ids) + off]
        off += len(entries[k].encode()) + 1
    head = struct.pack("<7I", 0x950412DE, 0, len(keys), 28, 28 + 8 * len(keys), 0, 0)
    return head + struct.pack(f"<{len(otab)}I", *otab) + struct.pack(f"<{len(ttab)}I", *ttab) + ids + strs


class TestLocalization(unittest.TestCase):
    def test_utf8_ohne_zeichensatz(self):
        with tempfile.TemporaryDirectory() as d:
            mo = Path(d) / "global.mo"
            mo.write_bytes(make_mo({"IDS_PGSB108": "Tirpitz", "IDS_PRSD101": "Storoschewoi – Ü"}))
            loc = wows_gp.Localization(mo)
            self.assertEqual(loc.get("IDS_PRSD101"), "Storoschewoi – Ü")
            self.assertEqual(loc.ship_name({"index": "PGSB108"}), "Tirpitz")
            self.assertIsNone(loc.get("IDS_FEHLT"))


if __name__ == "__main__":
    unittest.main()
