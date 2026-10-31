// Gemeinsame Hilfen: fremde Hosts sperren, Konsolenfehler und CSP-Verstöße sammeln
export const ORIGIN = "http://127.0.0.1:4174";

export async function guard(page, { allow = [] } = {}) {
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  // Nichts darf ungeplant nach außen gehen; erlaubte Muster werden im Test selbst nachgebaut
  await page.context().route((url) => url.origin !== ORIGIN && !allow.some((re) => re.test(url.href)), (r) => {
    errors.push("unerwartete Anfrage: " + r.request().url());
    return r.abort();
  });
  return errors;
}

// Startet mit festen Einstellungen (nur beim ersten Laden des Tabs gesetzt)
export async function openSite(page, extra = {}, hash = "") {
  await page.addInitScript((kv) => {
    if (sessionStorage.getItem("e2e:init")) return;
    sessionStorage.setItem("e2e:init", "1");
    for (const [k, v] of Object.entries(kv)) localStorage.setItem("armoury:" + k, JSON.stringify(v));
  }, extra);
  await page.goto("/" + hash);
  // Daten geladen: die Fußzeile nennt Version und Datum (unabhängig vom sichtbaren Reiter)
  await page.waitForFunction(() => document.getElementById("footData").textContent.length > 0);
}
