#!/usr/bin/env python3
"""wows_gp - Datamining-Tool fuer World of Warships GameParams.data

Liest GameParams.data (umgekehrte Bytes -> zlib -> Python-2-Pickle) mit einem
eingeschraenkten Unpickler (es wird kein Spielcode ausgefuehrt) und bietet:

  types    Uebersicht aller Eintragstypen (Ship, Projectile, Modernization, ...)
  ships    Schiffstabelle mit Kernwerten (Tabelle/CSV/JSON)
  ship     Detailansicht eines Schiffs (Module, Waffen, Munition)
  get      Beliebigen Eintrag bzw. Teilpfad als JSON ausgeben
  search   Eintraege nach Schluessel/Wert durchsuchen
  export   Komplett- oder Teilexport als JSON (optional eine Datei pro Eintrag)
  diff     Zwei GameParams-Versionen vergleichen (Patch-Aenderungen)

Nur Python-Standardbibliothek, Python >= 3.8.
"""

import argparse
import copyreg
import csv
import io
import json
import math
import pickle
import re
import struct
import sys
import zlib
from collections import Counter, OrderedDict, defaultdict
from pathlib import Path

# --------------------------------------------------------------------------
# Laden
# --------------------------------------------------------------------------


class GPObject:
    """Platzhalter fuer jede Klasse aus dem Pickle (GPData, TypeInfo, ...)."""

    _gp_class = "?"

    def __new__(cls, *args, **kwargs):
        return object.__new__(cls)

    def __init__(self, *args, **kwargs):
        if args:
            self.__dict__["_args"] = list(args)
        if kwargs:
            self.__dict__.update(kwargs)

    def __setstate__(self, state):
        if isinstance(state, tuple) and len(state) == 2 and (
            state[0] is None or isinstance(state[0], dict)
        ):
            dict_state, slot_state = state
            if dict_state:
                self.__dict__.update(dict_state)
            if isinstance(slot_state, dict):
                self.__dict__.update(slot_state)
        elif isinstance(state, dict):
            self.__dict__.update(state)
        else:
            self.__dict__["_state"] = state

    def __repr__(self):
        return f"<{self._gp_class} {len(self.__dict__)} attrs>"


_CLASS_CACHE = {}


def _placeholder(module, name):
    key = f"{module}.{name}"
    cls = _CLASS_CACHE.get(key)
    if cls is None:
        cls = type(str(name), (GPObject,), {"_gp_class": key})
        _CLASS_CACHE[key] = cls
    return cls


# Harmlose Konstruktoren, die im Pickle vorkommen duerfen. Alles andere wird
# durch GPObject-Platzhalter ersetzt, d.h. es wird niemals fremder Code geladen.
_SAFE_GLOBALS = {}
for _mod in ("__builtin__", "builtins"):
    for _n, _f in (("object", object), ("set", set), ("frozenset", frozenset),
                   ("list", list), ("dict", dict), ("tuple", tuple),
                   ("bytearray", bytearray), ("complex", complex)):
        _SAFE_GLOBALS[(_mod, _n)] = _f
for _mod in ("copy_reg", "copyreg"):
    _SAFE_GLOBALS[(_mod, "_reconstructor")] = copyreg._reconstructor
_SAFE_GLOBALS[("collections", "OrderedDict")] = OrderedDict
_SAFE_GLOBALS[("collections", "defaultdict")] = defaultdict


class _SafeUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        f = _SAFE_GLOBALS.get((module, name))
        return f if f is not None else _placeholder(module, name)


def _attrs(o):
    if isinstance(o, GPObject):
        return o.__dict__
    if isinstance(o, dict):
        return o
    return None


def _get(o, key, default=None):
    a = _attrs(o)
    return a.get(key, default) if a is not None else default


def _looks_like_gp(d):
    if not isinstance(d, dict) or not d:
        return False
    sample = list(d.values())[:50]
    hits = sum(1 for v in sample if _get(v, "typeinfo") is not None)
    return hits >= max(1, len(sample) // 2)


def _find_root(obj, depth=0):
    """Sucht das Dict {Eintragsname: Daten}. Je nach Spielversion steckt es in
    einer Liste und/oder unter einem Schluessel '' bzw. einer Region."""
    if _looks_like_gp(obj):
        return obj
    if depth > 4:
        return None
    if isinstance(obj, (list, tuple)):
        children = obj
    elif _attrs(obj) is not None:
        children = list(_attrs(obj).values())
    else:
        return None
    for c in children:
        r = _find_root(c, depth + 1)
        if r is not None:
            return r
    return None


def load_gameparams(path):
    path = Path(path)
    if path.suffix.lower() == ".json":
        with path.open(encoding="utf-8") as f:
            obj = json.load(f)
    else:
        raw = path.read_bytes()
        data = None
        for candidate in (raw[::-1], raw):
            try:
                data = zlib.decompress(candidate)
                break
            except zlib.error:
                continue
        if data is None:  # evtl. bereits entpackter Pickle
            data = raw
        obj = _SafeUnpickler(io.BytesIO(data), encoding="latin1").load()
    root = _find_root(obj)
    if root is None:
        raise ValueError(f"{path}: keine GameParams-Struktur gefunden")
    return GameParams(root)


def to_plain(o, _stack=None):
    """Wandelt Platzhalter-Objekte rekursiv in JSON-taugliche Daten um."""
    if o is None or isinstance(o, (bool, int, str)):
        return o
    if isinstance(o, float):
        return o if math.isfinite(o) else str(o)
    if isinstance(o, (bytes, bytearray)):
        return bytes(o).decode("latin1")
    if _stack is None:
        _stack = set()
    oid = id(o)
    if oid in _stack:
        return "<cycle>"
    _stack.add(oid)
    try:
        a = _attrs(o)
        if a is not None:
            return {str(k): to_plain(v, _stack) for k, v in a.items()}
        if isinstance(o, (list, tuple)):
            return [to_plain(v, _stack) for v in o]
        if isinstance(o, (set, frozenset)):
            return sorted((to_plain(v, _stack) for v in o), key=repr)
        if isinstance(o, complex):
            return [o.real, o.imag]
        return repr(o)
    finally:
        _stack.discard(oid)


class GameParams:
    def __init__(self, root):
        self.root = root
        self._index = None

    def __len__(self):
        return len(self.root)

    def typeinfo(self, raw):
        ti = _get(raw, "typeinfo")
        return _get(ti, "type"), _get(ti, "nation"), _get(ti, "species")

    def resolve(self, key):
        """Eintrag per Name, Index (z.B. PGSB108) oder numerischer ID finden."""
        if key in self.root:
            return key
        if self._index is None:
            idx = {}
            for name, raw in self.root.items():
                idx.setdefault(str(name).lower(), name)
            for name, raw in self.root.items():
                for k in ("index", "id"):
                    v = _get(raw, k)
                    if v is not None:
                        idx.setdefault(str(v).lower(), name)
            self._index = idx
        return self._index.get(str(key).lower())

    def raw(self, key):
        name = self.resolve(key)
        return None if name is None else self.root[name]

    def entry(self, key):
        r = self.raw(key)
        return None if r is None else to_plain(r)

    def iter(self, type_=None, nation=None, species=None, name_re=None):
        rx = re.compile(name_re, re.I) if name_re else None
        for name, raw in self.root.items():
            t, n, s = self.typeinfo(raw)
            if type_ and (t or "").lower() != type_.lower():
                continue
            if nation and (n or "").lower() != nation.lower():
                continue
            if species and (s or "").lower() != species.lower():
                continue
            if rx and not rx.search(str(name)):
                continue
            yield name, raw


def read_mo(data):
    """.mo-Katalog lesen. Die global.mo des Clients ist UTF-8, nennt aber keinen Zeichensatz;
    gettext.GNUTranslations nimmt dann ASCII an und bricht ab."""
    if len(data) < 28:
        raise ValueError("keine .mo-Datei")
    magic = struct.unpack("<I", data[:4])[0]
    order = "<" if magic == 0x950412DE else ">" if magic == 0xDE120495 else None
    if order is None:
        raise ValueError("keine .mo-Datei (Magic)")
    _rev, count, orig_off, trans_off = struct.unpack(order + "4I", data[4:20])
    catalog = {}
    for i in range(count):
        olen, opos = struct.unpack(order + "2I", data[orig_off + 8 * i:orig_off + 8 * i + 8])
        tlen, tpos = struct.unpack(order + "2I", data[trans_off + 8 * i:trans_off + 8 * i + 8])
        key = data[opos:opos + olen].decode("utf-8", "replace")
        catalog[key] = data[tpos:tpos + tlen].decode("utf-8", "replace")
    return catalog


class Localization:
    """Anzeigenamen aus res/texts/<sprache>/LC_MESSAGES/global.mo."""

    def __init__(self, mo_path):
        with open(mo_path, "rb") as f:
            self._catalog = read_mo(f.read())

    def get(self, key):
        v = self._catalog.get(key)
        return v if isinstance(v, str) and v else None

    def ship_name(self, raw):
        idx = _get(raw, "index")
        return self.get(f"IDS_{idx}") if idx else None


# --------------------------------------------------------------------------
# Schiffsauswertung
# --------------------------------------------------------------------------

HULL_KEYS = ("health", "maxSpeed", "visibilityFactor", "visibilityFactorByPlane",
             "rudderTime", "turningRadius", "draft", "speedCoef")
PROJECTILE_KEYS = ("ammoType", "alphaDamage", "damage", "bulletDiametr", "bulletSpeed",
                   "bulletMass", "burnProb", "alphaPiercingHE", "alphaPiercingCS",
                   "bulletKrupp", "bulletDetonator", "bulletDetonatorThreshold",
                   "bulletRicochetAt", "bulletAlwaysRicochetAt", "maxDist", "speed",
                   "visibilityFactor", "uwCritical", "armingTime")


COMPONENT = {"Hull": "hull", "Artillery": "artillery", "ATBA": "atba", "Torpedoes": "torpedoes"}


def _module_keys(raw, suffix):
    """Module eines Typs. Echte Daten benennen sie frei (z. B. AB_127_50, A1_610); maßgeblich ist
    ShipUpgradeInfo.components. Das Namensmuster A_Hull/B_Artillery bleibt als Rückfall."""
    a = _attrs(raw) or {}
    keys = {k for k in a if re.fullmatch(r"[A-Z]\d*_" + suffix, str(k))}
    for up in (_attrs(_get(raw, "ShipUpgradeInfo")) or {}).values():
        comps = to_plain(_get(up, "components")) if _attrs(up) is not None else None
        for name in (comps or {}).get(COMPONENT.get(suffix), []) or []:
            if name in a:
                keys.add(name)
    return sorted(keys)


def _pick(o, keys):
    return {k: to_plain(_get(o, k)) for k in keys if _get(o, k) is not None}


def projectile_summary(raw):
    t, n, s = (_get(_get(raw, "typeinfo"), k) for k in ("type", "nation", "species"))
    return {"species": s, **_pick(raw, PROJECTILE_KEYS)}


def _weapon_summary(gp, module):
    mounts = [v for v in (_attrs(module) or {}).values()
              if _attrs(v) is not None and _get(v, "ammoList") is not None]
    if not mounts:
        return None
    barrels = Counter(_get(m, "numBarrels", 1) for m in mounts)
    ammo = {}
    for m in mounts:
        for an in _get(m, "ammoList") or []:
            if an not in ammo:
                p = gp.raw(an)
                if p is not None:
                    ammo[an] = projectile_summary(p)
    return {
        "mounts": len(mounts),
        "layout": "+".join(f"{n}x{b}" for b, n in sorted(barrels.items(), key=lambda x: -x[0])),
        "reload_s": to_plain(_get(mounts[0], "shotDelay")),
        "max_dist_m": to_plain(_get(module, "maxDist")),
        "ammo": ammo,
    }


def ship_summary(gp, key, loc=None):
    name = gp.resolve(key)
    raw = gp.root[name]
    t, nation, species = gp.typeinfo(raw)
    out = {
        "name": name,
        "display": loc.ship_name(raw) if loc else None,
        "index": _get(raw, "index"),
        "id": _get(raw, "id"),
        "tier": _get(raw, "level"),
        "nation": nation,
        "class": species,
        "group": _get(raw, "group"),
        "hulls": {h: _pick(_get(raw, h), HULL_KEYS) for h in _module_keys(raw, "Hull")},
    }
    for label, suffix in (("artillery", "Artillery"), ("secondaries", "ATBA"),
                          ("torpedoes", "Torpedoes")):
        mods = {k: _weapon_summary(gp, _get(raw, k)) for k in _module_keys(raw, suffix)}
        out[label] = {k: v for k, v in mods.items() if v}
    upg = _attrs(_get(raw, "ShipUpgradeInfo")) or {}
    out["upgrades"] = {
        k: _pick(v, ("ucType", "components", "prev", "nextShips", "costXP", "costCR"))
        for k, v in upg.items() if _attrs(v) is not None
    }
    return out


def _last(d):
    return d[sorted(d)[-1]] if d else {}


def _first_ammo(weapon, ammo_type=None):
    for a in (weapon or {}).get("ammo", {}).values():
        if ammo_type is None or a.get("ammoType") == ammo_type:
            return a
    return {}


def _r(v, n=2):
    return round(v, n) if isinstance(v, (int, float)) and not isinstance(v, bool) else v


def ship_row(s):
    """Flache Zeile aus ship_summary (jeweils hoechstes Modul = Topkonfig)."""
    hull, art, torp = _last(s["hulls"]), _last(s["artillery"]), _last(s["torpedoes"])
    he, ap, tp = _first_ammo(art, "HE"), _first_ammo(art, "AP"), _first_ammo(torp)
    cal = he.get("bulletDiametr") or ap.get("bulletDiametr")
    tdist = tp.get("maxDist")
    return {
        "name": s["name"], "display": s["display"], "index": s["index"], "id": s["id"],
        "tier": s["tier"], "nation": s["nation"], "class": s["class"], "group": s["group"],
        "hp": hull.get("health"), "speed_kn": hull.get("maxSpeed"),
        "detect_km": _r(hull.get("visibilityFactor")),
        "detect_air_km": _r(hull.get("visibilityFactorByPlane")),
        "rudder_s": _r(hull.get("rudderTime")),
        "guns": art.get("layout"),
        "caliber_mm": int(round(cal * 1000)) if isinstance(cal, (int, float)) else None,
        "gun_range_km": _r(art["max_dist_m"] / 1000) if art.get("max_dist_m") else None,
        "gun_reload_s": _r(art.get("reload_s")),
        "he_dmg": he.get("alphaDamage"), "he_fire": he.get("burnProb"),
        "ap_dmg": ap.get("alphaDamage"),
        "torp": torp.get("layout"), "torp_dmg": tp.get("alphaDamage"),
        # Torpedo-maxDist liegt in BigWorld-Einheiten (1 = 30 m)
        "torp_range_km": _r(tdist * 30 / 1000) if isinstance(tdist, (int, float)) else None,
        "torp_speed_kn": tp.get("speed"), "torp_reload_s": _r(torp.get("reload_s")),
    }


# --------------------------------------------------------------------------
# Suche / Pfad / Diff
# --------------------------------------------------------------------------


def walk(o, path=""):
    if isinstance(o, dict):
        for k, v in o.items():
            p = f"{path}.{k}" if path else str(k)
            yield p, k, v
            yield from walk(v, p)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            p = f"{path}[{i}]"
            yield p, str(i), v
            yield from walk(v, p)


def get_path(o, path):
    for part in re.findall(r"[^.\[\]]+", path):
        if isinstance(o, dict) and part in o:
            o = o[part]
        elif isinstance(o, list) and part.isdigit() and int(part) < len(o):
            o = o[int(part)]
        else:
            raise KeyError(part)
    return o


def deep_diff(a, b, path, out, tol, ignore):
    if ignore and path and ignore.search(path):
        return
    if isinstance(a, dict) and isinstance(b, dict):
        for k in list(a) + [k for k in b if k not in a]:
            p = f"{path}.{k}" if path else str(k)
            if ignore and ignore.search(p):
                continue
            if k not in b:
                out.append(("-", p, a[k], None))
            elif k not in a:
                out.append(("+", p, None, b[k]))
            else:
                deep_diff(a[k], b[k], p, out, tol, ignore)
    elif isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        for i, (x, y) in enumerate(zip(a, b)):
            deep_diff(x, y, f"{path}[{i}]", out, tol, ignore)
    else:
        num = (int, float)
        if isinstance(a, num) and isinstance(b, num) and not isinstance(a, bool) and not isinstance(b, bool):
            if abs(a - b) > tol:
                out.append(("~", path, a, b))
        elif a != b:
            out.append(("~", path, a, b))


# --------------------------------------------------------------------------
# Ausgabe
# --------------------------------------------------------------------------


def _cell(v):
    if v is None:
        return ""
    if isinstance(v, (dict, list)):
        return json.dumps(v, ensure_ascii=False)
    return str(v)


def emit_rows(rows, fmt, out=None):
    f = open(out, "w", encoding="utf-8", newline="") if out else sys.stdout
    try:
        if fmt == "json":
            json.dump(rows, f, ensure_ascii=False, indent=2)
            f.write("\n")
        elif fmt == "csv":
            if rows:
                w = csv.DictWriter(f, fieldnames=list(rows[0]), delimiter=";")
                w.writeheader()
                for r in rows:
                    w.writerow({k: _cell(v) for k, v in r.items()})
        else:
            if not rows:
                f.write("(keine Treffer)\n")
                return
            cols = [c for c in rows[0] if any(r.get(c) not in (None, "") for r in rows)]
            cells = [[_cell(r.get(c)) for c in cols] for r in rows]
            widths = [max(len(c), *(len(x[i]) for x in cells)) for i, c in enumerate(cols)]
            f.write("  ".join(c.ljust(w) for c, w in zip(cols, widths)).rstrip() + "\n")
            f.write("  ".join("-" * w for w in widths) + "\n")
            for x in cells:
                f.write("  ".join(v.ljust(w) for v, w in zip(x, widths)).rstrip() + "\n")
    finally:
        if out:
            f.close()


def dump_json(obj, out=None):
    text = json.dumps(obj, ensure_ascii=False, indent=2)
    if out:
        Path(out).write_text(text + "\n", encoding="utf-8")
    else:
        print(text)


def _short(v, n=120):
    s = json.dumps(v, ensure_ascii=False) if not isinstance(v, str) else repr(v)
    return s if len(s) <= n else s[: n - 3] + "..."


# --------------------------------------------------------------------------
# Befehle
# --------------------------------------------------------------------------


def _loc(a):
    return Localization(a.loc) if getattr(a, "loc", None) else None


def _need(gp, key):
    name = gp.resolve(key)
    if name is None:
        sys.exit(f"Eintrag nicht gefunden: {key}")
    return name


def cmd_types(a):
    gp = load_gameparams(a.file)
    c = Counter(gp.typeinfo(raw)[0::2] for _, raw in gp.root.items())
    rows = [{"type": t, "species": s, "count": n}
            for (t, s), n in sorted(c.items(), key=lambda x: (str(x[0][0]), str(x[0][1])))]
    emit_rows(rows, a.format, a.out)
    print(f"\n{len(gp)} Eintraege gesamt", file=sys.stderr)


def cmd_ships(a):
    gp, loc = load_gameparams(a.file), _loc(a)
    rows = []
    for name, raw in gp.iter("Ship", a.nation, a.cls, a.name):
        if a.tier and _get(raw, "level") not in a.tier:
            continue
        if a.group and _get(raw, "group") not in a.group:
            continue
        if a.exclude_group and _get(raw, "group") in a.exclude_group:
            continue
        rows.append(ship_row(ship_summary(gp, name, loc)))
    rows.sort(key=lambda r: (r["tier"] or 0, str(r["nation"]), str(r["class"]), str(r["name"])))
    emit_rows(rows, a.format, a.out)


def cmd_ship(a):
    gp = load_gameparams(a.file)
    name = _need(gp, a.key)
    dump_json(gp.entry(name) if a.raw else ship_summary(gp, name, _loc(a)), a.out)


def cmd_get(a):
    gp = load_gameparams(a.file)
    obj = gp.entry(_need(gp, a.key))
    if a.path:
        try:
            obj = get_path(obj, a.path)
        except KeyError as e:
            sys.exit(f"Pfad nicht gefunden: {e}")
    dump_json(obj, a.out)


def cmd_search(a):
    gp = load_gameparams(a.file)
    krx = re.compile(a.key, re.I) if a.key else None
    vrx = re.compile(a.value, re.I) if a.value else None
    if not (krx or vrx):
        sys.exit("--key und/oder --value angeben")
    hits = 0
    for name, raw in gp.iter(a.type, a.nation, a.species, a.name):
        for p, k, v in walk(to_plain(raw)):
            if krx and not krx.search(str(k)):
                continue
            if vrx and (isinstance(v, (dict, list)) or not vrx.search(str(v))):
                continue
            print(f"{name}\t{p}\t{_short(v)}")
            hits += 1
            if a.limit and hits >= a.limit:
                print(f"(Limit {a.limit} erreicht)", file=sys.stderr)
                return
    print(f"{hits} Treffer", file=sys.stderr)


def cmd_export(a):
    gp = load_gameparams(a.file)
    items = gp.iter(a.type, a.nation, a.species, a.name)
    n = 0
    if a.split:
        base = Path(a.split)
        for name, raw in items:
            t = gp.typeinfo(raw)[0] or "Unknown"
            d = base / re.sub(r"[^\w.-]", "_", str(t))
            d.mkdir(parents=True, exist_ok=True)
            fn = re.sub(r"[^\w.-]", "_", str(name)) + ".json"
            (d / fn).write_text(json.dumps(to_plain(raw), ensure_ascii=False, indent=2),
                                encoding="utf-8")
            n += 1
    else:
        f = open(a.out, "w", encoding="utf-8") if a.out else sys.stdout
        try:
            f.write("{")
            for name, raw in items:  # gestreamt, damit grosse Exporte wenig RAM brauchen
                f.write(("," if n else "") + "\n" + json.dumps(str(name), ensure_ascii=False)
                        + ": " + json.dumps(to_plain(raw), ensure_ascii=False,
                                            indent=a.indent))
                n += 1
            f.write("\n}\n")
        finally:
            if a.out:
                f.close()
    print(f"{n} Eintraege exportiert", file=sys.stderr)


def cmd_diff(a):
    old, new = load_gameparams(a.old), load_gameparams(a.new)
    ignore = re.compile(a.ignore) if a.ignore else None
    sel = lambda gp: dict(gp.iter(a.type, a.nation, a.species, a.name))
    o, n = sel(old), sel(new)
    report = {"added": [], "removed": [], "changed": {}}
    for name in [k for k in n if k not in o]:
        report["added"].append({"name": name, "typeinfo": n[name] and list(new.typeinfo(n[name]))})
    for name in [k for k in o if k not in n]:
        report["removed"].append({"name": name, "typeinfo": list(old.typeinfo(o[name]))})
    for name in o:
        if name not in n:
            continue
        changes = []
        deep_diff(to_plain(o[name]), to_plain(n[name]), "", changes, a.tolerance, ignore)
        if changes:
            report["changed"][name] = [{"op": op, "path": p, "old": x, "new": y}
                                       for op, p, x, y in changes]
    if a.format == "json":
        dump_json(report, a.out)
        return
    lines = []
    for e in report["added"]:
        lines.append(f"+ {e['name']}  {'/'.join(str(x) for x in e['typeinfo'])}")
    for e in report["removed"]:
        lines.append(f"- {e['name']}  {'/'.join(str(x) for x in e['typeinfo'])}")
    for name, ch in report["changed"].items():
        lines.append(f"~ {name}")
        for c in ch:
            if c["op"] == "~":
                lines.append(f"    {c['path']}: {_short(c['old'], 60)} -> {_short(c['new'], 60)}")
            else:
                v = c["new"] if c["op"] == "+" else c["old"]
                lines.append(f"    {c['op']} {c['path']}: {_short(v, 100)}")
    lines.append(f"\n{len(report['added'])} neu, {len(report['removed'])} entfernt, "
                 f"{len(report['changed'])} geaendert")
    text = "\n".join(lines) + "\n"
    if a.out:
        Path(a.out).write_text(text, encoding="utf-8")
    else:
        sys.stdout.write(text)


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def _tiers(s):
    out = set()
    for part in s.split(","):
        if "-" in part:
            lo, hi = part.split("-")
            out.update(range(int(lo), int(hi) + 1))
        else:
            out.add(int(part))
    return out


def build_parser():
    p = argparse.ArgumentParser(prog="wows_gp", description=__doc__.split("\n\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)

    def filters(sp, ship_only=False):
        sp.add_argument("--nation", help="z.B. Germany, USA, Japan, Pan_Asia")
        if not ship_only:
            sp.add_argument("--type", help="z.B. Ship, Projectile, Modernization, Crew, Ability")
            sp.add_argument("--species", help="z.B. Destroyer, Artillery, Torpedo")
        sp.add_argument("--name", help="Regex auf den Eintragsnamen")

    def output(sp, formats=("table", "csv", "json"), default="table"):
        sp.add_argument("--format", choices=formats, default=default)
        sp.add_argument("--out", help="Ausgabedatei statt stdout")

    sp = sub.add_parser("types", help="Eintragstypen zaehlen")
    sp.add_argument("file")
    output(sp)
    sp.set_defaults(func=cmd_types)

    sp = sub.add_parser("ships", help="Schiffstabelle")
    sp.add_argument("file")
    filters(sp, ship_only=True)
    sp.add_argument("--class", dest="cls", help="Destroyer, Cruiser, Battleship, AirCarrier, Submarine")
    sp.add_argument("--tier", type=_tiers, help="z.B. 10 oder 8-10 oder 5,7")
    sp.add_argument("--group", nargs="+", help="nur diese Gruppen (upgradeable, premium, special, ...)")
    sp.add_argument("--exclude-group", nargs="+", help="diese Gruppen ausschliessen")
    sp.add_argument("--loc", help="Pfad zu global.mo fuer Anzeigenamen")
    output(sp)
    sp.set_defaults(func=cmd_ships)

    sp = sub.add_parser("ship", help="Schiffsdetails")
    sp.add_argument("file")
    sp.add_argument("key", help="Name, Index (PGSB108) oder ID")
    sp.add_argument("--raw", action="store_true", help="kompletten Rohdatensatz ausgeben")
    sp.add_argument("--loc", help="Pfad zu global.mo")
    sp.add_argument("--out")
    sp.set_defaults(func=cmd_ship)

    sp = sub.add_parser("get", help="Eintrag/Pfad als JSON")
    sp.add_argument("file")
    sp.add_argument("key")
    sp.add_argument("path", nargs="?", help="z.B. A_Hull.health oder A_Artillery.HP_AGM_1.ammoList[0]")
    sp.add_argument("--out")
    sp.set_defaults(func=cmd_get)

    sp = sub.add_parser("search", help="Schluessel/Werte suchen")
    sp.add_argument("file")
    sp.add_argument("--key", help="Regex auf Schluesselnamen")
    sp.add_argument("--value", help="Regex auf Werte")
    sp.add_argument("--limit", type=int, default=500, help="max. Treffer (0 = unbegrenzt)")
    filters(sp)
    sp.set_defaults(func=cmd_search)

    sp = sub.add_parser("export", help="JSON-Export")
    sp.add_argument("file")
    sp.add_argument("--split", metavar="DIR", help="eine Datei pro Eintrag in DIR/<Typ>/")
    sp.add_argument("--indent", type=int, default=None)
    sp.add_argument("--out")
    filters(sp)
    sp.set_defaults(func=cmd_export)

    sp = sub.add_parser("diff", help="zwei Versionen vergleichen")
    sp.add_argument("old")
    sp.add_argument("new")
    sp.add_argument("--tolerance", type=float, default=1e-6, help="Toleranz fuer Zahlen")
    sp.add_argument("--ignore", help="Regex auf Pfade, die ignoriert werden")
    filters(sp)
    output(sp, ("text", "json"), "text")
    sp.set_defaults(func=cmd_diff)
    return p


def main(argv=None):
    a = build_parser().parse_args(argv)
    try:
        a.func(a)
    except BrokenPipeError:
        pass


if __name__ == "__main__":
    main()
