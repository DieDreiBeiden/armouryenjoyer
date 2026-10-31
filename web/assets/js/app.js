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
  const inCmp = state.cmp.includes(s.id);
  $("detail").innerHTML = `
    <div class="detail-head">${icon(s, "sicon big")}<div><div class="detail-name">${esc(shipName(s))}</div>
      <div class="mini">${esc(ROMAN[s.tier])} · ${esc(typeName(s.type))} · ${esc(nationName(s.nation))} ${tags}</div></div></div>
    <dl class="kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
    <div class="row">
      <button type="button" id="setFrom" class="${state.from === s.id ? "" : "ghost"}" aria-pressed="${state.from === s.id}">${esc(t("detail.setFrom"))}</button>
      <button type="button" id="setTo" class="${state.to === s.id ? "" : "ghost"}" aria-pressed="${state.to === s.id}">${esc(t("detail.setTo"))}</button>
      <button type="button" id="addCmp" class="ghost"${inCmp ? " disabled" : ""}>${esc(t(inCmp ? "detail.inCompare" : "detail.compare"))}</button>
    </div>`;
  $("setFrom").addEventListener("click", () => { state.from = state.from === s.id ? null : s.id; if (state.from === state.to) state.to = null; changed(); });
  $("setTo").addEventListener("click", () => { state.to = state.to === s.id ? null : s.id; if (state.from === state.to) state.from = null; changed(); });
  $("addCmp").addEventListener("click", () => { addCompare(s.id); });
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
  ["g.guns"],
  ["r.gun", (s) => (gun(s) ? t("v.gun", { n: gun(s).barrels, c: gun(s).caliber }) : null), null, 0],
  ["r.reload", (s) => (gun(s) ? gun(s).reload : null), (x) => t("u.s", { v: fmt2.format(x) }), -1],
  ["r.range", (s) => (gun(s) ? gun(s).range : null), (x) => t("u.km", { v: fmt2.format(x) }), 1],
  ["r.turn180", (s) => (gun(s) ? gun(s).turn180 : null), (x) => t("u.s", { v: fmt1.format(x) }), -1],
  ["r.disp", (s) => (gun(s) ? gun(s).disp : null), (x) => t("u.m", { v: fmt.format(x) }), -1],
  ["r.he", (s) => (gun(s) && gun(s).he ? gun(s).he.dmg : null), (x) => fmt.format(x), 1],
  ["r.burn", (s) => (gun(s) && gun(s).he ? gun(s).he.burn : null), (x) => t("u.pct", { v: fmt1.format(x) }), 1],
  ["r.hepen", (s) => (gun(s) && gun(s).he ? gun(s).he.pen : null), (x) => t("u.mm", { v: fmt.format(x) }), 1],
  ["r.hev", (s) => (gun(s) && gun(s).he ? gun(s).he.speed : null), (x) => t("u.ms", { v: fmt.format(x) }), 1],
  ["r.ap", (s) => (gun(s) && gun(s).ap ? gun(s).ap.dmg : null), (x) => fmt.format(x), 1],
  ["r.apv", (s) => (gun(s) && gun(s).ap ? gun(s).ap.speed : null), (x) => t("u.ms", { v: fmt.format(x) }), 1],
  ["r.sap", (s) => (gun(s) && gun(s).sap ? gun(s).sap.dmg : null), (x) => fmt.format(x), 1],
  ["r.sappen", (s) => (gun(s) && gun(s).sap ? gun(s).sap.pen : null), (x) => t("u.mm", { v: fmt.format(x) }), 1],
  ["g.torps"],
  ["r.tubes", (s) => (torp(s) ? torp(s).tubes : null), (x) => fmt.format(x), 1],
  ["r.treload", (s) => (torp(s) ? torp(s).reload : null), (x) => t("u.s", { v: fmt1.format(x) }), -1],
  ["r.trange", (s) => (torp(s) ? torp(s).range : null), (x) => t("u.km", { v: fmt1.format(x) }), 1],
  ["r.tdmg", (s) => (torp(s) ? torp(s).dmg : null), (x) => fmt.format(x), 1],
  ["r.tspeed", (s) => (torp(s) ? torp(s).speed : null), (x) => t("u.kn", { v: fmt.format(x) }), 1],
  ["r.tseen", (s) => (torp(s) ? torp(s).seen : null), (x) => t("u.km", { v: fmt2.format(x) }), -1],
  ["g.aa"],
  ["r.aa0", aaZone("far"), (x) => t("u.dps", { v: fmt.format(x) }), 1],
  ["r.aa0r", aaRange("far"), (x) => t("u.km", { v: fmt1.format(x) }), 1],
  ["r.aa1", aaZone("medium"), (x) => t("u.dps", { v: fmt.format(x) }), 1],
  ["r.aa1r", aaRange("medium"), (x) => t("u.km", { v: fmt1.format(x) }), 1],
  ["r.aa2", aaZone("near"), (x) => t("u.dps", { v: fmt.format(x) }), 1],
  ["r.aa2r", aaRange("near"), (x) => t("u.km", { v: fmt1.format(x) }), 1],
  ["r.sec", (s) => v(s.p.sec), (x) => t("u.km", { v: fmt1.format(x) }), 1]
];

function addCompare(id) {
  if (state.cmp.includes(id)) return;
  if (state.cmp.length >= MAX_CMP) { $("cmpResults").innerHTML = `<p class="msg err">${esc(t("cmp.full"))}</p>`; return; }
  state.cmp.push(id); changed();
}
function renderPicker() {
  const q = nameKey($("cmpSearch").value.trim());
  const hits = q ? DATA.ships.filter((s) => !state.cmp.includes(s.id) && (nameKey(s.name).includes(q) || (s.nameDe && nameKey(s.nameDe).includes(q))))
    .sort((a, b) => (nameKey(a.name).startsWith(q) ? 0 : 1) - (nameKey(b.name).startsWith(q) ? 0 : 1) || b.tier - a.tier).slice(0, 8) : [];
  $("cmpResults").innerHTML = hits.map((s) => `<button type="button" class="ghost hit" data-id="${s.id}">${icon(s)}<span class="nm">${esc(shipName(s))}</span><span class="mini">${ROMAN[s.tier]} · ${esc(nationName(s.nation))}</span></button>`).join("") +
    (q && !hits.length ? `<p class="mini">${esc(t("cmp.noHit"))}</p>` : "");
  $("cmpPicked").innerHTML = state.cmp.map((id) => ship(id)).filter(Boolean)
    .map((s) => `<button type="button" class="chip pick" data-id="${s.id}" aria-label="${esc(t("cmp.remove", { name: s.name }))}">${esc(shipName(s))} <span aria-hidden="true">×</span></button>`).join("");
}
function renderCompare() {
  state.cmp = state.cmp.filter((id) => ship(id));
  renderPicker();
  const list = state.cmp.map(ship);
  $("cmpEmpty").hidden = list.length > 0; $("cmpWrap").hidden = !list.length; $("cmpClear").disabled = !list.length;
  if (!list.length) return;
  $("cmpHead").innerHTML = `<tr><td></td>${list.map((s) => `<th scope="col">${icon(s)}<span class="cmp-name">${esc(shipName(s))}</span></th>`).join("")}</tr>`;
  let body = "";
  for (const [key, get, show, dir] of ROWS) {
    if (!get) { body += `<tr class="grp"><th scope="colgroup" colspan="${list.length + 1}">${esc(t(key))}</th></tr>`; continue; }
    const vals = list.map(get);
    if (vals.every((x) => x === null)) continue;
    const nums = vals.filter((x) => typeof x === "number");
    const best = dir && nums.length > 1 && new Set(nums).size > 1 ? (dir > 0 ? Math.max(...nums) : Math.min(...nums)) : null;
    body += `<tr><th scope="row">${esc(t(key))}</th>${vals.map((x) => {
      if (x === null) return `<td class="na">–</td>`;
      const txt = show ? show(x) : x;
      return x === best ? `<td class="best">${esc(txt)}<span class="visually-hidden"> (${esc(t("cmp.best"))})</span></td>` : `<td>${esc(txt)}</td>`;
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
  const b = e.target.closest("button[data-id]");
  if (b) { state.cmp = state.cmp.filter((id) => id !== +b.dataset.id); changed(); $("cmpSearch").focus(); }
});
$("cmpClear").addEventListener("click", () => { state.cmp = []; changed(); });

// ---------- Reiter ----------
const VIEWS = ["techbaum", "vergleich"];
function showView() {
  const view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "techbaum";
  for (const id of VIEWS) $("v-" + id).hidden = id !== view;
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
  })
  .catch(() => { msg.className = "msg err"; msg.textContent = t("msg.loadFailed"); });
})();
