// Forschungsbaum: Pfade und Kosten zwischen zwei Schiffen, Anordnung des Techbaums.
// Reine Funktionen ohne DOM, damit sie in Node getestet werden können.

const TYPE_ORDER = ["Destroyer", "Cruiser", "Battleship", "AirCarrier", "Submarine"];

// Index über alle Schiffe: id -> Schiff, id -> Vorgänger
function indexShips(ships) {
  const byId = new Map(ships.map((s) => [s.id, s]));
  const prev = new Map();
  for (const s of ships) for (const to of Object.keys(s.next || {})) {
    const id = +to;
    if (!byId.has(id)) continue;
    if (!prev.has(id)) prev.set(id, []);
    prev.get(id).push(s.id);
  }
  return { byId, prev };
}

// Kürzester Forschungspfad entlang der Nachfolger (Breitensuche); null, wenn es keinen gibt
function findPath(idx, fromId, toId) {
  if (fromId === toId) return [fromId];
  const back = new Map([[fromId, null]]);
  const queue = [fromId];
  while (queue.length) {
    const cur = queue.shift();
    const s = idx.byId.get(cur);
    for (const to of Object.keys((s && s.next) || {})) {
      const id = +to;
      if (back.has(id) || !idx.byId.has(id)) continue;
      back.set(id, cur);
      if (id === toId) {
        const path = [id];
        for (let p = cur; p !== null; p = back.get(p)) path.unshift(p);
        return path;
      }
      queue.push(id);
    }
  }
  return null;
}

// Kosten, um auf `from` das Schiff `toId` freizuschalten: Module bis zum freischaltenden Modul plus Schiff.
// mods: [id, EP, Credits, nächste Schiffe, nächste Module, Standard]
function edgeCost(from, toId) {
  const mods = from.mods || [];
  const parent = new Map();
  for (const m of mods) for (const child of m[4]) parent.set(child, m[0]);
  const byId = new Map(mods.map((m) => [m[0], m]));
  let best = null;
  for (const m of mods) {
    if (!m[3].includes(toId)) continue;
    // Kette vom freischaltenden Modul zurück bis zum Standardmodul
    let xp = 0, credits = 0, cur = m, guard = 0;
    while (cur && guard++ < 50) {
      if (!cur[5]) { xp += cur[1]; credits += cur[2]; }
      cur = byId.get(parent.get(cur[0]));
    }
    if (!best || xp < best.xp) best = { xp, credits };
  }
  return { moduleXp: best ? best.xp : 0, moduleCredits: best ? best.credits : 0, shipXp: (from.next || {})[toId] || 0 };
}

function researchCost(idx, fromId, toId) {
  const path = findPath(idx, fromId, toId);
  if (!path) return null;
  let shipXp = 0, moduleXp = 0, credits = 0;
  const steps = [];
  for (let i = 1; i < path.length; i++) {
    const from = idx.byId.get(path[i - 1]), to = idx.byId.get(path[i]);
    const e = edgeCost(from, to.id);
    shipXp += e.shipXp; moduleXp += e.moduleXp;
    credits += e.moduleCredits + (to.credit || 0);
    steps.push({ from: from.id, to: to.id, ...e, price: to.credit || 0 });
  }
  return { path, steps, shipXp, moduleXp, xp: shipXp + moduleXp, credits };
}

// Techbaum einer Nation: nur erforschbare Schiffe; jede Linie in einer eigenen Zeile.
// Ergebnis: Knoten mit Spalte (Stufe) und Zeile, Kanten zwischen Knoten.
function layoutTree(ships, nation, type) {
  const inTree = (s) => s.nation === nation && !s.prem && !s.special && (!type || s.type === type);
  const nodes = ships.filter(inTree);
  const ids = new Set(nodes.map((s) => s.id));
  const children = new Map(nodes.map((s) => [s.id, []]));
  const hasParent = new Set();
  for (const s of nodes) for (const to of Object.keys(s.next || {})) {
    if (!ids.has(+to)) continue;
    children.get(s.id).push(+to);
    hasParent.add(+to);
  }
  const byId = new Map(nodes.map((s) => [s.id, s]));
  const order = (a, b) => {
    const x = byId.get(a), y = byId.get(b);
    return TYPE_ORDER.indexOf(x.type) - TYPE_ORDER.indexOf(y.type) || x.tier - y.tier || x.name.localeCompare(y.name, "en");
  };
  for (const list of children.values()) list.sort(order);
  // Wurzeln: Schiffe ohne Vorgänger im Baum; Einzelschiffe ohne jede Verbindung fallen weg
  const roots = nodes.filter((s) => !hasParent.has(s.id) && children.get(s.id).length).map((s) => s.id).sort(order);
  const pos = new Map(), used = new Set();
  let rows = 0;
  // Der erste Nachfolger bleibt in der Zeile; ist der Platz belegt (Zweig auf derselben Stufe), bekommt er eine neue
  const place = (id, row) => {
    if (pos.has(id)) return;
    const col = byId.get(id).tier;
    if (used.has(`${col}/${row}`)) row = rows++;
    pos.set(id, { col, row }); used.add(`${col}/${row}`);
    children.get(id).forEach((c, i) => place(c, i === 0 ? row : rows++));
  };
  for (const r of roots) place(r, rows++);
  const edges = [];
  for (const [id, list] of children) for (const c of list) if (pos.has(id) && pos.has(c)) edges.push([id, c]);
  const placed = [...pos.entries()].map(([id, p]) => ({ id, ...p }));
  return { nodes: placed, edges, rows, maxTier: Math.max(0, ...placed.map((n) => n.col)) };
}
