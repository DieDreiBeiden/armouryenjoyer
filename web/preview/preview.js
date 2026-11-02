// Vorschau der drei Shipbuilder-Redesigns (statische Beispieldaten aus data.js, nur Bedienung, keine Rechnung)
(() => {
  "use strict";
  const P = window.PV, V = document.body.dataset.v;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const img = (path, alt = "") => `<img src="../assets/img/${path}.webp" alt="${esc(alt)}" width="48" height="48" decoding="async">`;

  // ---------- gemeinsame Bausteine ----------
  const shipHead = () => `<div class="pv-ship"><img src="../assets/img/ships/${P.ship.id}.webp" alt="" width="120" height="70"><div><div class="pv-name">${esc(P.ship.name)}</div><div class="mini">${esc(P.ship.sub)}</div></div></div>`;
  const delta = (r) => (r.c ? `<span class="pv-delta ${r.c}">${r.c === "up" ? "▲" : "▼"} ${esc(r.d)}</span>` : "");
  function statsTable(rows, { only = false } = {}) {
    let html = "", grp = "";
    for (const r of rows) {
      if (only && !r.c) continue;
      if (r.grp !== grp) { grp = r.grp; html += `<tr class="pv-grp"><th colspan="3">${esc(grp)}</th></tr>`; }
      html += `<tr class="${r.c ? "chg" : ""}"><th>${r.tag ? `<span class="ammo ${r.tag.toLowerCase()}">${r.tag}</span> ` : ""}${esc(r.label)}</th><td class="${r.c}">${esc(r.v)}</td><td>${delta(r)}</td></tr>`;
    }
    return `<table class="pv-table">${html}</table>`;
  }
  const modules = () => P.modules.map((m) => `<div class="pv-modrow"><span class="pv-tile">${img("modules/" + m.icon)}</span><div class="pv-chips">${m.opts.map((o) => `<button type="button" class="chip" aria-pressed="${o.on}">${esc(o.n)}</button>`).join("")}</div></div>`).join("");
  const slotBtn = (u, i, active) => `<button type="button" class="pv-slot${u.sel ? " filled" : ""}${active ? " active" : ""}" data-slot="${i}" title="${esc(u.sel ? u.sel.t : "Slot " + (i + 1))}">${u.sel && u.sel.icon ? img("upgrades/" + u.sel.icon, u.sel.t) : "<span>+</span>"}<em>${i + 1}</em></button>`;
  const slotOpts = (i) => P.upgrades[i].opts.map((o) => `<button type="button" class="pv-icon${o.on ? " on" : ""}" title="${esc(o.t)}">${o.icon ? img("upgrades/" + o.icon, o.t) : esc(o.t)}</button>`).join("");
  function skillGrid() {
    const rows = [1, 2, 3, 4].map((r) => `<div class="pv-cost">${r}<small>P</small></div>` + Array.from({ length: 6 }, (_, c) => {
      const k = P.skills.find((x) => x.r === r && x.c === c + 1);
      if (!k) return `<div></div>`;
      return `<button type="button" class="pv-skill${k.on ? " on" : k.ok ? "" : " locked"}" title="${esc(k.t)}">${img("skills/" + k.id, k.t)}${k.on ? '<i aria-hidden="true">✓</i>' : ""}</button>`;
    }).join("")).join("");
    return `<div class="pv-skills">${rows}</div>`;
  }
  const flags = () => `<div class="pv-flags">${P.flags.map((f) => `<button type="button" class="pv-icon flag${f.on ? " on" : ""}" title="${esc(f.t)}">${img("flags/" + f.key, f.t)}</button>`).join("")}</div>`;
  const cons = () => `<div class="pv-cons">${P.cons.map((opts, i) => `<div class="pv-consslot"><span class="mini">Slot ${i + 1}</span><div>${opts.map((c) => `<button type="button" class="pv-icon${c.on ? " on" : ""}" title="${esc(c.t)}">${img("consumables/" + c.a, c.t)}</button>`).join("")}</div></div>`).join("")}</div>`;
  // Ausrüstungsleiste: der ganze Build als kleine Icons
  function equipBar(interactive) {
    const sk = P.skills.filter((k) => k.on), fl = P.flags.filter((f) => f.on);
    const grp = (label, inner, key) => `<div class="pv-eq"><span class="pv-eqlabel">${label}</span><div class="pv-eqicons">${inner}</div>${interactive ? `<button type="button" class="pv-eqedit" data-pop="${key}">Ändern</button>` : ""}</div>`;
    return `<div class="pv-bar">
      ${grp("Upgrades", P.upgrades.map((u, i) => `<button type="button" class="pv-mini${u.sel ? "" : " empty"}" ${interactive ? `data-pop="up${i}"` : ""} title="${esc(u.sel ? u.sel.t : "leer")}">${u.sel && u.sel.icon ? img("upgrades/" + u.sel.icon) : "+"}</button>`).join(""), "up0")}
      ${grp("Verbrauch", P.cons.map((o) => `<span class="pv-mini">${img("consumables/" + o[0].a)}</span>`).join(""), "cons")}
      ${grp(`Kommandant <b>${P.points}/21</b>`, sk.map((k) => `<span class="pv-mini dark">${img("skills/" + k.id)}</span>`).join(""), "skills")}
      ${grp(`Signale <b>${fl.length}/8</b>`, fl.map((f) => `<span class="pv-mini">${img("flags/" + f.key)}</span>`).join(""), "flags")}
    </div>`;
  }
  const changedCount = P.rows.filter((r) => r.c).length;

  // ---------- A: Hafen-Reiter ----------
  if (V === "a") {
    const TABS = [["mod", "Module", "modules/Hull"], ["up", "Upgrades", null], ["cap", "Kommandant", null], ["sig", "Signale", null], ["con", "Verbrauch", null]];
    let tab = "up", slot = 4;
    const panel = () => {
      if (tab === "mod") return `<h3>Module</h3>${modules()}`;
      if (tab === "up") return `<h3>Upgrades</h3><div class="pv-slots">${P.upgrades.map((u, i) => slotBtn(u, i, i === slot)).join("")}</div>
        <div class="pv-pickfix"><div class="pv-pickhead">Slot ${slot + 1} – Auswahl bleibt hier, nichts verschiebt sich</div><div class="pv-icons">${slotOpts(slot)}</div></div>`;
      if (tab === "cap") return `<div class="pv-sub"><h3>Kommandant</h3><span class="pv-points">${P.points} / 21 Punkte</span></div>${skillGrid()}<p class="mini">Gewählt = gefüllte Kachel mit ✓ · gesperrt = abgeblendet · Zahl links = Kosten</p>`;
      if (tab === "sig") return `<div class="pv-sub"><h3>Signale</h3><span class="pv-points">${P.flags.filter((f) => f.on).length} / 8</span></div>${flags()}`;
      return `<h3>Verbrauchsmaterial</h3>${cons()}`;
    };
    const render = () => {
      $("app").innerHTML = `<div class="pva">
        <section class="panel pva-stats">${shipHead()}${equipBar(false)}<div class="pv-sub"><h2>Werte</h2><span class="mini">${changedCount} Änderungen</span></div><div class="pv-scroll">${statsTable(P.rows)}</div></section>
        <section class="panel pva-pick"><nav class="pva-rail" aria-label="Bereiche">${TABS.map(([k, l]) => `<button type="button" data-tab="${k}" aria-pressed="${tab === k}">${l}</button>`).join("")}</nav><div class="pva-panel">${panel()}</div></section></div>`;
    };
    render();
    $("app").addEventListener("click", (e) => {
      const t = e.target.closest("[data-tab]"), s = e.target.closest("[data-slot]");
      if (t) { tab = t.dataset.tab; render(); }
      if (s) { slot = +s.dataset.slot; render(); }
    });
  }

  // ---------- B: Kompakte Werkbank ----------
  if (V === "b") {
    const KPI = [["Überleben", ["Lebenspunkte", "Sichtbarkeit von Schiffen"]], ["Mobilität", ["Höchstgeschwindigkeit", "Ruderstellzeit"]], ["Hauptbatterie", ["Nachladezeit", "Reichweite"]], ["Torpedos", ["Nachladezeit", "Reichweite", "Schaden"]]];
    const kpi = () => `<div class="pvb-kpis">${KPI.map(([g, labels]) => `<div class="pvb-kpi"><div class="pv-eqlabel">${g}</div>${labels.map((l) => {
      const r = P.rows.find((x) => x.label === l && (x.grp === g || (g === "Mobilität" && x.grp === "Überleben") || (g === "Überleben" && x.grp === "Überleben")));
      return r ? `<div class="pvb-num"><span class="mini">${esc(l)}</span><strong class="${r.c}">${esc(r.v)}</strong>${delta(r)}</div>` : "";
    }).join("")}</div>`).join("")}</div>`;
    let pop = null, full = false;
    const popHtml = () => {
      if (!pop) return "";
      let body = "";
      if (pop.startsWith("up")) { const i = +pop.slice(2); body = `<div class="pv-pickhead">Upgrade-Slot ${i + 1}</div><div class="pv-slots small">${P.upgrades.map((u, j) => slotBtn(u, j, j === i)).join("")}</div><div class="pv-icons">${slotOpts(i)}</div>`; }
      if (pop === "skills") body = `<div class="pv-sub"><b>Kommandant</b><span class="pv-points">${P.points} / 21</span></div>${skillGrid()}`;
      if (pop === "flags") body = `<div class="pv-sub"><b>Signale</b></div>${flags()}`;
      if (pop === "cons") body = `<b>Verbrauchsmaterial</b>${cons()}`;
      return `<div class="pvb-pop" role="dialog" aria-label="Auswahl">${body}<button type="button" class="ghost sm" data-close>Fertig</button></div>`;
    };
    const render = () => {
      $("app").innerHTML = `<section class="panel pvb-top">${shipHead()}<div class="pvb-mods">${P.modules.map((m) => `<span class="pv-tile sm" title="${esc(m.opts.find((o) => o.on).n)}">${img("modules/" + m.icon)}</span>`).join("")}</div>${equipBar(true)}${popHtml()}</section>
        ${kpi()}
        <section class="panel"><button type="button" class="ghost sm" data-full>${full ? "Alle Werte ausblenden" : `Alle Werte anzeigen (${P.rows.length})`}</button>${full ? statsTable(P.rows) : statsTable(P.rows, { only: true })}</section>`;
    };
    render();
    $("app").addEventListener("click", (e) => {
      const p = e.target.closest("[data-pop]"), s = e.target.closest(".pvb-pop [data-slot]");
      if (s) { pop = "up" + s.dataset.slot; render(); return; }
      if (p) { pop = p.dataset.pop; render(); return; }
      if (e.target.closest("[data-close]")) { pop = null; render(); return; }
      if (e.target.closest("[data-full]")) { full = !full; render(); }
    });
  }

  // ---------- C: Geführter Build ----------
  if (V === "c") {
    const STEPS = ["Module", "Upgrades", "Kommandant", "Signale", "Verbrauch", "Übersicht"];
    let step = 1, slot = 0;
    const body = () => {
      if (step === 0) return modules();
      if (step === 1) return `<div class="pv-slots">${P.upgrades.map((u, i) => slotBtn(u, i, i === slot)).join("")}</div><div class="pv-pickfix"><div class="pv-pickhead">Slot ${slot + 1}</div><div class="pv-icons">${slotOpts(slot)}</div></div>`;
      if (step === 2) return `<div class="pv-sub"><span></span><span class="pv-points">${P.points} / 21 Punkte</span></div>${skillGrid()}`;
      if (step === 3) return flags();
      if (step === 4) return cons();
      return `${equipBar(false)}<div class="pv-sub"><h3>Werte mit Build</h3><span class="mini">${changedCount} Änderungen</span></div>${statsTable(P.rows)}<div class="row"><button type="button">Link kopieren</button><button type="button" class="ghost">In den Vergleich</button></div>`;
    };
    const keyRows = P.rows.filter((r) => r.c).slice(0, 6);
    const render = () => {
      $("app").innerHTML = `<section class="panel pvc">${shipHead()}
        <ol class="pvc-steps">${STEPS.map((s, i) => `<li><button type="button" data-step="${i}" aria-current="${i === step ? "step" : "false"}" class="${i < step ? "done" : ""}"><span>${i + 1}</span>${s}</button></li>`).join("")}</ol>
        <h2>${STEPS[step]}</h2><div class="pvc-body">${body()}</div>
        <div class="pvc-nav"><button type="button" class="ghost" data-go="-1" ${step === 0 ? "disabled" : ""}>Zurück</button><button type="button" data-go="1" ${step === STEPS.length - 1 ? "disabled" : ""}>Weiter: ${STEPS[step + 1] || ""}</button></div></section>
        <div class="pvc-dock">${keyRows.map((r) => `<span class="${r.c}">${esc(r.tag ? r.tag + " " : "")}${esc(r.label)}: ${esc(r.v)} <b>${esc(r.d)}</b></span>`).join("")}</div>`;
    };
    render();
    $("app").addEventListener("click", (e) => {
      const st = e.target.closest("[data-step]"), go = e.target.closest("[data-go]"), s = e.target.closest("[data-slot]");
      if (st) step = +st.dataset.step; else if (go) step = Math.max(0, Math.min(STEPS.length - 1, step + +go.dataset.go)); else if (s) slot = +s.dataset.slot; else return;
      render();
    });
  }
})();
