#!/usr/bin/env python3
"""GameParams.data -> web/data/ships.json für die Seite (armoury.starbane.de).

Aufruf (aus dem Repo-Wurzelordner):
    python3 -I tools/wows_gp/export_web.py data/<build>/GameParams.data --build 15.9 \
        --loc-de data/<build>/de/global.mo --loc-en data/<build>/en/global.mo --out web/data/ships.json

    --compare web/data/api-reference.json   Standard-Konfiguration gegen Werte der WG-API prüfen
                                            (Abbruch mit Fehlercode bei Abweichungen)

Regeln:
- Nur öffentlich gelistete Schiffe (Gruppen wie in der WG-Enzyklopädie), keine Event-, Hilfs- oder
  entfernten Schiffe.
- Testschiffe (demoWithoutStats*) stehen ohne Werte in der Datei: Wargaming zeigt sie öffentlich
  ausdrücklich ohne Werte, Supertest-Daten veröffentlichen wir nicht.
- Werte der Top-Konfiguration (jeweils das am weitesten erforschte Modul), ohne Kommandanten und Upgrades.
"""
import argparse
import datetime
import json
import math
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import wows_gp as w  # noqa: E402

NATIONS = {
    "USA": "usa", "Japan": "japan", "Germany": "germany", "Russia": "ussr", "United_Kingdom": "uk",
    "France": "france", "Italy": "italy", "Pan_Asia": "pan_asia", "Europe": "europe",
    "Pan_America": "pan_america", "Netherlands": "netherlands", "Commonwealth": "commonwealth", "Spain": "spain",
}
NATION_NAMES = {
    "de": {"usa": "USA", "japan": "Japan", "germany": "Deutschland", "ussr": "UdSSR", "uk": "GB", "france": "Frankreich",
           "italy": "Italien", "pan_asia": "Panasien", "europe": "Europa", "pan_america": "Panamerika",
           "netherlands": "Die Niederlande", "commonwealth": "Commonwealth", "spain": "Spanien"},
    "en": {"usa": "U.S.A.", "japan": "Japan", "germany": "Germany", "ussr": "U.S.S.R.", "uk": "U.K.", "france": "France",
           "italy": "Italy", "pan_asia": "Pan-Asia", "europe": "Europe", "pan_america": "Pan-America",
           "netherlands": "The Netherlands", "commonwealth": "Commonwealth", "spain": "Spain"},
}
TYPE_NAMES = {
    "de": {"Destroyer": "Zerstörer", "Cruiser": "Kreuzer", "Battleship": "Schlachtschiff", "AirCarrier": "Flugzeugträger", "Submarine": "U-Boot"},
    "en": {"Destroyer": "Destroyer", "Cruiser": "Cruiser", "Battleship": "Battleship", "AirCarrier": "Aircraft Carrier", "Submarine": "Submarine"},
}
# Gruppen, die auch die WG-Enzyklopädie listet (geprüft gegen Build 15.9: Schnittmenge vollständig)
TREE = {"start", "upgradeable", "superShip"}
PREMIUM = {"premium", "special", "specialUnsellable", "earlyAccess"}
SPECIAL = {"ultimate", "clan", "experimental", "coopOnly"}
TEST = {"demoWithoutStats", "demoWithoutStatsPrem"}
PUBLIC = TREE | PREMIUM | SPECIAL | TEST
BW = 30.0  # BigWorld-Einheit in Metern (Torpedo-Reichweite, Streuungsformel)
UC_KEY = {"_Hull": "hull", "_Artillery": "artillery", "_Torpedoes": "torpedoes", "_Engine": "engine", "_Suo": "fireControl"}


def rnd(x, n=0):
    """Kaufmännisch runden wie Math.round im Browser (Python round rundet 56,25 auf 56,2)."""
    v = math.floor(x * 10 ** n + 0.5) / 10 ** n
    return int(v) if n == 0 else v


def num(v, nd=None):
    v = w.to_plain(v)
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return rnd(v, nd) if nd is not None else v


def upgrades(raw):
    """Forschbare Module eines Schiffs: Name -> Datensatz (ucType, prev, components, nextShips)."""
    up = w._attrs(w._get(raw, "ShipUpgradeInfo")) or {}
    return {k: v for k, v in up.items() if w._attrs(v) is not None}


def depth(ups, name):
    d, cur, guard = 0, name, 0
    while cur and guard < 20:
        cur = w.to_plain(w._get(ups[cur], "prev")) if cur in ups else ""
        d += 1 if cur else 0
        guard += 1
    return d


def pick_config(raw, top=True):
    """Je Modultyp das tiefste (top) oder das Ausgangsmodul (Standard); liefert Modulnamen je Komponente."""
    ups = upgrades(raw)
    chosen = {}
    for name, u in ups.items():
        uc = w.to_plain(w._get(u, "ucType"))
        if uc not in UC_KEY:
            continue
        d = depth(ups, name)
        if uc not in chosen or (d > chosen[uc][1] if top else d < chosen[uc][1]):
            chosen[uc] = (name, d)
    comps = {}
    hull = ups[chosen["_Hull"][0]] if "_Hull" in chosen else None
    hull_c = w.to_plain(w._get(hull, "components")) or {} if hull is not None else {}
    for key in ("hull", "airDefense", "atba", "artillery", "torpedoes", "engine", "fireControl"):
        comps[key] = list(hull_c.get(key) or [])
    for uc, (name, _) in chosen.items():
        key = UC_KEY[uc]
        own = (w.to_plain(w._get(ups[name], "components")) or {}).get(key) or []
        # Modul passend zum gewählten Rumpf, sonst das erste des Moduls
        both = [m for m in own if m in comps.get(key, [])] if key in ("artillery", "torpedoes") else own
        if both or own:
            comps[key] = both or own
    return {k: (v[0] if v else None) for k, v in comps.items()}


def mounts(module):
    return [v for v in (w._attrs(module) or {}).values() if w._attrs(v) is not None and w._get(v, "ammoList") is not None]


def gun_stats(gp, module, dist_coef=1.0):
    ms = mounts(module)
    if not ms:
        return None
    m0 = ms[0]
    # Feuerleitsystem verlängert die Reichweite (maxDistCoef, z. B. 1,1 = +10 %)
    rng = num(w._get(module, "maxDist"))
    rng = rng * dist_coef if rng else rng
    rot = w.to_plain(w._get(m0, "rotationSpeed"))
    rot = rot[0] if isinstance(rot, list) and rot else rot
    disp = None
    ir, mr, idist = (num(w._get(m0, k)) for k in ("idealRadius", "minRadius", "idealDistance"))
    if rng and ir is not None and mr is not None and idist:
        disp = rnd(((rng / BW) / idist * (ir - mr) + mr) * BW)
    shells = {}
    for name in w.to_plain(w._get(m0, "ammoList")) or []:
        p = gp.raw(name)
        if p is None:
            continue
        t = w.to_plain(w._get(p, "ammoType"))
        if t in shells:
            continue
        burn = num(w._get(p, "burnProb"))  # negativ = keine Brandchance (Platzhalter im Spiel)
        shells[t] = {"dmg": num(w._get(p, "alphaDamage")), "speed": num(w._get(p, "bulletSpeed")),
                     "burn": rnd(burn * 100, 1) if burn and burn > 0 else None,
                     "pen": num(w._get(p, "alphaPiercingHE")) if t == "HE" else num(w._get(p, "alphaPiercingCS")) if t == "CS" else None}
    cal = num(w._get(m0, "barrelDiameter"))
    return {
        "caliber": rnd(cal * 1000) if cal else None,
        "barrels": sum(num(w._get(m, "numBarrels")) or 1 for m in ms),
        "mounts": len(ms),
        "reload": num(w._get(m0, "shotDelay"), 2),
        "range": rnd(rng / 1000, 2) if rng else None,
        "turn180": rnd(180 / rot, 1) if rot else None,
        "disp": disp,
        "he": shells.get("HE"), "ap": shells.get("AP"), "sap": shells.get("CS"),
    }


def torp_stats(gp, module):
    ms = mounts(module)
    if not ms:
        return None
    p = gp.raw((w.to_plain(w._get(ms[0], "ammoList")) or [None])[0])
    if p is None:
        return None
    alpha, dmg = num(w._get(p, "alphaDamage")) or 0, num(w._get(p, "damage")) or 0
    rng = num(w._get(p, "maxDist"))
    return {
        "tubes": sum(num(w._get(m, "numBarrels")) or 1 for m in ms),
        "reload": num(w._get(ms[0], "shotDelay"), 1),
        "range": rnd(rng * BW / 1000, 1) if rng else None,
        # Schadensanzeige im Spiel: alphaDamage / 3 + damage
        "dmg": rnd(alpha / 3 + dmg) if alpha else None,
        "speed": num(w._get(p, "speed")),
        "seen": num(w._get(p, "visibilityFactor"), 2),
    }


def aa_stats(raw, comps):
    """Flak-Zonen aus Flugabwehr, Hauptbatterie und Sekundärgeschützen: {far|medium|near: [Reichweite km, DPS, Trefferchance %]}."""
    zones = {}
    for key in ("airDefense", "artillery", "atba"):
        mod = w._get(raw, comps.get(key)) if comps.get(key) else None
        for k, v in (w._attrs(mod) or {}).items():
            if not str(k).startswith("Aura") or w._attrs(v) is None:
                continue
            dps, rng = num(w._get(v, "areaDamage")) or 0, num(w._get(v, "maxDistance")) or 0
            if dps <= 0 or rng <= 0:
                continue
            z = zones.setdefault(w.to_plain(w._get(v, "type")) or k, [0, 0, 0])
            z[0] = max(z[0], rng)
            z[1] += dps
            z[2] = max(z[2], rnd((num(w._get(v, "hitChance")) or 0) * 100))
    return {k: [rnd(r / 1000, 1), rnd(d), h] for k, (r, d, h) in zones.items()} or None


def hull_stats(raw, hull_name):
    h = w._get(raw, hull_name) if hull_name else None
    if h is None:
        return {}
    return {
        "hp": num(w._get(h, "health")), "speed": num(w._get(h, "maxSpeed")),
        "turn": num(w._get(h, "turningRadius")), "rudder": num(w._get(h, "rudderTime"), 1),
        "seen": num(w._get(h, "visibilityFactor"), 2), "air": num(w._get(h, "visibilityFactorByPlane"), 2),
    }


def ship_stats(gp, raw, top=True):
    c = pick_config(raw, top)
    p = hull_stats(raw, c.get("hull"))
    art = w._get(raw, c["artillery"]) if c.get("artillery") else None
    tor = w._get(raw, c["torpedoes"]) if c.get("torpedoes") else None
    atba = w._get(raw, c["atba"]) if c.get("atba") else None
    fc = w._get(raw, c["fireControl"]) if c.get("fireControl") else None
    eng = w._get(raw, c["engine"]) if c.get("engine") else None
    if p.get("speed") is not None:
        p["speed"] = rnd(p["speed"] * (1 + (num(w._get(eng, "speedCoef")) or 0)), 2)
    p["gun"] = gun_stats(gp, art, num(w._get(fc, "maxDistCoef")) or 1.0) if art is not None else None
    p["torp"] = torp_stats(gp, tor) if tor is not None else None
    p["aa"] = aa_stats(raw, c)
    sec = num(w._get(atba, "maxDist")) if atba is not None else None
    p["sec"] = rnd(sec / 1000, 1) if sec else None
    return p


def empty_stats():
    return {"hp": None, "speed": None, "turn": None, "rudder": None, "seen": None, "air": None,
            "gun": None, "torp": None, "aa": None, "sec": None}


def research(gp, raw, ids):
    """Nachfolger mit EP und Modulbaum im Format der Seite."""
    ups = upgrades(raw)
    children = {}
    for name, u in ups.items():
        prev = w.to_plain(w._get(u, "prev"))
        if prev:
            children.setdefault(prev, []).append(name)
    mods, nxt = [], {}
    for name, u in ups.items():
        unit = gp.raw(name)
        xp = num(w._get(unit, "costXP")) if unit is not None else None
        cr = num(w._get(unit, "costCR")) if unit is not None else None
        ships = []
        for sn in w.to_plain(w._get(u, "nextShips")) or []:
            target = gp.raw(sn)
            tid = w.to_plain(w._get(target, "id")) if target is not None else None
            if tid in ids:
                ships.append(tid)
                nxt[str(tid)] = num(w._get(w._get(target, "ShipUpgradeInfo"), "costXP")) or 0
        prev = w.to_plain(w._get(u, "prev"))
        mods.append([name, xp or 0, cr or 0, ships, children.get(name, []), not prev and not xp])
    return nxt, mods


def build(gp, loc_de, loc_en, build_name, icons_dir=None):
    raws = [(n, r) for n, r in gp.iter(type_="Ship") if w.to_plain(w._get(r, "group")) in PUBLIC]
    ids = {w.to_plain(w._get(r, "id")) for _, r in raws}
    ships = []
    for name, raw in raws:
        t, nation, species = gp.typeinfo(raw)
        group = w.to_plain(w._get(raw, "group"))
        sid = w.to_plain(w._get(raw, "id"))
        nat = NATIONS.get(nation) or NATIONS.get(str(w.to_plain(w._get(raw, "navalFlag")) or "").title())
        if nat is None or species not in TYPE_NAMES["en"]:
            continue
        info = w._get(raw, "ShipUpgradeInfo")
        nxt, mods = research(gp, raw, ids)
        test = group in TEST
        name_en = loc_en.ship_name(raw) if loc_en else None
        ships.append({
            "id": sid, "name": name_en or str(w.to_plain(w._get(raw, "index"))),
            "nameDe": (loc_de.ship_name(raw) if loc_de else None) or None,
            "nation": nat, "type": species, "tier": num(w._get(raw, "level")),
            "prem": group in PREMIUM or group == "demoWithoutStatsPrem", "special": group in SPECIAL, "test": test,
            "credit": num(w._get(info, "costCR")) or None, "gold": num(w._get(info, "costGold")) or None,
            "next": nxt, "mods": mods,
            "p": empty_stats() if test else ship_stats(gp, raw, top=True),
            "img": bool(icons_dir and (icons_dir / f"{sid}.webp").exists()),
        })
    ships.sort(key=lambda s: (s["tier"], s["name"]))
    return {
        "source": "GameParams", "version": build_name, "built": datetime.date.today().isoformat(),
        "config": "top", "nations": NATION_NAMES, "types": TYPE_NAMES, "ships": ships,
    }


# ---------- Shipbuilder: alle Module je Schiff, Upgrades je Slot ----------
# Modifikatoren, die die Seite auf Werte anwendet (alle anderen erscheinen nur als Text)
APPLIED = {"GMShotDelay", "GMRotationSpeed", "GMMaxDist", "GMIdealRadius", "SGRudderTime", "visibilityDistCoeff",
           "GTShotDelay", "torpedoSpeedMultiplier", "torpedoRangeCoefficient", "torpedoDamageCoeff", "GSMaxDist",
           "AAAuraDamage", "healthHullCoeff", "GMAPDamageCoeff", "GMDamageCoeff", "speedCoef"}


# Eigene Texte für wichtige Effekte, für die das Spiel keinen eigenen Text mitliefert
LABEL_FALLBACK = {
    "burnChanceGMGSMultiplier": {"de": "Brandchance von Haupt- und Sekundärbatterie", "en": "Main and secondary battery fire chance"},
    "healthRegenPercent": {"de": "Regeneration der Lebenspunkte", "en": "Hit point regeneration"},
}


def text(loc, key):
    v = loc.get(key) if loc else None
    return v.replace("-\n", "").replace("\n", " ").strip() if v else None


def both(loc_de, loc_en, key, fallback):
    return {"de": text(loc_de, key) or fallback, "en": text(loc_en, key) or fallback}


def aura_zones(mod):
    zones = {}
    for k, v in (w._attrs(mod) or {}).items():
        if not str(k).startswith("Aura") or w._attrs(v) is None:
            continue
        dps, rng = num(w._get(v, "areaDamage")) or 0, num(w._get(v, "maxDistance")) or 0
        if dps > 0 and rng > 0:
            zones.setdefault(w.to_plain(w._get(v, "type")) or k, []).append([rng, dps, rnd((num(w._get(v, "hitChance")) or 0) * 100)])
    return zones


def raw_gun(gp, module):
    """Geschützwerte ohne Feuerleitsystem und Upgrades; der Browser rechnet Reichweite und Streuung."""
    g = gun_stats(gp, module)
    if not g:
        return None
    m0 = mounts(module)[0]
    rot = w.to_plain(w._get(m0, "rotationSpeed"))
    g.update({"rangeM": num(w._get(module, "maxDist")), "rot": rot[0] if isinstance(rot, list) else rot,
              "ir": num(w._get(m0, "idealRadius")), "mr": num(w._get(m0, "minRadius")), "idist": num(w._get(m0, "idealDistance")),
              "aura": aura_zones(module)})
    return g


def module_options(gp, raw, loc_de, loc_en):
    ups = upgrades(raw)
    opts = {k: [] for k in ("hull", "artillery", "torpedoes", "engine", "fireControl")}
    for name, u in ups.items():
        key = UC_KEY.get(w.to_plain(w._get(u, "ucType")))
        if not key:
            continue
        comps = w.to_plain(w._get(u, "components")) or {}
        o = {"u": name, "n": both(loc_de, loc_en, "IDS_" + name.upper(), name), "d": depth(ups, name)}
        if key == "hull":
            h = (comps.get("hull") or [None])[0]
            hs = hull_stats(raw, h)
            ad = w._get(raw, (comps.get("airDefense") or [None])[0]) if comps.get("airDefense") else None
            atba = w._get(raw, (comps.get("atba") or [None])[0]) if comps.get("atba") else None
            sec = num(w._get(atba, "maxDist")) if atba is not None else None
            zones = aura_zones(ad)
            for zk, zl in aura_zones(atba).items():
                zones.setdefault(zk, []).extend(zl)
            o.update(hs, sec=rnd(sec / 1000, 1) if sec else None, aura=zones,
                     art=comps.get("artillery") or [], tor=comps.get("torpedoes") or [])
        elif key == "artillery":
            o["m"] = {m: raw_gun(gp, w._get(raw, m)) for m in comps.get("artillery") or [] if w._get(raw, m) is not None}
        elif key == "torpedoes":
            o["m"] = {m: torp_stats(gp, w._get(raw, m)) for m in comps.get("torpedoes") or [] if w._get(raw, m) is not None}
        elif key == "engine":
            o["speedCoef"] = num(w._get(w._get(raw, (comps.get("engine") or [None])[0]), "speedCoef")) or 0
        elif key == "fireControl":
            o["distCoef"] = num(w._get(w._get(raw, (comps.get("fireControl") or [None])[0]), "maxDistCoef")) or 1.0
        opts[key].append(o)
    for k in opts:
        opts[k].sort(key=lambda o: o["d"])
    return {k: v for k, v in opts.items() if v}


def skills_and_flags(gp, loc_de, loc_en, assets):
    """Kommandantenfähigkeiten (Raster und Texte aus der API, Modifikatoren aus GameParams) und Signale."""
    crews = [r for _, r in gp.iter(type_="Crew")]
    pool = max(crews, key=lambda r: len(w._attrs(w._get(r, "Skills")) or {})) if crews else None
    by_type = {}
    for key, v in (w._attrs(w._get(pool, "Skills")) or {}).items():
        by_type[w.to_plain(w._get(v, "skillType"))] = (key, v)
    skills = []
    for sid, a in sorted((assets or {}).get("skills", {}).items(), key=lambda x: int(x[0])):
        hit = by_type.get(int(sid))
        if not hit or not a.get("grid"):
            continue
        key, v = hit
        cond = w.to_plain(w._get(w._get(v, "LogicTrigger"), "modifiers")) or {}
        skills.append({"id": int(sid), "key": key, "t": a["name"], "grid": a["grid"], "perks": a["perks"],
                       "mods": w.to_plain(w._get(v, "modifiers")) or {}, "cond": bool(cond)})
    flags = []
    for n, r in gp.iter(type_="Exterior", species="Flags"):
        idx = str(w.to_plain(w._get(r, "index")) or str(n).split("_")[0])
        a = (assets or {}).get("flags", {}).get(idx)
        mods = w.to_plain(w._get(r, "modifiers")) or {}
        if not a or not mods:
            continue
        flags.append({"key": idx, "t": a["name"], "mods": mods})
    flags.sort(key=lambda f: f["key"])
    return skills, flags


def consumables(gp, raw, loc_de, loc_en):
    """Verbrauchsmaterial je Slot: Varianten mit Ladungen (-1 = unbegrenzt), Ladezeit, Wirkdauer."""
    out = []
    for slot in sorted((w.to_plain(w._get(raw, "ShipAbilities")) or {}).values(), key=lambda x: x.get("slot", 0)):
        opts = []
        for name, var in slot.get("abils") or []:
            v = w._get(gp.raw(name), var)
            if v is None:
                continue
            key = "IDS_DOCK_CONSUME_TITLE_" + name.upper()
            opts.append({"a": name, "type": w.to_plain(w._get(v, "consumableType")),
                         "t": both(loc_de, loc_en, key, name),
                         "n": num(w._get(v, "numConsumables")) if num(w._get(v, "numConsumables")) is not None else (-1 if w.to_plain(w._get(v, "numConsumables")) == -1 else None),
                         "reload": num(w._get(v, "reloadTime")), "work": num(w._get(v, "workTime"))})
        if opts:
            out.append(opts)
    return out


def consumable_keys(types):
    """Modifikatoren, die Verbrauchsmaterial eindeutig verändern (allgemein und je Art)."""
    keys = {"ConsumableReloadTime", "ConsumablesWorkTime", "additionalConsumables"}
    for t in types:
        keys |= {t + "ReloadCoeff", t + "WorkTimeCoeff", t + "AdditionalConsumables"}
    return keys


def build_builder(gp, data, loc_de, loc_en, assets=None):
    mods = [(str(n), r) for n, r in gp.iter(type_="Modernization")]
    upg = []
    for n, m in mods:
        icon = n.split("_")[0]
        upg.append({"name": n, "icon": icon if (assets or {}).get("upgrades", {}).get(icon) else None,
                    "slot": num(w._get(m, "slot")), "type": num(w._get(m, "type")),
                    "t": both(loc_de, loc_en, "IDS_TITLE_" + n.upper(), n),
                    "mods": w.to_plain(w._get(m, "modifiers")) or {}})
    skills, flags = skills_and_flags(gp, loc_de, loc_en, assets)
    keys = sorted({k for u in upg for k in u["mods"]} | {k for x in skills + flags for k in x["mods"]})
    labels = {}
    for k in keys:
        # Viele Texte liegen je Schiffsklasse vor (…_DESTROYER); ohne Spieltext bleibt der Effekt unbeschriftet
        for suffix in ("", "_DESTROYER", "_CRUISER", "_BATTLESHIP", "_AIRCARRIER", "_SUBMARINE"):
            key = "IDS_PARAMS_MODIFIER_" + k.upper() + suffix
            if text(loc_en, key) or text(loc_de, key):
                labels[k] = both(loc_de, loc_en, key, k)
                break
        else:
            if k in LABEL_FALLBACK:
                labels[k] = LABEL_FALLBACK[k]
    ships = {}
    for s in data["ships"]:
        if s["test"]:
            continue
        name = gp.resolve(str(s["id"]))
        raw = gp.root[name]
        t, nat, sp = gp.typeinfo(raw)
        lvl, grp = num(w._get(raw, "level")), w.to_plain(w._get(raw, "group"))
        slots = [[] for _ in range(6)]
        for i, (n, m) in enumerate(mods):
            P = lambda k: w.to_plain(w._get(m, k)) or []
            if str(name) in P("excludes"):
                continue
            if str(name) in P("ships") or (lvl in P("shiplevel") and sp in P("shiptype") and nat in P("nation") and grp in P("group")):
                sl = num(w._get(m, "slot"))
                if sl is not None and 0 <= sl < 6:
                    slots[sl].append(i)
        ships[str(s["id"])] = {"o": module_options(gp, raw, loc_de, loc_en), "up": slots, "c": consumables(gp, raw, loc_de, loc_en)}
    ctypes = {o["type"] for sb in ships.values() for slot in sb["c"] for o in slot if o["type"]}
    applied = APPLIED | {k for k in consumable_keys(ctypes) if k in keys}
    return {"version": data["version"], "applied": sorted(applied), "labels": labels, "upgrades": upg,
            "skills": skills, "flags": flags, "ships": ships}


def compare(gp, data, ref_path):
    """Standard-Konfiguration gegen die WG-API prüfen; gibt die Zahl der Abweichungen zurück."""
    ref = {s["id"]: s for s in json.loads(pathlib.Path(ref_path).read_text())["ships"]}
    # Geschwindigkeit nicht prüfen: die API liefert für viele ältere Schlachtschiffe zu niedrige Werte
    # (Kongō 24,9 statt 30 kn, Bismarck 28,5 statt 31 kn); GameParams entspricht den Werten im Spiel.
    checks = {"hp": 0, "turn": 1, "seen": 0.06}  # API rundet auf 0,1 km
    bad, n = [], 0
    for s in data["ships"]:
        r = ref.get(s["id"])
        if not r or s["test"]:
            continue
        stock = ship_stats(gp, gp.raw(str(s["id"])), top=False)
        n += 1
        for k, tol in checks.items():
            a, b = stock.get(k), r["p"].get(k)
            if a is not None and b is not None and abs(a - b) > tol:
                bad.append(f"{s['name']}: {k} {a} != API {b}")
        if r["p"].get("gun") and stock.get("gun") and abs((stock["gun"]["range"] or 0) - (r["p"]["gun"]["range"] or 0)) > 0.1:
            bad.append(f"{s['name']}: gun.range {stock['gun']['range']} != API {r['p']['gun']['range']}")
        for to, xp in s["next"].items():
            if str(to) in r["next"] and r["next"][str(to)] != xp:
                bad.append(f"{s['name']}: EP nach {to} {xp} != API {r['next'][str(to)]}")
    missing = sorted(set(ref) - {s["id"] for s in data["ships"]})
    print(f"Geprüft: {n} Schiffe, Abweichungen: {len(bad)}, nur in der API: {len(missing)}")
    for line in bad[:40]:
        print("  " + line)
    return len(bad) + len(missing)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("gameparams")
    ap.add_argument("--build", required=True, help="Spielversion, z. B. 15.9")
    ap.add_argument("--loc-de")
    ap.add_argument("--loc-en")
    ap.add_argument("--out", default="web/data/ships.json")
    ap.add_argument("--icons", default="web/assets/img/ships")
    ap.add_argument("--builder-out", default="web/data/builder.json", help="Daten für den Shipbuilder")
    ap.add_argument("--assets", default="web/data/api-assets.json", help="Icons und Texte aus der WG-API (scripts/build-data.mjs)")
    ap.add_argument("--compare", help="ships.json aus der WG-API als Referenz")
    ap.add_argument("--max-diff", type=int, default=0, help="erlaubte Abweichungen bei --compare")
    a = ap.parse_args(argv)
    gp = w.load_gameparams(a.gameparams)
    loc_de = w.Localization(a.loc_de) if a.loc_de else None
    loc_en = w.Localization(a.loc_en) if a.loc_en else None
    data = build(gp, loc_de, loc_en, a.build, pathlib.Path(a.icons))
    if a.compare:
        diffs = compare(gp, data, a.compare)
        if diffs > a.max_diff:
            print(f"Abbruch: {diffs} Abweichungen (erlaubt {a.max_diff}). Nichts geschrieben.", file=sys.stderr)
            return 1
    out = pathlib.Path(a.out)
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(data['ships'])} Schiffe -> {out} ({out.stat().st_size / 1e6:.2f} MB)")
    bout = pathlib.Path(a.builder_out)
    assets_path = pathlib.Path(a.assets)
    assets = json.loads(assets_path.read_text()) if assets_path.exists() else None
    bout.write_text(json.dumps(build_builder(gp, data, loc_de, loc_en, assets), ensure_ascii=False, separators=(",", ":")))
    print(f"Shipbuilder -> {bout} ({bout.stat().st_size / 1e6:.2f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
