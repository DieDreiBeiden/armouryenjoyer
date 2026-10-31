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
    "tab.aria": "Bereiche", "tab.tree": "Techbaum", "tab.compare": "Vergleich",
    "msg.loading": "Schiffsdaten werden geladen …",
    "msg.loadFailed": "Schiffsdaten konnten nicht geladen werden. Prüf die Verbindung und lade die Seite neu.",

    "tree.title": "Techbaum",
    "tree.lede": "Wähle eine Nation. Klick auf ein Schiff zeigt seine Werte; mit „Als Start“ und „Als Ziel“ rechnest du die Forschungskosten zwischen zwei Schiffen.",
    "tree.nation": "Nation", "tree.type": "Schiffsklasse", "tree.allTypes": "Alle Klassen",
    "tree.hint": "Der Baum lässt sich seitlich scrollen. Werte gelten für die Standardausrüstung.",
    "tree.empty": "Für diese Auswahl gibt es keinen Forschungsbaum.",
    "tree.node": "{name}, Stufe {tier}, {type}",
    "data.info": "{n} Schiffe · Stand {date}",

    "detail.title": "Schiff",
    "detail.empty": "Klick im Techbaum auf ein Schiff.",
    "detail.premium": "Premium", "detail.special": "Sonderschiff", "detail.test": "Testschiff",
    "detail.price": "Preis", "detail.unlock": "Freischalten ab {name}",
    "detail.setFrom": "Als Start", "detail.setTo": "Als Ziel", "detail.compare": "Zum Vergleich",
    "detail.inCompare": "Im Vergleich",

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
    "cmp.note": "Werte aus der Wargaming-Enzyklopädie für die Standardausrüstung (ohne erforschte Module, Kommandanten und Upgrades). Flugabwehr als Wertung von 0 bis 100.",

    "g.general": "Allgemein", "g.survival": "Überleben und Bewegung", "g.guns": "Hauptbatterie", "g.torps": "Torpedos", "g.other": "Weiteres",
    "r.tier": "Stufe", "r.type": "Klasse", "r.nation": "Nation", "r.price": "Preis", "r.mm": "Gegner-Stufen",
    "r.hp": "Lebenspunkte", "r.armor": "Panzerung", "r.speed": "Höchstgeschwindigkeit", "r.turn": "Wendekreis", "r.rudder": "Ruderstellzeit",
    "r.seen": "Sichtbarkeit von Schiffen", "r.air": "Sichtbarkeit aus der Luft",
    "r.gun": "Geschütz", "r.barrels": "Rohre", "r.reload": "Nachladezeit", "r.range": "Reichweite", "r.turn180": "Drehzeit 180°", "r.disp": "Größte Streuung",
    "r.he": "HE-Schaden", "r.burn": "Brandchance HE", "r.ap": "AP-Schaden", "r.sap": "SAP-Schaden",
    "r.torp": "Torpedo", "r.tubes": "Rohre", "r.treload": "Nachladezeit", "r.trange": "Reichweite", "r.tdmg": "Schaden", "r.tspeed": "Geschwindigkeit", "r.tseen": "Sichtbarkeit",
    "r.aa": "Flugabwehr", "r.sec": "Reichweite Sekundär", "r.planes": "Flugzeuge",
    "u.km": "{v} km", "u.kn": "{v} kn", "u.m": "{v} m", "u.s": "{v} s", "u.mm": "{v} mm", "u.pct": "{v} %",
    "price.credit": "{v} Credits", "price.gold": "{v} Dublonen", "price.none": "nicht käuflich",

    "foot.data": "Daten: Wargaming-Enzyklopädie (EU), Spielversion {v}, abgerufen am {date}.",
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
    "tab.aria": "Sections", "tab.tree": "Tech tree", "tab.compare": "Compare",
    "msg.loading": "Loading ship data …",
    "msg.loadFailed": "Couldn't load ship data. Check your connection and reload the page.",

    "tree.title": "Tech tree",
    "tree.lede": "Pick a nation. Click a ship to see its stats; use “Set as start” and “Set as target” to get the research cost between two ships.",
    "tree.nation": "Nation", "tree.type": "Ship class", "tree.allTypes": "All classes",
    "tree.hint": "Scroll the tree sideways. Stats are for the stock configuration.",
    "tree.empty": "No research tree for this selection.",
    "tree.node": "{name}, tier {tier}, {type}",
    "data.info": "{n} ships · as of {date}",

    "detail.title": "Ship",
    "detail.empty": "Click a ship in the tech tree.",
    "detail.premium": "Premium", "detail.special": "Special", "detail.test": "Test ship",
    "detail.price": "Price", "detail.unlock": "Unlocked from {name}",
    "detail.setFrom": "Set as start", "detail.setTo": "Set as target", "detail.compare": "Add to compare",
    "detail.inCompare": "In comparison",

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
    "cmp.note": "Values from the Wargaming encyclopedia for the stock configuration (no researched modules, commanders or upgrades). AA as a rating from 0 to 100.",

    "g.general": "General", "g.survival": "Survivability and mobility", "g.guns": "Main battery", "g.torps": "Torpedoes", "g.other": "Other",
    "r.tier": "Tier", "r.type": "Class", "r.nation": "Nation", "r.price": "Price", "r.mm": "Enemy tiers",
    "r.hp": "Hit points", "r.armor": "Armor", "r.speed": "Top speed", "r.turn": "Turning circle", "r.rudder": "Rudder shift",
    "r.seen": "Detectability by ships", "r.air": "Detectability by air",
    "r.gun": "Gun", "r.barrels": "Barrels", "r.reload": "Reload", "r.range": "Range", "r.turn180": "180° traverse", "r.disp": "Max dispersion",
    "r.he": "HE damage", "r.burn": "HE fire chance", "r.ap": "AP damage", "r.sap": "SAP damage",
    "r.torp": "Torpedo", "r.tubes": "Tubes", "r.treload": "Reload", "r.trange": "Range", "r.tdmg": "Damage", "r.tspeed": "Speed", "r.tseen": "Detectability",
    "r.aa": "Anti-aircraft", "r.sec": "Secondary range", "r.planes": "Aircraft",
    "u.km": "{v} km", "u.kn": "{v} kn", "u.m": "{v} m", "u.s": "{v} s", "u.mm": "{v} mm", "u.pct": "{v}%",
    "price.credit": "{v} credits", "price.gold": "{v} doubloons", "price.none": "not for sale",

    "foot.data": "Data: Wargaming encyclopedia (EU), game version {v}, fetched {date}.",
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
