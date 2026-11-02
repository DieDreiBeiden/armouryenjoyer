(() => {
"use strict";
const $ = (id) => document.getElementById(id);
const fmt = new Intl.NumberFormat(LOCALE);
const fmt1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const fmt2 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "★"];
const TYPE_SHORT = { Destroyer: "DD", Cruiser: "CA", Battleship: "BB", AirCarrier: "CV", Submarine: "SS" };
const TYPE_ORDER = ["Destroyer", "Cruiser", "Battleship", "AirCarrier", "Submarine"];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nameKey = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
// Dateien mit derselben Versionsnummer wie app.js laden (siehe ?v= in index.html)
const ASSET_V = document.currentScript ? new URL(document.currentScript.src).search : "";

const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem("armoury:" + k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { if (v === null || v === undefined) localStorage.removeItem("armoury:" + k); else localStorage.setItem("armoury:" + k, JSON.stringify(v)); } catch { /* ohne Speicher weiter */ } }
};

// ---------- Sprache und Farbschema ----------
applyI18n();
$("langBtn").textContent = LANG.toUpperCase();
$("langBtn").addEventListener("click", () => { store.set("lang", LANG === "de" ? "en" : "de"); location.reload(); });
const THEMES = ["dark", "light", "auto"];
function applyTheme(th) {
  if (th === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = th;
  const name = t("theme." + th);
  $("themeLabel").textContent = name;
  $("themeBtn").setAttribute("aria-label", t("theme.aria", { name }));
  const bg = getComputedStyle(document.body).backgroundColor;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.content = th === "auto" ? (m.media.includes("dark") ? "#08141c" : "#e6edf0") : bg; });
}
let theme = store.get("theme", "dark");
if (!THEMES.includes(theme)) theme = "dark";
$("themeBtn").addEventListener("click", () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  store.set("theme", theme);
  applyTheme(theme);
});
applyTheme(theme);

// ---------- Zustand ----------
let DATA = null, IDX = null;
const state = {
  nation: store.get("nation", "japan"),
  type: store.get("type", ""),
  sel: store.get("sel", null),
  from: store.get("from", null),
  to: store.get("to", null),
  cmp: store.get("cmp", [])
};
const ship = (id) => (IDX && IDX.byId.get(id)) || null;
const shipName = (s) => (LANG === "de" && s.nameDe) || s.name;
const nationName = (n) => (DATA.nations[LANG] && DATA.nations[LANG][n]) || n;
const typeName = (ty) => (DATA.types[LANG] && DATA.types[LANG][ty]) || ty;
const icon = (s, cls = "sicon") => `<img class="${cls}" src="assets/img/ships/${s.id}.webp" width="64" height="38" loading="lazy" decoding="async" alt="">`;
// Fehlende Bilder ausblenden (Ereignis fängt nur die Erfassungsphase)
document.addEventListener("error", (e) => { if (e.target.tagName === "IMG") e.target.classList.add("missing"); }, true);

// Vergleich: Einträge {id, b}, b = Build-Code (wie im geteilten Link) oder null; dasselbe Schiff darf mehrfach vorkommen
state.cmp = (Array.isArray(state.cmp) ? state.cmp : []).map((x) => (typeof x === "number" ? { id: x, b: null } : x))
  .filter((x) => x && typeof x.id === "number").map((x) => ({ id: x.id, b: typeof x.b === "string" ? x.b : null }));
const inCompare = (id) => state.cmp.some((e) => e.id === id);
function save() { for (const k of Object.keys(state)) store.set(k, state[k]); }

// ---------- Techbaum ----------
const CW = 150, RH = 84, NW = 132, NH = 72, HEAD = 26;
function renderFilters() {
  const nations = [...new Set(DATA.ships.filter((s) => !s.prem && !s.special).map((s) => s.nation))]
    .sort((a, b) => nationName(a).localeCompare(nationName(b), LOCALE));
  if (!nations.includes(state.nation)) state.nation = nations[0];
  $("nations").innerHTML = nations.map((n) => `<button type="button" class="chip" data-nation="${esc(n)}" aria-pressed="${n === state.nation}">${esc(nationName(n))}</button>`).join("");
  const types = TYPE_ORDER.filter((ty) => DATA.ships.some((s) => s.nation === state.nation && s.type === ty));
  if (state.type && !types.includes(state.type)) state.type = "";
  $("types").innerHTML = [["", t("tree.allTypes")]].concat(types.map((ty) => [ty, typeName(ty)]))
    .map(([ty, label]) => `<button type="button" class="chip" data-type="${ty}" aria-pressed="${ty === state.type}">${esc(label)}</button>`).join("");
}

function costPath() {
  if (!state.from || !state.to) return null;
  return researchCost(IDX, state.from, state.to);
}

function renderTree() {
  const L = layoutTree(DATA.ships, state.nation, state.type || null);
  const box = $("tree");
  if (!L.nodes.length) { box.style.width = ""; box.style.height = ""; box.innerHTML = `<p class="empty">${esc(t("tree.empty"))}</p>`; return; }
  const cost = costPath();
  const onPath = new Set(cost ? cost.path : []);
  const W = L.maxTier * CW, H = HEAD + L.rows * RH;
  const x = (col) => (col - 1) * CW + (CW - NW) / 2, y = (row) => HEAD + row * RH + (RH - NH) / 2;
  const pos = new Map(L.nodes.map((n) => [n.id, n]));
  let svg = "";
  for (const [a, b] of L.edges) {
    const p = pos.get(a), c = pos.get(b);
    const hot = onPath.has(a) && onPath.has(b) ? " hot" : "";
    const y1 = y(p.row) + NH / 2, y2 = y(c.row) + NH / 2, gap = (CW - NW) / 2;
    // Nachfolger auf derselben Stufe: Linie durch die Lücke links neben der Spalte
    const d = c.col > p.col ? `M${x(p.col) + NW},${y1} H${x(c.col) - gap} V${y2} H${x(c.col)}` : `M${x(p.col)},${y1} H${x(p.col) - gap} V${y2} H${x(c.col)}`;
    svg += `<path class="edge${hot}" d="${d}"/>`;
  }
  let heads = "";
  for (let tier = 1; tier <= L.maxTier; tier++) heads += `<span class="tier-head" style="left:${(tier - 1) * CW}px;width:${CW}px">${ROMAN[tier]}</span>`;
  const nodes = L.nodes.map((n) => {
    const s = ship(n.id);
    const cls = ["node", "t-" + TYPE_SHORT[s.type]];
    if (onPath.has(s.id)) cls.push("path");
    if (s.id === state.from) cls.push("from");
    if (s.id === state.to) cls.push("to");
    return `<button type="button" class="${cls.join(" ")}" data-id="${s.id}" aria-pressed="${s.id === state.sel}" aria-label="${esc(t("tree.node", { name: shipName(s), tier: s.tier, type: typeName(s.type) }))}" style="left:${x(n.col)}px;top:${y(n.row)}px">
      ${icon(s)}<span class="nm">${esc(shipName(s))}</span><span class="ty" aria-hidden="true">${TYPE_SHORT[s.type]}</span></button>`;
  }).join("");
  box.style.width = `${W}px`; box.style.height = `${H}px`;
  box.innerHTML = `${heads}<svg class="edges" width="${W}" height="${H}" aria-hidden="true">${svg}</svg>${nodes}`;
}

function renderExtra() {
  const list = DATA.ships.filter((s) => s.nation === state.nation && (s.prem || s.special) && (!state.type || s.type === state.type))
    .sort((a, b) => b.tier - a.tier || TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.name.localeCompare(b.name, "en"));
  $("extraCount").textContent = t("extra.count", { n: fmt.format(list.length) });
  if (!list.length) { $("extra").innerHTML = `<p class="empty">${esc(t("extra.empty"))}</p>`; return; }
  const tiers = [...new Set(list.map((s) => s.tier))];
  $("extra").innerHTML = tiers.map((tier) => `<div class="extra-tier"><span class="tier-label" aria-hidden="true">${ROMAN[tier]}</span><div class="extra-list">${
    list.filter((s) => s.tier === tier).map((s) => `<button type="button" class="mini-ship${s.special ? " special" : ""}" data-id="${s.id}" aria-pressed="${s.id === state.sel}" aria-label="${esc(t("tree.node", { name: shipName(s), tier: s.tier, type: typeName(s.type) }))}">${icon(s)}<span class="nm">${esc(shipName(s))}</span><span class="ty" aria-hidden="true">${TYPE_SHORT[s.type]}</span></button>`).join("")
  }</div></div>`).join("");
}

function priceText(s) {
  if (s.gold) return t("price.gold", { v: fmt.format(s.gold) });
  if (s.credit) return t("price.credit", { v: fmt.format(s.credit) });
  return t("price.none");
}

function renderDetail() {
  const s = ship(state.sel);
  if (!s) { $("detail").innerHTML = `<p class="empty">${esc(t("detail.empty"))}</p>`; return; }
  const tags = [s.prem && t("detail.premium"), s.special && t("detail.special"), s.test && t("detail.test")].filter(Boolean)
    .map((x) => `<span class="tag ex">${esc(x)}</span>`).join(" ");
  const prevs = (IDX.prev.get(s.id) || []).map((id) => ship(id)).filter(Boolean);
  const p = s.p, kv = [];
  const add = (k, v) => { if (v !== null && v !== undefined && v !== "") kv.push([k, v]); };
  add(t("detail.price"), priceText(s));
  for (const pr of prevs) add(t("detail.unlock", { name: shipName(pr) }), `${fmt.format(pr.next[s.id] || 0)} EP`);
  if (s.test) add(t("detail.noStats"), t("detail.noStatsText"));
  add(t("r.hp"), p.hp && fmt.format(p.hp));
  add(t("r.speed"), p.speed && t("u.kn", { v: fmt1.format(p.speed) }));
  add(t("r.seen"), p.seen && t("u.km", { v: fmt2.format(p.seen) }));
  if (p.gun) add(t("r.gun"), t("v.gun", { n: p.gun.barrels, c: p.gun.caliber }));
  if (p.gun) add(t("r.reload"), t("u.s", { v: fmt2.format(p.gun.reload) }));
  if (p.torp) add(t("r.torp"), t("v.torp", { n: p.torp.tubes, r: fmt1.format(p.torp.range) }));
  if (p.aa) add(t("r.aa"), AA_ZONES.filter((z) => p.aa[z]).map((z) => t("v.aa", { d: fmt.format(p.aa[z][1]), r: fmt1.format(p.aa[z][0]) })).join(" · "));
  const inCmp = inCompare(s.id);
  $("detail").innerHTML = `
    <div class="detail-head">${icon(s, "sicon big")}<div><div class="detail-name">${esc(shipName(s))}</div>
      <div class="mini">${esc(ROMAN[s.tier])} · ${esc(typeName(s.type))} · ${esc(nationName(s.nation))} ${tags}</div></div></div>
    <dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    <div class="row">
      <button type="button" id="setFrom" class="${state.from === s.id ? "" : "ghost"}" aria-pressed="${state.from === s.id}">${esc(t("detail.setFrom"))}</button>
      <button type="button" id="setTo" class="${state.to === s.id ? "" : "ghost"}" aria-pressed="${state.to === s.id}">${esc(t("detail.setTo"))}</button>
      <button type="button" id="addCmp" class="ghost"${inCmp ? " disabled" : ""}>${esc(t(inCmp ? "detail.inCompare" : "detail.compare"))}</button>
      ${s.test ? "" : `<button type="button" id="toBuild" class="ghost">${esc(t("b.open"))}</button>`}
    </div>`;
  $("setFrom").addEventListener("click", () => { state.from = state.from === s.id ? null : s.id; if (state.from === state.to) state.to = null; changed(); });
  $("setTo").addEventListener("click", () => { state.to = state.to === s.id ? null : s.id; if (state.from === state.to) state.from = null; changed(); });
  $("addCmp").addEventListener("click", () => { addCompare(s.id); });
  if ($("toBuild")) $("toBuild").addEventListener("click", () => openInBuilder(s.id));
}

function renderCost() {
  const a = ship(state.from), b = ship(state.to);
  $("costFrom").textContent = a ? `${ROMAN[a.tier]} ${shipName(a)}` : "–";
  $("costTo").textContent = b ? `${ROMAN[b.tier]} ${shipName(b)}` : "–";
  const box = $("costResult");
  const actions = `<div class="row"><button type="button" class="ghost sm" id="costSwap"${a && b ? "" : " disabled"}>${esc(t("cost.swap"))}</button><button type="button" class="ghost sm" id="costReset"${a || b ? "" : " disabled"}>${esc(t("cost.reset"))}</button></div>`;
  if (!a || !b) box.innerHTML = `<p class="empty">${esc(t("cost.pick"))}</p>${actions}`;
  else {
    const c = researchCost(IDX, a.id, b.id);
    if (!c) box.innerHTML = `<p class="msg err">${esc(t("cost.none", { from: shipName(a), to: shipName(b) }))}</p>${actions}`;
    else box.innerHTML = `
      <div class="readout">
        <div><span class="k">${esc(t("cost.xp"))}</span><span class="v accent">${fmt.format(c.xp)}</span>
          <span class="s">${esc(t("cost.shipXp"))} ${fmt.format(c.shipXp)} · ${esc(t("cost.moduleXp"))} ${fmt.format(c.moduleXp)}</span></div>
        <div><span class="k">${esc(t("cost.credits"))}</span><span class="v">${fmt.format(c.credits)}</span><span class="s">${esc(t("cost.creditsSub"))}</span></div>
      </div>
      <p class="mini">${esc(t("cost.path", { list: c.path.map((id) => shipName(ship(id))).join(" → ") }))}</p>
      ${actions}<p class="note">${esc(t("cost.note"))}</p>`;
  }
  $("costSwap").addEventListener("click", () => { [state.from, state.to] = [state.to, state.from]; changed(); });
  $("costReset").addEventListener("click", () => { state.from = state.to = null; changed(); });
}

// Klicks im Baum und in der Premium-Liste wählen ein Schiff aus
for (const id of ["tree", "extra"]) $(id).addEventListener("click", (e) => {
  const b = e.target.closest("button[data-id]");
  if (!b) return;
  state.sel = +b.dataset.id; changed();
  // Auf schmalen Bildschirmen zur Detailansicht springen
  if (window.matchMedia("(max-width: 820px)").matches) $("detailTitle").scrollIntoView({ block: "start", behavior: "smooth" });
});
$("nations").addEventListener("click", (e) => { const b = e.target.closest("button[data-nation]"); if (b) { state.nation = b.dataset.nation; state.type = ""; changed(); } });
$("types").addEventListener("click", (e) => { const b = e.target.closest("button[data-type]"); if (b) { state.type = b.dataset.type; changed(); } });

// ---------- Vergleich ----------
const MAX_CMP = 6;
const v = (x) => (x === null || x === undefined ? null : x);
const gun = (s) => s.p.gun, torp = (s) => s.p.torp;
// Flak-Zonen wie im Spiel: far (außen), medium (Mitte), near (innen)
const AA_ZONES = ["far", "medium", "near"];
const aaZone = (z) => (s) => (s.p.aa && s.p.aa[z] ? s.p.aa[z][1] : null);
const aaRange = (z) => (s) => (s.p.aa && s.p.aa[z] ? s.p.aa[z][0] : null);
// [Text, Wert, Anzeige, Richtung (1 = mehr ist besser, -1 = weniger, 0 = nicht vergleichen)]
// Nur additive Chancen (Brand) in Prozentpunkten; Flutungschance wird mit Faktoren verändert → relativ in %
const PP_ROWS = new Set(["r.burn", "r.secBurn"]);
// Munitionsart sichtbar machen: Kennzeichen vor der Zeile (Text und Farbe), Klartext für Tooltip und Leiste
const AMMO = { he: "HE", ap: "AP", sap: "SAP" };
const ammoTag = (am) => (am ? `<span class="ammo ${am}">${AMMO[am]}</span> ` : "");
const rowLabel = (key, am) => (am ? `${AMMO[am]} · ${t(key)}` : t(key));
const ROWS = [
  ["g.general"],
  ["r.tier", (s) => s.tier, (x) => ROMAN[x], 0],
  ["r.type", (s) => typeName(s.type), null, 0],
  ["r.nation", (s) => nationName(s.nation), null, 0],
  ["r.price", (s) => priceText(s), null, 0],
  ["g.survival"],
  ["r.hp", (s) => v(s.p.hp), (x) => fmt.format(x), 1],
  ["r.speed", (s) => v(s.p.speed), (x) => t("u.kn", { v: fmt1.format(x) }), 1],
  ["r.turn", (s) => v(s.p.turn), (x) => t("u.m", { v: fmt.format(x) }), -1],
  ["r.rudder", (s) => v(s.p.rudder), (x) => t("u.s", { v: fmt1.format(x) }), -1],
  ["r.seen", (s) => v(s.p.seen), (x) => t("u.km", { v: fmt2.format(x) }), -1],
  ["r.air", (s) => v(s.p.air), (x) => t("u.km", { v: fmt2.format(x) }), -1],
  ["r.fireT", (s) => v(s.p.fireT), (x) => t("u.s", { v: fmt1.format(x) }), -1],
  ["r.floodT", (s) => v(s.p.floodT), (x) => t("u.s", { v: fmt1.format(x) }), -1],
  ["g.guns"],
  ["r.gun", (s) => (gun(s) ? t("v.gun", { n: gun(s).barrels, c: gun(s).caliber }) : null), null, 0],
  ["r.reload", (s) => (gun(s) ? gun(s).reload : null), (x) => t("u.s", { v: fmt2.format(x) }), -1],
  ["r.range", (s) => (gun(s) ? gun(s).range : null), (x) => t("u.km", { v: fmt2.format(x) }), 1],
  ["r.turn180", (s) => (gun(s) ? gun(s).turn180 : null), (x) => t("u.s", { v: fmt1.format(x) }), -1],
  ["r.disp", (s) => (gun(s) ? gun(s).disp : null), (x) => t("u.m", { v: fmt.format(x) }), -1],
  ["r.he", (s) => (gun(s) && gun(s).he ? gun(s).he.dmg : null), (x) => fmt.format(x), 1, "he"],
  ["r.burn", (s) => (gun(s) && gun(s).he ? gun(s).he.burn : null), (x) => t("u.pct", { v: fmt1.format(x) }), 1, "he"],
  ["r.hepen", (s) => (gun(s) && gun(s).he ? gun(s).he.pen : null), (x) => t("u.mm", { v: fmt.format(x) }), 1, "he"],
  ["r.hev", (s) => (gun(s) && gun(s).he ? gun(s).he.speed : null), (x) => t("u.ms", { v: fmt.format(x) }), 1, "he"],
  ["r.ap", (s) => (gun(s) && gun(s).ap ? gun(s).ap.dmg : null), (x) => fmt.format(x), 1, "ap"],
  ["r.apv", (s) => (gun(s) && gun(s).ap ? gun(s).ap.speed : null), (x) => t("u.ms", { v: fmt.format(x) }), 1, "ap"],
  ["r.sap", (s) => (gun(s) && gun(s).sap ? gun(s).sap.dmg : null), (x) => fmt.format(x), 1, "sap"],
  ["r.sappen", (s) => (gun(s) && gun(s).sap ? gun(s).sap.pen : null), (x) => t("u.mm", { v: fmt.format(x) }), 1, "sap"],
  ["g.torps"],
  ["r.tubes", (s) => (torp(s) ? torp(s).tubes : null), (x) => fmt.format(x), 1],
  ["r.treload", (s) => (torp(s) ? torp(s).reload : null), (x) => t("u.s", { v: fmt1.format(x) }), -1],
  ["r.trange", (s) => (torp(s) ? torp(s).range : null), (x) => t("u.km", { v: fmt1.format(x) }), 1],
  ["r.tdmg", (s) => (torp(s) ? torp(s).dmg : null), (x) => fmt.format(x), 1],
  ["r.tspeed", (s) => (torp(s) ? torp(s).speed : null), (x) => t("u.kn", { v: fmt.format(x) }), 1],
  ["r.tseen", (s) => (torp(s) ? torp(s).seen : null), (x) => t("u.km", { v: fmt2.format(x) }), -1],
  ["r.tflood", (s) => (torp(s) && torp(s).flood ? torp(s).flood : null), (x) => t("u.pct", { v: fmt1.format(x) }), 1],
  ["g.aa"],
  ["r.aa0", aaZone("far"), (x) => t("u.dps", { v: fmt.format(x) }), 1],
  ["r.aa0r", aaRange("far"), (x) => t("u.km", { v: fmt1.format(x) }), 1],
  ["r.aa1", aaZone("medium"), (x) => t("u.dps", { v: fmt.format(x) }), 1],
  ["r.aa1r", aaRange("medium"), (x) => t("u.km", { v: fmt1.format(x) }), 1],
  ["r.aa2", aaZone("near"), (x) => t("u.dps", { v: fmt.format(x) }), 1],
  ["r.aa2r", aaRange("near"), (x) => t("u.km", { v: fmt1.format(x) }), 1],
  ["r.sec", (s) => v(s.p.sec), (x) => t("u.km", { v: fmt1.format(x) }), 1],
  ["r.secR", (s) => v(s.p.secR), (x) => t("u.s", { v: fmt2.format(x) }), -1],
  ["r.secBurn", (s) => v(s.p.secBurn), (x) => t("u.pct", { v: fmt1.format(x) }), 1, "he"]
];

function addCompare(id, b = null, dup = false) {
  if (!dup && inCompare(id)) return false;
  if (state.cmp.length >= MAX_CMP) { $("cmpResults").innerHTML = `<p class="msg err">${esc(t("cmp.full"))}</p>`; return false; }
  state.cmp.push({ id, b }); changed();
  return true;
}
function renderPicker() {
  const q = nameKey($("cmpSearch").value.trim());
  const hits = q ? DATA.ships.filter((s) => !inCompare(s.id) && (nameKey(s.name).includes(q) || (s.nameDe && nameKey(s.nameDe).includes(q))))
    .sort((a, b) => (nameKey(a.name).startsWith(q) ? 0 : 1) - (nameKey(b.name).startsWith(q) ? 0 : 1) || b.tier - a.tier).slice(0, 8) : [];
  $("cmpResults").innerHTML = hits.map((s) => `<button type="button" class="ghost hit" data-id="${s.id}">${icon(s)}<span class="nm">${esc(shipName(s))}</span><span class="mini">${ROMAN[s.tier]} · ${esc(nationName(s.nation))}</span></button>`).join("") +
    (q && !hits.length ? `<p class="mini">${esc(t("cmp.noHit"))}</p>` : "");
  $("cmpPicked").innerHTML = state.cmp.map((e, i) => {
    const s = ship(e.id), name = shipName(s) + (e.b ? ` (${t("cmp.withBuild")})` : "");
    return `<button type="button" class="chip pick" data-i="${i}" aria-label="${esc(t("cmp.remove", { name }))}">${esc(name)} <span aria-hidden="true">×</span></button>`;
  }).join("");
}
// Spalten des Vergleichs: ohne Build die Top-Konfiguration, mit Build die berechneten Werte samt Einzelquellen
function cmpColumns() {
  return state.cmp.map((e, i) => {
    const s = ship(e.id);
    const sb = e.b && BUILD ? BUILD.ships[e.id] : null;
    const b = sb ? parseBuild(e.b) : null;
    if (!b) return { i, s, e, view: s };
    const ctx = diffCtx(s, sb, b);
    return { i, s, e, ctx, view: ctx.cur };
  });
}
function renderCompare() {
  state.cmp = state.cmp.filter((e) => ship(e.id));
  renderPicker();
  // Builds brauchen die Builder-Daten: laden und danach neu zeichnen
  if (!BUILD && state.cmp.some((e) => e.b)) { const l = loadBuilder(); if (l) l.then(() => { if (BUILD) renderCompare(); }); }
  const cols = cmpColumns();
  $("cmpEmpty").hidden = cols.length > 0; $("cmpWrap").hidden = !cols.length; $("cmpClear").disabled = !cols.length;
  if (!cols.length) return;
  for (const k of Object.keys(DELTA_TIPS)) if (k[0] === "c") delete DELTA_TIPS[k];
  $("cmpHead").innerHTML = `<tr><td></td>${cols.map(({ i, s, e }) => {
    const name = esc(shipName(s));
    if (s.test) return `<th scope="col">${icon(s)}<span class="cmp-name">${name}</span></th>`;
    const label = t(e.b ? "cmp.editBuild" : "cmp.addBuild");
    return `<th scope="col"><button type="button" class="cmp-ship${e.b ? " has-build" : ""}" data-edit="${i}" aria-label="${esc(t("cmp.buildFor", { name: shipName(s), action: label }))}">${icon(s)}<span class="cmp-name">${name}</span><span class="cmp-build">${esc(label)}</span></button></th>`;
  }).join("")}</tr>`;
  let body = "", n = 0;
  let lastAmmo = "";
  for (const [key, get, show, dir, am] of ROWS) {
    if (!get) { lastAmmo = ""; body += `<tr class="grp"><th scope="colgroup" colspan="${cols.length + 1}">${esc(t(key))}</th></tr>`; continue; }
    const vals = cols.map((c) => get(c.view));
    if (vals.every((x) => x === null)) continue;
    const first = am && am !== lastAmmo;
    lastAmmo = am || "";
    const nums = vals.filter((x) => typeof x === "number");
    const best = dir && nums.length > 1 && new Set(nums).size > 1 ? (dir > 0 ? Math.max(...nums) : Math.min(...nums)) : null;
    body += `<tr${first ? ' class="ammo-first"' : ""}><th scope="row">${ammoTag(am)}${esc(t(key))}</th>${vals.map((x, ci) => {
      if (x === null) return `<td class="na">–</td>`;
      const txt = esc(show ? show(x) : x), isBest = x === best;
      const bestTxt = isBest ? `<span class="visually-hidden"> (${esc(t("cmp.best"))})</span>` : "";
      const c = cols[ci], a = c.ctx && dir ? get(c.ctx.base) : null;
      if (typeof a !== "number" || typeof x !== "number" || a === x) return `<td${isBest ? ' class="best"' : ""}>${txt}${bestTxt}</td>`;
      // Mit Build: Wert farbig, Änderung gegenüber demselben Schiff ohne Build dahinter
      const better = (x > a) === (dir > 0), cls = better ? "up" : "down", kind = PP_ROWS.has(key) ? "pp" : "";
      const label = `${shipName(c.s)}: ${rowLabel(key, am)}`;
      return `<td class="${isBest ? "best " : ""}built"><span class="cv ${cls}">${txt}</span>${bestTxt} ${deltaCell("c" + n++, label, cls, better, deltaText(kind, a, x), partsOf(c.ctx, get, dir, kind))}</td>`;
    }).join("")}</tr>`;
  }
  $("cmpBody").innerHTML = body;
}
$("cmpSearch").addEventListener("input", renderPicker);
$("cmpSearch").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const first = $("cmpResults").querySelector("button[data-id]");
  if (first) { addCompare(+first.dataset.id); $("cmpSearch").value = ""; renderPicker(); }
});
$("cmpResults").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-id]");
  if (b) { addCompare(+b.dataset.id); $("cmpSearch").value = ""; renderPicker(); $("cmpSearch").focus(); }
});
$("cmpPicked").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-i]");
  if (b) { state.cmp.splice(+b.dataset.i, 1); changed(); $("cmpSearch").focus(); }
});
$("cmpClear").addEventListener("click", () => { state.cmp = []; changed(); });
$("cmpHead").addEventListener("click", (e) => { const b = e.target.closest("button[data-edit]"); if (b) openBuildDialog(+b.dataset.edit); });

// ---------- Shipbuilder ----------
// Daten werden erst geladen, wenn der Reiter offen ist.
// Zustand: Schiff, Modul je Typ, Upgrade je Slot, Kommandantenfähigkeiten (IDs), Signale (Schlüssel).
let BUILD = null, buildLoading = null, openSlot = null;
// Werkbank: offener Auswahlbereich (mod | up | cons | skills | flags) oder null
let pane = "up";
const PANES = { mod: "b.modules", up: "b.upgrades", cons: "b.consumables", skills: "b.captain", flags: "b.signals" };
const EMPTY6 = () => [null, null, null, null, null, null];
const build = Object.assign({ id: null, sel: null, up: EMPTY6(), sk: [], fl: [], cs: [] }, store.get("build", {}) || {});
if (!Array.isArray(build.cs)) build.cs = [];
if (!Array.isArray(build.up) || build.up.length !== 6) build.up = EMPTY6();
if (!Array.isArray(build.sk)) build.sk = [];
if (!Array.isArray(build.fl)) build.fl = [];
const MAX_POINTS = 21, MAX_FLAGS = 8;
const MOD_ICON = { hull: "Hull", artillery: "Artillery", torpedoes: "Torpedoes", engine: "Engine", fireControl: "Suo" };
const BTYPES = ["hull", "artillery", "torpedoes", "engine", "fireControl"];
// Link mit ?b=<id>.<Module>.<Upgrades>.<Fähigkeiten>.<Signale> übernimmt einen geteilten Build
const shared = new URLSearchParams(location.search).get("b");
// Im Overlay des Vergleichs wird ein fremder Build bearbeitet: dann nichts speichern
let dlg = null;
const saveBuild = () => { if (!dlg) store.set("build", build); };
const L = (o) => (o && (o[LANG] || o.en)) || "";

function loadBuilder() {
  if (BUILD || buildLoading) return buildLoading;
  $("bMsg").className = "msg"; $("bMsg").textContent = t("b.loading");
  buildLoading = fetch("data/builder.json" + ASSET_V).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((d) => { BUILD = d; $("bMsg").textContent = ""; if (shared) applyShared(shared); renderBuilder(); })
    .catch(() => { buildLoading = null; $("bMsg").className = "msg err"; $("bMsg").textContent = t("b.failed"); });
  return buildLoading;
}
// Build-Code → Build-Objekt (ungültige Teile fallen weg); null, wenn das Schiff keine Builder-Daten hat
function parseBuild(code) {
  const [id, mods, ups, sks, fls, css] = String(code).split(".");
  const sb = BUILD.ships[id];
  if (!sb) return null;
  const s = ship(+id), def = defaultSelection(sb), idx = (mods || "").split("-");
  const up = (ups || "").split("-").slice(0, 6).map((x, slot) => (x !== "" && sb.up[slot] && sb.up[slot].includes(+x) ? +x : null));
  while (up.length < 6) up.push(null);
  return {
    id: +id,
    sel: Object.fromEntries(BTYPES.filter((k) => sb.o[k]).map((k, i) => [k, (sb.o[k][+idx[i]] || {}).u || def[k]])),
    up,
    sk: (sks || "").split("-").filter(Boolean).map(Number).filter((n) => BUILD.skills.some((k) => k.id === n && s && k.grid[s.type])),
    fl: (fls || "").split("-").filter(Boolean).map(Number).filter((i) => BUILD.flags[i]).slice(0, MAX_FLAGS),
    cs: (css || "").split("-").map((x, slot) => (sb.c[slot] && sb.c[slot][+x] ? +x : 0))
  };
}
function applyShared(code) {
  const b = parseBuild(code);
  if (b) Object.assign(build, b);
  history.replaceState(null, "", location.pathname + "#builder");
}
function shareCode(b = build) {
  const sb = BUILD.ships[b.id];
  const def = defaultSelection(sb), sel = b.sel || def;
  const mods = BTYPES.filter((k) => sb.o[k]).map((k) => Math.max(0, sb.o[k].findIndex((o) => o.u === sel[k]))).join("-");
  return [b.id, mods, b.up.map((x) => (x === null ? "" : x)).join("-"), b.sk.join("-"), b.fl.join("-"), b.cs.join("-")].join(".");
}
function openInBuilder(id) {
  if (build.id !== id) { build.id = id; build.sel = null; build.up = EMPTY6(); build.cs = []; }
  saveBuild();
  location.hash = "#builder";
}
// Zuschläge als Anteil (0,01 = +1 Prozentpunkt), keine Faktoren
const ADDITIVE_PCT = new Set(["burnChanceFactorBig", "burnChanceFactorSmall", "artilleryBurnChanceBonus", "bombBurnChanceBonus", "rocketBurnChanceBonus"]);
function effectText(key, v) {
  if (typeof v !== "number") return "";
  if (ADDITIVE_PCT.has(key)) return `${v > 0 ? "+" : ""}${fmt1.format(Math.round(v * 1000) / 10)} %`;
  const pct = v > 0 && v <= 5 && (!Number.isInteger(v) || /Coeff|Coefficient|Multiplier$/.test(key));
  if (pct) { const d = Math.round((v - 1) * 1000) / 10; return `${d > 0 ? "+" : ""}${fmt1.format(d)} %`; }
  return `${v > 0 ? "+" : ""}${fmt.format(v)}`;
}
// Effektliste aus Modifikatoren; eingerechnete Effekte mit ◆
function effectLines(mods, species) {
  const applied = new Set(BUILD.applied);
  return Object.entries(mods || {}).map(([k, v]) => {
    const val = typeof v === "object" && v !== null ? v[species] : v;
    if (val === undefined || typeof val !== "number" || !BUILD.labels[k]) return "";
    return `<li>${applied.has(k) ? `<span class="dia" aria-hidden="true">◆</span><span class="visually-hidden">${esc(t("b.applied"))}: </span>` : ""}${esc(L(BUILD.labels[k]))} ${esc(effectText(k, val))}</li>`;
  }).filter(Boolean).join("");
}
const img = (path, alt = "") => `<img src="assets/img/${path}.webp" alt="${esc(alt)}" width="48" height="48" decoding="async">`;

// Kommandant: Kosten je Fähigkeit, Voraussetzung: ab Stufe 2 mindestens eine Fähigkeit der Stufe davor
const skillCost = (k, cls) => (k.grid[cls] ? k.grid[cls][0] : 0);
function skillPoints(cls) { return build.sk.reduce((a, id) => a + skillCost(BUILD.skills.find((k) => k.id === id) || { grid: {} }, cls), 0); }
function tiersHeld(cls, without) {
  const held = new Set();
  for (const id of build.sk) if (id !== without) { const k = BUILD.skills.find((x) => x.id === id); if (k && k.grid[cls]) held.add(k.grid[cls][0]); }
  return held;
}
function canAdd(k, cls) {
  const cost = skillCost(k, cls);
  return cost > 0 && skillPoints(cls) + cost <= MAX_POINTS && (cost === 1 || tiersHeld(cls).has(cost - 1));
}
// Entfernen nur, wenn alle übrigen Fähigkeiten ihre Voraussetzung behalten
function canRemove(id, cls) {
  const held = tiersHeld(cls, id);
  return build.sk.filter((x) => x !== id).every((x) => {
    const k = BUILD.skills.find((s) => s.id === x);
    const c = k ? skillCost(k, cls) : 0;
    return c <= 1 || held.has(c - 1);
  });
}

// Alles, was Werte verändert, mit Herkunft: Upgrades, Kommandant, Signale
function buildSources(s, b = build) {
  const out = [];
  for (const i of b.up) if (i !== null) out.push({ kind: "b.upgrades", name: L(BUILD.upgrades[i].t), mods: BUILD.upgrades[i].mods });
  for (const id of b.sk) { const k = BUILD.skills.find((x) => x.id === id); if (k && k.grid[s.type]) out.push({ kind: "b.captain", name: L(k.t), mods: k.mods }); }
  for (const i of b.fl) if (BUILD.flags[i]) out.push({ kind: "b.signals", name: L(BUILD.flags[i].t), mods: BUILD.flags[i].mods });
  return out;
}
function chosenMods(s, b = build) { return buildSources(s, b).map((x) => x.mods); }
// Werte eines Builds: Standard (Top ohne Ausrüstung), nur Module, komplett, und je Quelle allein
function diffCtx(s, sb, b) {
  const srcs = buildSources(s, b), all = srcs.map((x) => x.mods), sel = b.sel || defaultSelection(sb);
  const P = (se, mods) => ({ ...s, p: computeBuild(sb, se, mods, s.type) });
  return { srcs, all, base: P(defaultSelection(sb), []), mod: P(sel, []), cur: P(sel, all), each: srcs.map((x) => P(sel, [x.mods])) };
}
// Einzelwirkungen: Modulwahl gegenüber Standard, dann jede Quelle allein auf den gewählten Modulen
function partsOf(ctx, get, dir, kind) {
  const out = [];
  const add = (src, a, b) => {
    if (typeof a !== "number" || typeof b !== "number" || a === b || a === -1) return;
    const better = (b > a) === (dir > 0);
    out.push({ ...src, better, cls: better ? "up" : "down", txt: deltaText(kind, a, b) });
  };
  add({ kind: "", name: t("b.modules") }, get(ctx.base), get(ctx.mod));
  ctx.srcs.forEach((x, i) => add(x, get(ctx.mod), get(ctx.each[i])));
  return out;
}

function renderBuilder() {
  if (!BUILD) return;
  const s = ship(build.id), sb = s && BUILD.ships[s.id];
  $("bBody").hidden = !sb; $("bDock").hidden = true;
  if (!s) { $("bMsg").className = "msg"; $("bMsg").textContent = t("b.pick"); return; }
  if (!sb) { $("bMsg").className = "msg"; $("bMsg").textContent = t("b.test"); return; }
  $("bMsg").textContent = "";
  const cls = s.type, def = defaultSelection(sb);
  if (!build.sel) build.sel = { ...def };
  for (const k of BTYPES) if (sb.o[k] && !sb.o[k].some((o) => o.u === build.sel[k])) build.sel[k] = def[k];
  build.up = build.up.map((x, slot) => (x !== null && sb.up[slot].includes(x) ? x : null));
  build.sk = build.sk.filter((id) => { const k = BUILD.skills.find((x) => x.id === id); return k && k.grid[cls]; });
  build.cs = (sb.c || []).map((opts, slot) => (opts[build.cs[slot]] ? build.cs[slot] : 0));
  saveBuild();
  $("bHead").innerHTML = `<div class="detail-head">${icon(s, "sicon big")}<div><div class="detail-name">${esc(shipName(s))}</div><div class="mini">${esc(ROMAN[s.tier])} · ${esc(typeName(s.type))} · ${esc(nationName(s.nation))}</div></div></div>`;
  renderBar(s, sb, cls);
  // Auswahlbereich: nur der gewählte Bereich ist sichtbar
  $("bEdit").hidden = !pane;
  if (pane) {
    $("bEditTitle").textContent = t(PANES[pane]);
    for (const el of document.querySelectorAll("#bEdit [data-pane]")) el.hidden = el.dataset.pane !== pane;
  }
  // Upgrades: immer ein Slot ausgewählt, Auswahlfläche fest darunter (nichts verschiebt sich)
  if (openSlot === null || !sb.up[openSlot] || !sb.up[openSlot].length) openSlot = sb.up.findIndex((l) => l.length);
  if (openSlot < 0) openSlot = null;

  // Module: je Typ das Typ-Icon und die Varianten als Knöpfe
  $("bModules").innerHTML = BTYPES.filter((k) => sb.o[k]).map((k) => `<div class="b-modrow"><span class="b-modicon" title="${esc(t("b.mod." + k))}">${img("modules/" + MOD_ICON[k], t("b.mod." + k))}</span>
    <div class="b-modopts" role="group" aria-label="${esc(t("b.mod." + k))}">${sb.o[k].map((o) => `<button type="button" class="chip" data-mod="${k}" data-u="${esc(o.u)}" aria-pressed="${o.u === build.sel[k]}"${sb.o[k].length === 1 ? " disabled" : ""}>${esc(L(o.n))}</button>`).join("")}</div></div>`).join("");

  // Upgrade-Slots: Icon des gewählten Upgrades oder +
  $("bSlots").innerHTML = sb.up.map((list, slot) => {
    const u = build.up[slot] !== null ? BUILD.upgrades[build.up[slot]] : null;
    const label = `${t("b.slot", { n: slot + 1 })}: ${u ? L(u.t) : t("b.empty")}`;
    return `<button type="button" class="b-slot${u ? " filled" : ""}${openSlot === slot ? " active" : ""}" data-slot="${slot}" aria-expanded="${openSlot === slot}" aria-label="${esc(label)}"${list.length ? "" : " disabled"}>${u && u.icon ? img("upgrades/" + u.icon) : `<span aria-hidden="true">${list.length ? "+" : "–"}</span>`}<em aria-hidden="true">${slot + 1}</em></button>`;
  }).join("");
  if (openSlot !== null && sb.up[openSlot] && sb.up[openSlot].length) {
    const list = sb.up[openSlot];
    $("bSlotPick").hidden = false;
    $("bSlotPick").innerHTML = `<div class="b-pickhead">${esc(t("b.slot", { n: openSlot + 1 }))}</div><div class="b-icons">
      <button type="button" class="b-icon none" data-upg="-1" aria-pressed="${build.up[openSlot] === null}" aria-label="${esc(t("b.none"))}" title="${esc(t("b.none"))}"><span aria-hidden="true">∅</span></button>
      ${list.map((i) => { const u = BUILD.upgrades[i]; return `<button type="button" class="b-icon" data-upg="${i}" aria-pressed="${build.up[openSlot] === i}" aria-label="${esc(L(u.t))}">${u.icon ? img("upgrades/" + u.icon) : esc(L(u.t))}</button>`; }).join("")}</div>`;
  } else { $("bSlotPick").hidden = false; $("bSlotPick").innerHTML = `<p class="mini">${esc(t("b.noUpgrades"))}</p>`; }

  // Verbrauchsmaterial: je Slot die Varianten als Icons
  $("bCons").innerHTML = (sb.c || []).map((opts, slot) => `<div class="b-consrow" role="group" aria-label="${esc(t("b.slot", { n: slot + 1 }))}"><span class="b-conslabel" aria-hidden="true">${slot + 1}</span>${opts.map((c, i) => {
    const tr = consTrend(consRows(s, slot, i));
    const mark = tr ? `<span class="b-mark ${tr}" aria-hidden="true">${tr === "up" ? "▲" : tr === "down" ? "▼" : "±"}</span>` : "";
    const label = L(c.t) + (tr ? ` (${t("b.c.changed." + tr)})` : "");
    return `<button type="button" class="b-icon cons${build.cs[slot] === i ? " on" : ""}" data-cslot="${slot}" data-copt="${i}" aria-pressed="${build.cs[slot] === i}" aria-label="${esc(label)}">${img("consumables/" + c.a)}${mark}</button>`;
  }).join("")}</div>`).join("") || `<p class="mini">–</p>`;

  // Kommandant: Raster 4 Kostenstufen × 6 Spalten wie im Spiel
  const grid = BUILD.skills.filter((k) => k.grid[cls]).sort((a, b) => a.grid[cls][0] - b.grid[cls][0] || a.grid[cls][1] - b.grid[cls][1]);
  $("bSkills").innerHTML = [1, 2, 3, 4].map((r) => `<span class="b-cost" style="grid-row:${r}" aria-hidden="true">${r}<small>P</small></span>`).join("") + grid.map((k) => {
    const on = build.sk.includes(k.id), ok = on ? canRemove(k.id, cls) : canAdd(k, cls);
    return `<button type="button" class="b-icon skill${on ? " on" : ""}" data-skill="${k.id}" aria-pressed="${on}" aria-disabled="${!ok}" style="grid-row:${k.grid[cls][0]};grid-column:${k.grid[cls][1] + 1}" aria-label="${esc(L(k.t))}, ${esc(t("b.cost", { n: k.grid[cls][0] }))}">${img("skills/" + k.id)}${on ? '<i class="b-check" aria-hidden="true">✓</i>' : ""}</button>`;
  }).join("");
  $("bPoints").textContent = t("b.points", { n: skillPoints(cls), max: MAX_POINTS });

  // Signale
  $("bFlags").innerHTML = BUILD.flags.map((f, i) => {
    const on = build.fl.includes(i), ok = on || build.fl.length < MAX_FLAGS;
    return `<button type="button" class="b-icon flag${on ? " on" : ""}" data-flag="${i}" aria-pressed="${on}" aria-disabled="${!ok}" aria-label="${esc(L(f.t))}">${img("flags/" + f.key)}</button>`;
  }).join("");
  $("bFlagCount").textContent = t("b.flagCount", { n: build.fl.length, max: MAX_FLAGS });

  renderBuildStats(s, sb, def);
}

// Ausrüstungsleiste: der ganze Build als kleine Icons; Klick öffnet den passenden Auswahlbereich
function renderBar(s, sb, cls) {
  const grp = (key, label, count, icons) => `<div class="bw-eq${pane === key ? " open" : ""}">
    <button type="button" class="bw-eqhead" data-pane="${key}" aria-expanded="${pane === key}" aria-controls="bEdit">${esc(t(label))}${count ? ` <b>${esc(count)}</b>` : ""}<span class="bw-edit-link">${esc(t("b.edit"))}</span></button>
    <div class="bw-eqicons">${icons}</div></div>`;
  const mods = BTYPES.filter((k) => sb.o[k]).map((k) => { const o = sb.o[k].find((x) => x.u === build.sel[k]) || sb.o[k][0];
    return `<button type="button" class="bw-mini tile" data-pane="mod" data-mod="${k}" data-u="${esc(o.u)}" aria-label="${esc(t("b.mod." + k))}: ${esc(L(o.n))}">${img("modules/" + MOD_ICON[k])}</button>`; }).join("");
  const ups = sb.up.map((list, slot) => { const i = build.up[slot], u = i !== null ? BUILD.upgrades[i] : null;
    return `<button type="button" class="bw-mini${u ? "" : " empty"}" data-open-slot="${slot}"${u ? ` data-upg="${i}"` : ""} aria-label="${esc(t("b.slot", { n: slot + 1 }))}: ${esc(u ? L(u.t) : t("b.empty"))}"${list.length ? "" : " disabled"}>${u && u.icon ? img("upgrades/" + u.icon) : `<span aria-hidden="true">${list.length ? "+" : "–"}</span>`}</button>`; }).join("");
  const cons = (sb.c || []).map((opts, slot) => { const c = opts[build.cs[slot]] || opts[0];
    return `<button type="button" class="bw-mini" data-pane="cons" data-cslot="${slot}" data-copt="${build.cs[slot] || 0}" aria-label="${esc(L(c.t))}">${img("consumables/" + c.a)}</button>`; }).join("");
  const sks = build.sk.map((id) => BUILD.skills.find((k) => k.id === id)).filter(Boolean).sort((a, b) => a.grid[cls][0] - b.grid[cls][0] || a.grid[cls][1] - b.grid[cls][1])
    .map((k) => `<button type="button" class="bw-mini tile" data-pane="skills" data-skill="${k.id}" aria-label="${esc(L(k.t))}">${img("skills/" + k.id)}</button>`).join("") || `<span class="mini">${esc(t("b.noneSel"))}</span>`;
  const fls = build.fl.map((i) => `<button type="button" class="bw-mini" data-pane="flags" data-flag="${i}" aria-label="${esc(L(BUILD.flags[i].t))}">${img("flags/" + BUILD.flags[i].key)}</button>`).join("") || `<span class="mini">${esc(t("b.noneSel"))}</span>`;
  $("bBar").innerHTML = grp("mod", "b.modules", "", mods) + grp("up", "b.upgrades", "", ups) + grp("cons", "b.consumables", "", cons) +
    grp("skills", "b.captain", `${skillPoints(cls)}/${MAX_POINTS}`, sks) + grp("flags", "b.signals", `${build.fl.length}/${MAX_FLAGS}`, fls);
}
// Kennzahl-Kacheln: die wichtigsten Werte groß, mit Änderung und Quellen-Tooltip
const KPIS = [["kpi.survival", ["r.hp", "r.seen"]], ["kpi.mobility", ["r.speed", "r.rudder"]], ["kpi.guns", ["r.reload", "r.range"]], ["kpi.torps", ["r.treload", "r.trange"]], ["kpi.aa", ["r.aa0", "r.sec"]]];
function renderKpis(ctx) {
  for (const k of Object.keys(DELTA_TIPS)) if (k[0] === "k") delete DELTA_TIPS[k];
  let n = 0;
  const byKey = Object.fromEntries(ROWS.filter((r) => r[1]).map((r) => [r[0], r]));
  const cards = KPIS.map(([title, keys]) => {
    const items = keys.map((key) => {
      const [, get, show, dir, am] = byKey[key];
      const a = get(ctx.base), b = get(ctx.cur);
      if (b === null || b === undefined) return "";
      const changed = typeof a === "number" && typeof b === "number" && a !== b;
      const better = changed && (b > a) === (dir > 0), cls = changed ? (better ? "up" : "down") : "";
      const kind = PP_ROWS.has(key) ? "pp" : "";
      return `<div class="bw-num"><span class="mini">${esc(t(key))}</span><strong class="${cls}">${esc(show ? show(b) : b)}</strong>${changed ? deltaCell("k" + n++, rowLabel(key, am), cls, better, deltaText(kind, a, b), partsOf(ctx, get, dir, kind)) : ""}</div>`;
    }).join("");
    return items ? `<div class="bw-kpi"><div class="bw-kpititle">${esc(t(title))}</div>${items}</div>` : "";
  }).filter(Boolean).slice(0, 4);
  $("bKpis").innerHTML = cards.join("");
}

// Änderungstext: Chancen in Prozentpunkten, Ladungen als Anzahl, sonst relativ in %
function deltaText(kind, a, b) {
  const sign = b > a ? "+" : "−";
  if (kind === "pp") return t("u.pp", { v: sign + fmt1.format(Math.abs(b - a)) });
  if (kind === "n") return sign + fmt.format(Math.abs(b - a));
  return `${sign}${fmt1.format(Math.abs(((b - a) / a) * 100))} %`;
}
// Tooltip-Inhalte der Änderungen, über data-tip an der Schaltfläche
const DELTA_TIPS = {};
function deltaCell(id, label, cls, better, txt, parts) {
  DELTA_TIPS[id] = `<strong>${esc(label)}</strong><ul class="b-cvals b-src">${parts.map((x) =>
    `<li><span class="k">${x.kind ? `<span class="src">${esc(t(x.kind))}</span> ` : ""}${esc(x.name)}</span><span class="v"><span class="delta ${x.cls}">${x.better ? "▲" : "▼"} ${esc(x.txt)}</span></span></li>`).join("")}</ul>${parts.length > 1 ? `<p class="mini">${esc(t("b.srcNote"))}</p>` : ""}`;
  return `<button type="button" class="delta ${cls}" data-tip="${id}">${better ? "▲" : "▼"} ${esc(txt)}<span class="visually-hidden"> (${esc(t(better ? "b.better" : "b.worse"))})</span></button>`;
}

// Werte des Builds in einer Spalte, Änderung gegenüber Standard (Top-Module ohne Ausrüstung) farbig dahinter
function renderBuildStats(s, sb, def) {
  const ctx = diffCtx(s, sb, build), { srcs, all, base, mod, cur, each } = ctx;
  renderKpis(ctx);
  const only = $("bOnlyChanged").checked;
  for (const k of Object.keys(DELTA_TIPS)) if (k[0] === "d") delete DELTA_TIPS[k];
  let rows = "", group = "", groupRows = "", dock = "", n = 0;
  const flush = () => { if (groupRows) rows += group + groupRows; groupRows = ""; };
  let lastAmmo = "";
  const row = (label, a, b, txt, dir, kind, get, am = "", text = label) => {
    const changed = typeof a === "number" && typeof b === "number" && a !== b && a !== -1;
    if (only && !changed) return;
    // Neue Munitionsart beginnt: Trennlinie
    const first = am && am !== lastAmmo ? " ammo-first" : "";
    lastAmmo = am;
    const th = `<th scope="row">${ammoTag(am)}${esc(text)}</th>`;
    if (!changed) { groupRows += `<tr class="${first.trim()}">${th}<td class="num">${esc(txt(b))}</td><td></td></tr>`; return; }
    const better = (b > a) === (dir > 0), cls = better ? "up" : "down", d = deltaText(kind, a, b);
    groupRows += `<tr class="changed${first}">${th}<td class="num ${cls}">${esc(txt(b))}</td>
      <td class="num">${deltaCell("d" + n++, label, cls, better, d, partsOf(ctx, get, dir, kind))}</td></tr>`;
    dock += `<span class="dock-item ${cls}">${esc(label)}: ${esc(txt(b))} <b>${esc(d)}</b></span>`;
  };
  for (const [key, get, show, dir, am] of ROWS) {
    if (!get) { flush(); lastAmmo = ""; group = `<tr class="grp"><th scope="colgroup" colspan="3">${esc(t(key))}</th></tr>`; continue; }
    if (!dir) continue;
    const a = get(base), b = get(cur);
    if (a === null && b === null) continue;
    row(rowLabel(key, am), a, b, (x) => (x === null ? "–" : show ? show(x) : x), dir, PP_ROWS.has(key) ? "pp" : "", get, am || "", t(key));
  }
  flush();
  // Verbrauchsmaterial: Heilung hängt von den Lebenspunkten der jeweiligen Variante ab
  const C = (x, mods) => computeConsumables(sb, build.cs, mods, s.type, x.p.hp);
  const cb = C(base, []), cm = C(mod, []), cc = C(cur, all), ce = each.map((x, i) => C(x, [srcs[i].mods]));
  group = `<tr class="grp"><th scope="colgroup" colspan="3">${esc(t("b.consumables"))}</th></tr>`;
  cc.forEach((c, i) => {
    for (const [k, dir] of CONS_VALUES) {
      const a = cb[i][k], b = c[k];
      if ((a === null || a === undefined) && (b === null || b === undefined)) continue;
      // Getter über die vorberechneten Varianten: base → cb, mod → cm, Quelle j → ce[j]
      const pick = (x) => (x === base ? cb : x === mod ? cm : x === cur ? cc : ce[each.indexOf(x)])[i][k];
      row(`${L(c.t)}: ${consLabel(k, c.type)}`, a, b, (x) => consVal(k, x, c.healPct, c.type), dir, k === "n" || k === "planes" ? "n" : "", pick);
    }
  });
  flush();
  $("bStats").innerHTML = rows || `<tr><td colspan="3" class="mini">${esc(t("b.noChanges"))}</td></tr>`;
  $("bDock").innerHTML = dock;
  $("bDock").hidden = !dock;
}

// Verbrauchsmaterial: Werte einer Variante ohne und mit Build.
// dir: 1 = mehr ist besser (Ladungen, Wirkdauer), -1 = weniger ist besser (Ladezeit)
const CONS_VALUES = [["n", 1], ["work", 1], ["reload", -1], ["heal", 1], ["healT", 1],
  ["dist", 1], ["tdist", 1], ["show", 1], ["radius", 1], ["life", 1], ["boost", 1], ["planes", 1], ["fr", 1], ["treload", -1]];
// Beschriftung: Boost je nach Art (Geschwindigkeit, Nachladezeit, Reichweite); Erfassung je nach Art
const consLabel = (k, type) => t(k === "boost" ? `b.c.boost.${type}` : k === "dist" && type === "hydrophone" ? "b.c.hdist" : `b.c.${k}`);
function consRows(s, slot, opt) {
  const sb = BUILD.ships[s.id], ch = build.cs.slice();
  ch[slot] = opt;
  const mods = chosenMods(s);
  const hp0 = computeBuild(sb, build.sel, [], s.type).hp, hp1 = computeBuild(sb, build.sel, mods, s.type).hp;
  const a = computeConsumables(sb, ch, [], s.type, hp0)[slot], b = computeConsumables(sb, ch, mods, s.type, hp1)[slot];
  const out = [];
  for (const [k, dir] of CONS_VALUES) {
    const x = a[k], y = b[k];
    if ((x === null || x === undefined) && (y === null || y === undefined)) continue;
    const changed = typeof x === "number" && typeof y === "number" && x !== y && x !== -1;
    out.push({ k, ty: b.type, a: x, b: y, pa: a.healPct, pb: b.healPct, changed, better: changed && (y > x) === (dir > 0) });
  }
  return out;
}
// healT: Gesamtheilung je Einsatz in TP und als Anteil der max. TP
const consVal = (k, v, pct, type) => (v === null || v === undefined ? "–" : k === "n" ? (v === -1 ? "∞" : fmt.format(v))
  : k === "heal" ? t("u.hps", { v: fmt.format(v) })
  : k === "healT" ? t("u.hpTotal", { v: fmt.format(v), p: fmt1.format(pct) })
  : k === "dist" || k === "tdist" || k === "fr" ? t("u.km", { v: fmt2.format(v) })
  : k === "radius" ? t("u.m", { v: fmt.format(v) })
  : k === "planes" ? fmt.format(v)
  // Hauptbatterie-Nachladebeschleuniger verkürzt, die anderen erhöhen
  : k === "boost" ? t("u.pct", { v: `${type === "artilleryBoosters" ? "−" : "+"}${fmt1.format(v)}` })
  : t("u.s", { v: fmt1.format(v) }));
const consDelta = (r) => deltaText(r.k === "n" || r.k === "planes" ? "n" : "", r.a, r.b);
// Gesamtrichtung für die Markierung am Icon: nur besser, nur schlechter oder gemischt
function consTrend(rows) {
  const ch = rows.filter((r) => r.changed);
  if (!ch.length) return "";
  return ch.every((r) => r.better) ? "up" : ch.every((r) => !r.better) ? "down" : "mix";
}
function consLines(rows) {
  return rows.map((r) => {
    if (!r.changed) return `<li><span class="k">${esc(consLabel(r.k, r.ty))}</span><span class="v">${esc(consVal(r.k, r.b, r.pb, r.ty))}</span></li>`;
    const cls = r.better ? "up" : "down";
    return `<li class="changed"><span class="k">${esc(consLabel(r.k, r.ty))}</span><span class="v"><b class="${cls}">${esc(consVal(r.k, r.b, r.pb, r.ty))}</b> <span class="delta ${cls}">${r.better ? "▲" : "▼"} ${esc(consDelta(r))}</span><span class="visually-hidden"> (${esc(t(r.better ? "b.better" : "b.worse"))})</span></span></li>`;
  }).join("");
}
// Wirkung auf dieses Schiff: alle angezeigten Werte, die sich von Zustand A nach B ändern, farbig mit Änderung
function impactList(s, sb, selA, modsA, selB, modsB) {
  const P = (se, m) => ({ ...s, p: computeBuild(sb, se, m, s.type) });
  const A = P(selA, modsA), B = P(selB, modsB), items = [];
  const add = (label, a, b, val, dir, kind) => {
    if (typeof a !== "number" || typeof b !== "number" || a === b || a === -1) return;
    const better = (b > a) === (dir > 0);
    items.push(`<li><span class="k">${esc(label)}</span><span class="v"><b class="${better ? "up" : "down"}">${esc(val)}</b> <span class="delta ${better ? "up" : "down"}">${better ? "▲" : "▼"} ${esc(deltaText(kind, a, b))}</span><span class="visually-hidden"> (${esc(t(better ? "b.better" : "b.worse"))})</span></span></li>`);
  };
  for (const [key, get, show, dir, am] of ROWS) {
    if (!get || !dir) continue;
    const b = get(B);
    add(rowLabel(key, am), get(A), b, show ? show(b) : b, dir, PP_ROWS.has(key) ? "pp" : "");
  }
  const ca = computeConsumables(sb, build.cs, modsA, s.type, A.p.hp), cb = computeConsumables(sb, build.cs, modsB, s.type, B.p.hp);
  cb.forEach((c, i) => { for (const [k, dir] of CONS_VALUES) add(`${L(c.t)}: ${consLabel(k, c.type)}`, ca[i][k], c[k], consVal(k, c[k], c.healPct, c.type), dir, k === "n" || k === "planes" ? "n" : ""); });
  return items;
}
// Abschnitt im Tooltip: Wirkung im aktuellen Build (kumulativ mit allem, was schon gewählt ist).
// Gewählt: Build ohne das Element → aktueller Build. Nicht gewählt: aktueller Build → Build mit dem Element.
function impactHtml(s, alt, selected) {
  const sb = BUILD.ships[s.id], cur = chosenMods(s), other = chosenMods(s, alt);
  const items = selected ? impactList(s, sb, build.sel, other, build.sel, cur) : impactList(s, sb, build.sel, cur, build.sel, other);
  return `<p class="b-tiphead">${esc(t(selected ? "b.impactIn" : "b.impactAdd"))}</p>${items.length ? `<ul class="b-cvals">${items.join("")}</ul>` : `<p class="mini">${esc(t("b.noImpact"))}</p>`}`;
}
const withToggled = (list, x) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
// Upgrade aus der Auswahl ersetzt das Upgrade im selben Slot
function upgradeHtml(s, i) {
  const u = BUILD.upgrades[i], slot = openSlot !== null ? openSlot : u.slot, selected = build.up[slot] === i;
  const up = build.up.slice(); up[slot] = selected ? null : i;
  return `<strong>${esc(L(u.t))}</strong><ul class="b-perks b-effects">${effectLines(u.mods, s.type)}</ul>${impactHtml(s, { ...build, up }, selected)}`;
}
function flagHtml(s, i) {
  const f = BUILD.flags[i];
  return `<strong>${esc(L(f.t))}</strong><ul class="b-perks b-effects">${effectLines(f.mods, s.type)}</ul>${impactHtml(s, { ...build, fl: withToggled(build.fl, i) }, build.fl.includes(i))}`;
}
// Modul: was sich gegenüber der aktuellen Wahl ändert
function moduleHtml(s, k, u) {
  const sb = BUILD.ships[s.id], o = sb.o[k].find((x) => x.u === u);
  const head = `<strong>${esc(L(o.n))}</strong> <span class="mini">${esc(t("b.mod." + k))}</span>`;
  if (build.sel[k] === u) return `${head}<p class="mini">${esc(t("b.modCurrent"))}</p>`;
  const mods = chosenMods(s), items = impactList(s, sb, build.sel, mods, { ...build.sel, [k]: u }, mods);
  return `${head}<p class="b-tiphead">${esc(t("b.impactSwitch"))}</p>${items.length ? `<ul class="b-cvals">${items.join("")}</ul>` : `<p class="mini">${esc(t("b.noImpact"))}</p>`}`;
}
// Kommandantenfähigkeit: Name, Kosten, Wirkung laut Spiel; dazu, warum sie gerade nicht wählbar ist
function skillHtml(s, k) {
  const cls = s.type, perks = (k.perks[cls] && (k.perks[cls][LANG] || k.perks[cls].en)) || [];
  const on = build.sk.includes(k.id);
  const why = on ? (canRemove(k.id, cls) ? "" : "b.skillDep")
    : canAdd(k, cls) ? "" : skillPoints(cls) + skillCost(k, cls) > MAX_POINTS ? "b.noPoints" : "b.needTier";
  return `<strong>${esc(L(k.t))}</strong> <span class="mini">${esc(t("b.cost", { n: skillCost(k, cls) }))}${on ? " · " + esc(t("b.skillOn")) : ""}</span>
    <ul class="b-perks">${perks.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>${k.cond ? `<p class="mini b-cond">${esc(t("b.cond"))}</p>` : ""}${impactHtml(s, { ...build, sk: withToggled(build.sk, k.id) }, on)}${why ? `<p class="mini b-why">${esc(t(why))}</p>` : ""}`;
}
function consHtml(s, slot, opt) {
  const c = BUILD.ships[s.id].c[slot][opt];
  const d = BUILD.cdesc && BUILD.cdesc[c.a];
  const desc = d ? (d[LANG] || d.en).split("\n").map((p) => `<p>${esc(p)}</p>`).join("") : "";
  return `<strong>${esc(L(c.t))}</strong>${desc ? `<div class="b-desc">${desc}</div>` : ""}<ul class="b-cvals">${consLines(consRows(s, slot, opt))}</ul>`;
}

// Tooltip am Icon: bleibt offen, solange Zeiger oder Fokus auf Icon oder Tooltip liegt; Esc schließt
let tipFor = null, tipTimer = 0;
function showTip(btn) {
  const s = ship(build.id), tip = $("bTip");
  if (!BUILD || !btn || (!btn.dataset.tip && !s)) return;
  clearTimeout(tipTimer);
  const d = btn.dataset;
  const html = d.tip ? DELTA_TIPS[d.tip] || ""
    : d.skill ? skillHtml(s, BUILD.skills.find((x) => x.id === +d.skill))
    : d.cslot ? consHtml(s, +d.cslot, +d.copt)
    : d.flag ? flagHtml(s, +d.flag)
    : d.mod ? moduleHtml(s, d.mod, d.u)
    : d.upg !== undefined && +d.upg >= 0 ? upgradeHtml(s, +d.upg) : "";
  if (!html) { hideTip(true); return; }
  tip.innerHTML = html;
  tip.hidden = false;
  if (tipFor && tipFor !== btn) tipFor.removeAttribute("aria-describedby");
  tipFor = btn;
  btn.setAttribute("aria-describedby", "bTip");
  placeTip();
}
function placeTip() {
  const tip = $("bTip"), btn = tipFor;
  if (!btn || !btn.isConnected) { hideTip(true); return; }
  const r = btn.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight, gap = 8;
  const left = Math.max(gap, Math.min(r.left + r.width / 2 - w / 2, document.documentElement.clientWidth - w - gap));
  const below = r.bottom + gap + h <= window.innerHeight || r.top - gap - h < 0;
  tip.style.left = `${left}px`;
  tip.style.top = `${below ? r.bottom + gap : r.top - gap - h}px`;
}
function hideTip(now) {
  clearTimeout(tipTimer);
  const go = () => { $("bTip").hidden = true; if (tipFor) tipFor.removeAttribute("aria-describedby"); tipFor = null; };
  if (now) go(); else tipTimer = setTimeout(go, 150);
}
$("bCons").addEventListener("mouseover", (e) => { const b = e.target.closest("button[data-cslot]"); if (b) showTip(b); });
$("bCons").addEventListener("mouseout", (e) => { if (!e.relatedTarget || !$("bTip").contains(e.relatedTarget)) hideTip(); });
$("bCons").addEventListener("focusin", (e) => { const b = e.target.closest("button[data-cslot]"); if (b) showTip(b); });
$("bCons").addEventListener("focusout", () => hideTip(true));
for (const [id, sel] of [["bStats", "button[data-tip]"], ["cmpBody", "button[data-tip]"], ["bKpis", "button[data-tip]"], ["bSkills", "button[data-skill]"], ["bFlags", "button[data-flag]"],
  ["bModules", "button[data-mod]"], ["bSlotPick", "button[data-upg]"], ["bBar", "button[data-upg], button[data-skill], button[data-flag], button[data-cslot], button[data-mod]"]]) {
  $(id).addEventListener("mouseover", (e) => { const b = e.target.closest(sel); if (b) showTip(b); });
  $(id).addEventListener("mouseout", (e) => { if (!e.relatedTarget || !$("bTip").contains(e.relatedTarget)) hideTip(); });
  $(id).addEventListener("focusin", (e) => { const b = e.target.closest(sel); if (b) showTip(b); });
  $(id).addEventListener("focusout", () => hideTip(true));
}
$("bTip").addEventListener("mouseenter", () => clearTimeout(tipTimer));
$("bTip").addEventListener("mouseleave", () => hideTip());
// Esc schließt zuerst den Tooltip, erst danach das Overlay
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("bTip").hidden) { e.preventDefault(); hideTip(true); } });
window.addEventListener("scroll", () => { if (!$("bTip").hidden) placeTip(); }, { passive: true, capture: true });
window.addEventListener("resize", () => { if (!$("bTip").hidden) placeTip(); });

$("bModules").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-mod]");
  if (b && !b.disabled) { build.sel[b.dataset.mod] = b.dataset.u; renderBuilder(); }
});
// Upgrades: Überfahren (Maus) oder Klick wählt den Slot; die Auswahlfläche darunter bleibt fest stehen
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
$("bSlots").addEventListener("mouseover", (e) => {
  if (!canHover) return;
  const b = e.target.closest("button[data-slot]");
  if (!b || b.disabled || openSlot === +b.dataset.slot) return;
  openSlot = +b.dataset.slot;
  renderBuilder();
});
$("bSlots").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-slot]");
  if (!b) return;
  openSlot = +b.dataset.slot;
  renderBuilder();
  const first = $("bSlotPick").querySelector('button[aria-pressed="true"]') || $("bSlotPick").querySelector("button");
  if (first) first.focus();
});
$("bSlotPick").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-upg]");
  if (!b || openSlot === null) return;
  build.up[openSlot] = +b.dataset.upg < 0 ? null : +b.dataset.upg;
  hideTip(true);
  renderBuilder();
  const again = $("bSlotPick").querySelector(`[data-upg="${b.dataset.upg}"]`);
  if (again) again.focus();
});
// Leiste: öffnet den Bereich (Upgrade-Icon: direkt diesen Slot); erneuter Klick auf die Überschrift schließt
$("bBar").addEventListener("click", (e) => {
  const slotBtn = e.target.closest("[data-open-slot]"), b = e.target.closest("[data-pane]");
  if (slotBtn) { if (slotBtn.disabled) return; pane = "up"; openSlot = +slotBtn.dataset.openSlot; }
  else if (b) pane = b.classList.contains("bw-eqhead") && pane === b.dataset.pane ? null : b.dataset.pane;
  else return;
  hideTip(true); $("bInfo").innerHTML = "";
  renderBuilder();
  if (pane && !$("bEdit").hidden && window.matchMedia("(max-width: 999px)").matches) $("bEdit").scrollIntoView({ block: "nearest" });
});
$("bEditClose").addEventListener("click", () => { const was = pane; pane = null; $("bInfo").innerHTML = ""; renderBuilder(); const h = $("bBar").querySelector(`.bw-eqhead[data-pane="${was}"]`); if (h) h.focus(); });
$("bSkills").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-skill]");
  if (!b) return;
  const s = ship(build.id), id = +b.dataset.skill, k = BUILD.skills.find((x) => x.id === id);
  if (build.sk.includes(id)) {
    if (!canRemove(id, s.type)) { $("bInfo").innerHTML = `<p class="msg err">${esc(t("b.skillDep"))}</p>`; return; }
    build.sk = build.sk.filter((x) => x !== id);
  } else {
    if (!canAdd(k, s.type)) { $("bInfo").innerHTML = `<p class="msg err">${esc(t(skillPoints(s.type) + skillCost(k, s.type) > MAX_POINTS ? "b.noPoints" : "b.needTier"))}</p>`; return; }
    build.sk.push(id);
  }
  renderBuilder();
  $("bSkills").querySelector(`[data-skill="${id}"]`).focus();
});
$("bFlags").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-flag]");
  if (!b) return;
  const i = +b.dataset.flag;
  if (build.fl.includes(i)) build.fl = build.fl.filter((x) => x !== i);
  else if (build.fl.length < MAX_FLAGS) build.fl.push(i);
  else { $("bInfo").innerHTML = `<p class="msg err">${esc(t("b.maxFlags", { n: MAX_FLAGS }))}</p>`; return; }
  renderBuilder();
  $("bFlags").querySelector(`[data-flag="${i}"]`).focus();
});
$("bCons").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-cslot]");
  if (!b) return;
  build.cs[+b.dataset.cslot] = +b.dataset.copt;
  renderBuilder();
  $("bCons").querySelector(`[data-cslot="${b.dataset.cslot}"][data-copt="${b.dataset.copt}"]`).focus();
});
$("bOnlyChanged").checked = store.get("onlyChanged", true);
$("bOnlyChanged").addEventListener("change", () => { store.set("onlyChanged", $("bOnlyChanged").checked); renderBuilder(); });
$("bReset").addEventListener("click", () => { build.sel = null; build.up = EMPTY6(); build.sk = []; build.fl = []; build.cs = []; openSlot = null; $("bInfo").innerHTML = ""; renderBuilder(); });
$("bShare").addEventListener("click", () => {
  if (!BUILD || !BUILD.ships[build.id]) return;
  const url = `${location.origin}${location.pathname}?b=${shareCode()}#builder`;
  const msg = $("bMsg");
  const done = (ok) => { msg.className = ok ? "msg ok" : "msg"; msg.textContent = ok ? t("b.copied") : t("b.copyFailed", { url }); };
  if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => done(true), () => done(false)); else done(false);
});
function renderBuildPicker() {
  const q = nameKey($("bSearch").value.trim());
  const hits = q ? DATA.ships.filter((s) => nameKey(s.name).includes(q) || (s.nameDe && nameKey(s.nameDe).includes(q)))
    .sort((a, b) => (nameKey(a.name).startsWith(q) ? 0 : 1) - (nameKey(b.name).startsWith(q) ? 0 : 1) || b.tier - a.tier).slice(0, 8) : [];
  $("bResults").innerHTML = hits.map((s) => `<button type="button" class="ghost hit" data-id="${s.id}">${icon(s)}<span class="nm">${esc(shipName(s))}</span><span class="mini">${ROMAN[s.tier]} · ${esc(nationName(s.nation))}</span></button>`).join("") +
    (q && !hits.length ? `<p class="mini">${esc(t("cmp.noHit"))}</p>` : "");
}
$("bSearch").addEventListener("input", renderBuildPicker);
$("bSearch").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const first = $("bResults").querySelector("button[data-id]");
  if (first) first.click();
});
$("bResults").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-id]");
  if (!b) return;
  $("bSearch").value = ""; renderBuildPicker();
  // Fähigkeiten und Signale bleiben beim Schiffswechsel erhalten, soweit sie zur Klasse passen
  build.id = +b.dataset.id; build.sel = null; build.up = EMPTY6(); build.cs = []; openSlot = null;
  renderBuilder();
});

// ---------- Build im Vergleich (Overlay) ----------
// Das Overlay nutzt die Builder-Oberfläche; der Build des Builder-Reiters wird solange beiseitegelegt.
function openBuildDialog(i) {
  const e = state.cmp[i];
  if (!e || dlg) return;
  if (!BUILD) { const l = loadBuilder(); if (l) l.then(() => { if (BUILD) openBuildDialog(i); }); return; }
  if (!BUILD.ships[e.id]) return;
  dlg = { i, main: JSON.parse(JSON.stringify(build)) };
  Object.assign(build, (e.b && parseBuild(e.b)) || { id: e.id, sel: null, up: EMPTY6(), sk: [], fl: [], cs: [] });
  openSlot = null; $("bInfo").innerHTML = "";
  $("dlgBody").append($("bBody"), $("bDock"), $("bTip"));
  $("dlgTitle").textContent = t("dlg.title", { name: shipName(ship(e.id)) });
  $("dlgRemove").hidden = !e.b;
  $("dlgAdd").disabled = state.cmp.length >= MAX_CMP;
  renderBuilder();
  $("cmpDialog").showModal();
  $("dlgSave").focus();
}
function endBuildDialog(action) {
  if (!dlg) return;
  const { i, main } = dlg, code = shareCode();
  hideTip(true);
  dlg = null;
  Object.assign(build, main);
  openSlot = null; $("bInfo").innerHTML = "";
  $("v-builder").append($("bBody"), $("bDock"));
  document.body.append($("bTip"));
  if ($("cmpDialog").open) $("cmpDialog").close();
  if (action === "save") state.cmp[i].b = code;
  else if (action === "remove") state.cmp[i].b = null;
  else if (action === "add") addCompare(state.cmp[i].id, code, true);
  renderBuilder();
  changed();
  const head = $("cmpHead").querySelector(`[data-edit="${action === "add" ? state.cmp.length - 1 : i}"]`);
  if (head) head.focus();
}
$("dlgSave").addEventListener("click", () => endBuildDialog("save"));
$("dlgAdd").addEventListener("click", () => endBuildDialog("add"));
$("dlgRemove").addEventListener("click", () => endBuildDialog("remove"));
$("dlgClose").addEventListener("click", () => endBuildDialog("cancel"));
$("cmpDialog").addEventListener("close", () => endBuildDialog("cancel"));

// ---------- Reiter ----------
const VIEWS = ["techbaum", "vergleich", "builder"];
function showView() {
  const view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "techbaum";
  for (const id of VIEWS) $("v-" + id).hidden = id !== view;
  if (view === "builder" && DATA) { if (BUILD) renderBuilder(); else loadBuilder(); }
  document.querySelectorAll("nav.tabs a").forEach((el) => { if (el.dataset.view === view) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current"); });
}
window.addEventListener("hashchange", () => {
  showView();
  const nav = document.querySelector("nav.tabs");
  if (nav.getBoundingClientRect().top < 0) nav.scrollIntoView({ block: "start" });
});

function changed() {
  save();
  renderFilters(); renderTree(); renderExtra(); renderDetail(); renderCost(); renderCompare();
}

// ---------- Start ----------
showView();
const msg = $("loadMsg");
msg.textContent = t("msg.loading");
fetch("data/ships.json" + ASSET_V)
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then((d) => {
    DATA = d; IDX = indexShips(d.ships);
    msg.textContent = ""; msg.className = "msg";
    const date = new Date(d.built || d.fetched).toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" });
    $("eyebrow").textContent = t("eyebrow", { v: d.version });
    $("dataInfo").textContent = t("data.info", { n: fmt.format(d.ships.length), v: d.version });
    $("footData").textContent = t("foot.data", { v: d.version, date });
    if (state.sel && !ship(state.sel)) state.sel = null;
    changed();
    if (shared || location.hash === "#builder") { if (shared) location.hash = "#builder"; showView(); }
  })
  .catch(() => { msg.className = "msg err"; msg.textContent = t("msg.loadFailed"); });
})();
