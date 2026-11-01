// Texte der Seite auf Deutsch und Englisch. LANG setzt boot.js (gespeicherte Wahl oder Browsersprache).
// Statische Texte stehen im HTML mit data-i18n (Text), data-i18n-html (mit Markup) und data-i18n-attr ("attr:key;…").

const I18N = {
  de: {
    "skip": "Zum Inhalt springen",
    "title": "Armoury · WoWs-Schiffsdaten",
    "brand.name": "Armoury",
    "eyebrow": "World of Warships · Version {v}",
    "lang.aria": "Sprache: Deutsch. Auf Englisch umschalten",
    "theme.dark": "Dunkel", "theme.light": "Hell", "theme.auto": "Automatisch",
    "theme.aria": "Farbschema: {name}. Klicken zum Wechseln",
    "tab.aria": "Bereiche", "tab.tree": "Techbaum", "tab.compare": "Vergleich", "tab.builder": "Shipbuilder",
    "b.title": "Shipbuilder", "b.share": "Link kopieren", "b.reset": "Zurücksetzen", "b.ship": "Schiff wählen",
    "b.pickTitle": "Ausrüstung", "b.modules": "Module", "b.upgrades": "Upgrades", "b.stats": "Werte", "b.captain": "Kommandant", "b.signals": "Signale",
    "b.colStat": "Wert", "b.colBase": "Standard", "b.colBuild": "Build", "b.colDelta": "Änderung", "b.onlyChanged": "Nur Änderungen",
    "b.slot": "Slot {n}", "b.empty": "leer", "b.none": "Kein Upgrade", "b.applied": "in den Werten berücksichtigt",
    "b.better": "besser", "b.worse": "schlechter", "b.noChanges": "Noch keine Änderung. Wähle Module, Upgrades, Fähigkeiten oder Signale.",
    "b.points": "{n} / {max} Punkte", "b.flagCount": "{n} / {max}", "b.cost": "{n} Punkte",
    "b.cond": "wirkt nur unter Bedingungen, nicht eingerechnet",
    "b.skillDep": "Erst die Fähigkeiten der nächsthöheren Stufe entfernen, die darauf aufbauen.",
    "b.noPoints": "Nicht genug Punkte (höchstens 21).", "b.needTier": "Zuerst eine Fähigkeit der Stufe davor wählen.",
    "b.maxFlags": "Höchstens {n} Signale.",
    "b.loading": "Shipbuilder-Daten werden geladen …", "b.failed": "Shipbuilder-Daten konnten nicht geladen werden. Lade die Seite neu.",
    "b.pick": "Such oben nach einem Schiff oder öffne eines aus dem Techbaum.",
    "b.test": "Für Testschiffe veröffentlicht Wargaming noch keine Werte.",
    "b.copied": "Link kopiert.", "b.copyFailed": "Kopieren nicht möglich. Link: {url}",
    "b.open": "Im Builder öffnen",
    "b.consumables": "Verbrauchsmaterial", "b.c.n": "Ladungen", "b.c.work": "Wirkdauer", "b.c.reload": "Ladezeit",
    "b.note": "Eingerechnet sind nur Effekte mit ◆ (feste Werte von Upgrades, Fähigkeiten und Signalen, auch auf Verbrauchsmaterial). Bedingte Effekte und alle übrigen stehen als Text dabei.",
    "b.mod.hull": "Rumpf", "b.mod.artillery": "Hauptbatterie", "b.mod.torpedoes": "Torpedos", "b.mod.engine": "Antrieb", "b.mod.fireControl": "Feuerleitsystem",
    "msg.loading": "Schiffsdaten werden geladen …",
    "msg.loadFailed": "Schiffsdaten konnten nicht geladen werden. Prüf die Verbindung und lade die Seite neu.",

    "tree.title": "Techbaum",
    "tree.lede": "Wähle eine Nation. Klick auf ein Schiff zeigt seine Werte; mit „Als Start“ und „Als Ziel“ rechnest du die Forschungskosten zwischen zwei Schiffen.",
    "tree.nation": "Nation", "tree.type": "Schiffsklasse", "tree.allTypes": "Alle Klassen",
    "tree.hint": "Der Baum lässt sich seitlich scrollen. Werte gelten für die Top-Konfiguration (alle Module erforscht).",
    "tree.empty": "Für diese Auswahl gibt es keinen Forschungsbaum.",
    "tree.node": "{name}, Stufe {tier}, {type}",
    "data.info": "{n} Schiffe · Build {v}",

    "detail.title": "Schiff",
    "detail.empty": "Klick im Techbaum auf ein Schiff.",
    "detail.premium": "Premium", "detail.special": "Sonderschiff", "detail.test": "Testschiff",
    "detail.price": "Preis", "detail.unlock": "Freischalten ab {name}",
    "detail.setFrom": "Als Start", "detail.setTo": "Als Ziel", "detail.compare": "Zum Vergleich",
    "detail.inCompare": "Im Vergleich",
    "detail.noStats": "Werte", "detail.noStatsText": "Testschiff: Wargaming veröffentlicht noch keine Werte",

    "cost.title": "Forschungskosten",
    "cost.lede": "Erfahrung und Credits vom Start- bis zum Zielschiff: Schiffe freischalten, nötige Module erforschen, Schiffe und Module kaufen.",
    "cost.from": "Von", "cost.to": "Bis",
    "cost.pick": "Wähle im Techbaum ein Start- und ein Zielschiff.",
    "cost.none": "Kein Forschungsweg von {from} nach {to}. Das Ziel muss im selben Zweig nach dem Start liegen.",
    "cost.xp": "Erfahrung gesamt", "cost.shipXp": "davon Schiffe", "cost.moduleXp": "davon Module",
    "cost.credits": "Credits", "cost.creditsSub": "Schiffe und Module kaufen",
    "cost.path": "Weg: {list}",
    "cost.swap": "Tauschen", "cost.reset": "Zurücksetzen",
    "cost.note": "Ohne Rabatte, Ausrüstung und Tarnungen; Module nur so weit, wie sie zum Freischalten des nächsten Schiffs nötig sind.",

    "extra.title": "Premium- und Sonderschiffe",
    "extra.count": "{n} Schiffe",
    "extra.empty": "Keine Premium- oder Sonderschiffe für diese Auswahl.",

    "cmp.title": "Schiffe vergleichen",
    "cmp.lede": "Bis zu sechs Schiffe nebeneinander. Der beste Wert jeder Zeile ist markiert.",
    "cmp.search": "Schiff hinzufügen", "cmp.searchPh": "Name eingeben, z. B. Yamato",
    "cmp.noHit": "Kein Schiff mit diesem Namen.",
    "cmp.full": "Höchstens sechs Schiffe. Entferne eines, um ein neues hinzuzufügen.",
    "cmp.remove": "{name} entfernen", "cmp.clear": "Alle entfernen",
    "cmp.empty": "Noch keine Schiffe gewählt. Such oben nach einem Namen oder nutze „Zum Vergleich“ im Techbaum.",
    "cmp.best": "bester Wert",
    "cmp.note": "Werte aus den Spieldateien (GameParams) für die Top-Konfiguration: jeweils das am weitesten erforschte Modul, ohne Kommandanten, Upgrades und Signale. Streuung bei maximaler Reichweite. Testschiffe ohne Werte.",

    "g.general": "Allgemein", "g.survival": "Überleben und Bewegung", "g.guns": "Hauptbatterie", "g.torps": "Torpedos", "g.aa": "Flugabwehr und Sekundär",
    "r.tier": "Stufe", "r.type": "Klasse", "r.nation": "Nation", "r.price": "Preis",
    "r.hp": "Lebenspunkte", "r.speed": "Höchstgeschwindigkeit", "r.turn": "Wendekreis", "r.rudder": "Ruderstellzeit",
    "r.seen": "Sichtbarkeit von Schiffen", "r.air": "Sichtbarkeit aus der Luft",
    "r.gun": "Geschütze", "r.reload": "Nachladezeit", "r.range": "Reichweite", "r.turn180": "Drehzeit 180°", "r.disp": "Streuung (max. Reichweite)",
    "r.he": "HE-Schaden", "r.burn": "Brandchance HE", "r.hepen": "Durchschlag HE", "r.hev": "Mündungsgeschw. HE", "r.ap": "AP-Schaden", "r.apv": "Mündungsgeschw. AP", "r.sap": "SAP-Schaden", "r.sappen": "Durchschlag SAP",
    "r.torp": "Torpedos", "r.tubes": "Rohre", "r.treload": "Nachladezeit", "r.trange": "Reichweite", "r.tdmg": "Schaden", "r.tspeed": "Geschwindigkeit", "r.tseen": "Sichtbarkeit",
    "r.aa": "Flugabwehr", "r.aa0": "Flak außen", "r.aa0r": "Reichweite außen", "r.aa1": "Flak Mitte", "r.aa1r": "Reichweite Mitte", "r.aa2": "Flak innen", "r.aa2r": "Reichweite innen", "r.sec": "Reichweite Sekundär",
    "v.gun": "{n} × {c} mm", "v.torp": "{n} Rohre, {r} km", "v.aa": "{d} DPS bis {r} km",
    "u.km": "{v} km", "u.kn": "{v} kn", "u.m": "{v} m", "u.s": "{v} s", "u.mm": "{v} mm", "u.pct": "{v} %", "u.ms": "{v} m/s", "u.dps": "{v} DPS",
    "price.credit": "{v} Credits", "price.gold": "{v} Dublonen", "price.none": "nicht käuflich",

    "foot.data": "Daten: Spieldateien (GameParams) von Build {v}, erstellt am {date}. Abgeglichen mit der Wargaming-Enzyklopädie.",
    "foot.legal": "Fanprojekt, nicht mit Wargaming verbunden. World of Warships und alle Schiffsbilder © Wargaming.net."
  },
  en: {
    "skip": "Skip to content",
    "title": "Armoury · WoWs ship data",
    "brand.name": "Armoury",
    "eyebrow": "World of Warships · Version {v}",
    "lang.aria": "Language: English. Switch to German",
    "theme.dark": "Dark", "theme.light": "Light", "theme.auto": "Auto",
    "theme.aria": "Color scheme: {name}. Click to change",
    "tab.aria": "Sections", "tab.tree": "Tech tree", "tab.compare": "Compare", "tab.builder": "Shipbuilder",
    "b.title": "Shipbuilder", "b.share": "Copy link", "b.reset": "Reset", "b.ship": "Pick a ship",
    "b.pickTitle": "Loadout", "b.modules": "Modules", "b.upgrades": "Upgrades", "b.stats": "Stats", "b.captain": "Commander", "b.signals": "Signals",
    "b.colStat": "Stat", "b.colBase": "Baseline", "b.colBuild": "Build", "b.colDelta": "Change", "b.onlyChanged": "Changes only",
    "b.slot": "Slot {n}", "b.empty": "empty", "b.none": "No upgrade", "b.applied": "included in the stats",
    "b.better": "better", "b.worse": "worse", "b.noChanges": "No changes yet. Pick modules, upgrades, skills or signals.",
    "b.points": "{n} / {max} points", "b.flagCount": "{n} / {max}", "b.cost": "{n} points",
    "b.cond": "only under conditions, not included",
    "b.skillDep": "Remove the next-tier skills that depend on it first.",
    "b.noPoints": "Not enough points (21 at most).", "b.needTier": "Pick a skill from the tier below first.",
    "b.maxFlags": "{n} signals at most.",
    "b.loading": "Loading shipbuilder data …", "b.failed": "Couldn't load shipbuilder data. Reload the page.",
    "b.pick": "Search for a ship above or open one from the tech tree.",
    "b.test": "Wargaming hasn't published stats for test ships yet.",
    "b.copied": "Link copied.", "b.copyFailed": "Couldn't copy. Link: {url}",
    "b.open": "Open in builder",
    "b.consumables": "Consumables", "b.c.n": "Charges", "b.c.work": "Action time", "b.c.reload": "Reload",
    "b.note": "Only effects marked ◆ are included (fixed values from upgrades, skills and signals, consumables included). Conditional and all other effects are listed as text.",
    "b.mod.hull": "Hull", "b.mod.artillery": "Main battery", "b.mod.torpedoes": "Torpedoes", "b.mod.engine": "Engine", "b.mod.fireControl": "Gun fire control",
    "msg.loading": "Loading ship data …",
    "msg.loadFailed": "Couldn't load ship data. Check your connection and reload the page.",

    "tree.title": "Tech tree",
    "tree.lede": "Pick a nation. Click a ship to see its stats; use “Set as start” and “Set as target” to get the research cost between two ships.",
    "tree.nation": "Nation", "tree.type": "Ship class", "tree.allTypes": "All classes",
    "tree.hint": "Scroll the tree sideways. Stats are for the top configuration (all modules researched).",
    "tree.empty": "No research tree for this selection.",
    "tree.node": "{name}, tier {tier}, {type}",
    "data.info": "{n} ships · build {v}",

    "detail.title": "Ship",
    "detail.empty": "Click a ship in the tech tree.",
    "detail.premium": "Premium", "detail.special": "Special", "detail.test": "Test ship",
    "detail.price": "Price", "detail.unlock": "Unlocked from {name}",
    "detail.setFrom": "Set as start", "detail.setTo": "Set as target", "detail.compare": "Add to compare",
    "detail.inCompare": "In comparison",
    "detail.noStats": "Stats", "detail.noStatsText": "Test ship: Wargaming hasn't published stats yet",

    "cost.title": "Research cost",
    "cost.lede": "XP and credits from the start ship to the target: unlock ships, research required modules, buy ships and modules.",
    "cost.from": "From", "cost.to": "To",
    "cost.pick": "Pick a start and a target ship in the tech tree.",
    "cost.none": "No research path from {from} to {to}. The target has to come after the start in the same branch.",
    "cost.xp": "Total XP", "cost.shipXp": "ships", "cost.moduleXp": "modules",
    "cost.credits": "Credits", "cost.creditsSub": "buying ships and modules",
    "cost.path": "Path: {list}",
    "cost.swap": "Swap", "cost.reset": "Reset",
    "cost.note": "Without discounts, equipment and camouflages; modules only as far as needed to unlock the next ship.",

    "extra.title": "Premium and special ships",
    "extra.count": "{n} ships",
    "extra.empty": "No premium or special ships for this selection.",

    "cmp.title": "Compare ships",
    "cmp.lede": "Up to six ships side by side. The best value in each row is marked.",
    "cmp.search": "Add ship", "cmp.searchPh": "Type a name, e.g. Yamato",
    "cmp.noHit": "No ship with that name.",
    "cmp.full": "Six ships at most. Remove one to add another.",
    "cmp.remove": "Remove {name}", "cmp.clear": "Remove all",
    "cmp.empty": "No ships picked yet. Search for a name above or use “Add to compare” in the tech tree.",
    "cmp.best": "best value",
    "cmp.note": "Values from the game files (GameParams) for the top configuration: the furthest researched module of each type, without commanders, upgrades and signals. Dispersion at maximum range. Test ships without stats.",

    "g.general": "General", "g.survival": "Survivability and mobility", "g.guns": "Main battery", "g.torps": "Torpedoes", "g.aa": "Anti-aircraft and secondaries",
    "r.tier": "Tier", "r.type": "Class", "r.nation": "Nation", "r.price": "Price",
    "r.hp": "Hit points", "r.speed": "Top speed", "r.turn": "Turning circle", "r.rudder": "Rudder shift",
    "r.seen": "Detectability by ships", "r.air": "Detectability by air",
    "r.gun": "Guns", "r.reload": "Reload", "r.range": "Range", "r.turn180": "180° traverse", "r.disp": "Dispersion (max range)",
    "r.he": "HE damage", "r.burn": "HE fire chance", "r.hepen": "HE penetration", "r.hev": "HE muzzle velocity", "r.ap": "AP damage", "r.apv": "AP muzzle velocity", "r.sap": "SAP damage", "r.sappen": "SAP penetration",
    "r.torp": "Torpedoes", "r.tubes": "Tubes", "r.treload": "Reload", "r.trange": "Range", "r.tdmg": "Damage", "r.tspeed": "Speed", "r.tseen": "Detectability",
    "r.aa": "Anti-aircraft", "r.aa0": "Long-range AA", "r.aa0r": "Long-range reach", "r.aa1": "Mid-range AA", "r.aa1r": "Mid-range reach", "r.aa2": "Short-range AA", "r.aa2r": "Short-range reach", "r.sec": "Secondary range",
    "v.gun": "{n} × {c} mm", "v.torp": "{n} tubes, {r} km", "v.aa": "{d} DPS up to {r} km",
    "u.km": "{v} km", "u.kn": "{v} kn", "u.m": "{v} m", "u.s": "{v} s", "u.mm": "{v} mm", "u.pct": "{v}%", "u.ms": "{v} m/s", "u.dps": "{v} DPS",
    "price.credit": "{v} credits", "price.gold": "{v} doubloons", "price.none": "not for sale",

    "foot.data": "Data: game files (GameParams) of build {v}, generated {date}. Cross-checked against the Wargaming encyclopedia.",
    "foot.legal": "Fan project, not affiliated with Wargaming. World of Warships and all ship images © Wargaming.net."
  }
};
const LOCALE = LANG === "de" ? "de-DE" : "en-GB";

function t(key, vars) {
  let s = (I18N[LANG] && I18N[LANG][key]) ?? I18N.de[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}

// Statische Texte im HTML setzen
function applyI18n(root = document) {
  document.documentElement.lang = LANG;
  document.title = t("title");
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const [attr, key] = pair.split(":");
      el.setAttribute(attr.trim(), t(key.trim()));
    }
  });
  document.documentElement.classList.remove("i18n-pending");
}
