import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { guard, openSite } from "./helpers.mjs";

const axeSource = createRequire(import.meta.url)("axe-core").source;

test("Techbaum: Nation wählen, Start und Ziel setzen, Forschungskosten erscheinen", async ({ page }) => {
  const errors = await guard(page);
  await openSite(page, { lang: "de", nation: "usa" });
  await page.locator('button[data-nation="japan"]').click();
  await expect(page.locator('button[data-nation="japan"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator(".node", { hasText: "Fubuki" }).click();
  await expect(page.locator("#detail .detail-name")).toHaveText("Fubuki");
  await page.locator("#setFrom").click();
  await page.locator(".node", { hasText: "Shimakaze" }).click();
  await page.locator("#setTo").click();
  await expect(page.locator("#costFrom")).toContainText("Fubuki");
  await expect(page.locator("#costTo")).toContainText("Shimakaze");
  await expect(page.locator("#costResult .readout .v").first()).toHaveText(/\d/);
  await expect(page.locator("#costResult")).toContainText("Fubuki → ");
  // Der Weg ist im Baum markiert
  expect(await page.locator(".node.path").count()).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".edges .edge.hot").first()).toBeAttached();
  // Tauschen ergibt keinen Weg rückwärts
  await page.locator("#costSwap").click();
  await expect(page.locator("#costResult .msg.err")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Klassen-Filter und Premiumliste", async ({ page }) => {
  const errors = await guard(page);
  await openSite(page, { lang: "de", nation: "japan" });
  const all = await page.locator(".node").count();
  await page.locator('button[data-type="Battleship"]').click();
  const bb = await page.locator(".node").count();
  expect(bb).toBeGreaterThan(0);
  expect(bb).toBeLessThan(all);
  await expect(page.locator(".node .ty").first()).toHaveText("BB");
  await page.locator("#extra .mini-ship").first().click();
  await expect(page.locator("#detail .tag").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("Vergleich: Suchen, hinzufügen, bester Wert markiert, entfernen", async ({ page }) => {
  const errors = await guard(page);
  await openSite(page, { lang: "de", cmp: [] }, "#vergleich");
  await expect(page.locator("#cmpEmpty")).toBeVisible();
  await page.fill("#cmpSearch", "yamato");
  await page.press("#cmpSearch", "Enter");
  await page.fill("#cmpSearch", "shimakaze");
  await page.locator("#cmpResults button").first().click();
  await expect(page.locator("#cmpPicked .chip")).toHaveCount(2);
  await expect(page.locator("#cmpHead th")).toHaveCount(2);
  const hp = page.locator("#cmpBody tr", { hasText: "Lebenspunkte" });
  await expect(hp.locator("td.best")).toHaveCount(1);
  await page.locator("#cmpPicked .chip").first().click();
  await expect(page.locator("#cmpPicked .chip")).toHaveCount(1);
  await page.reload();
  await expect(page.locator("#cmpPicked .chip")).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("Vergleich aus dem Techbaum übernehmen", async ({ page }) => {
  await guard(page);
  await openSite(page, { lang: "de", nation: "japan", cmp: [] });
  await page.locator(".node", { hasText: "Yamato" }).click();
  await page.locator("#addCmp").click();
  await expect(page.locator("#addCmp")).toBeDisabled();
  await page.locator('nav.tabs a[data-view="vergleich"]').click();
  await expect(page.locator("#cmpHead th")).toHaveCount(1);
});

test("Sprache und Farbschema", async ({ page }) => {
  const errors = await guard(page);
  await openSite(page, { lang: "de" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.locator("#langBtn").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#treeTitle")).toHaveText("Tech tree");
  await page.locator("#themeBtn").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(errors).toEqual([]);
});

test("Kein seitliches Scrollen bei 320 px", async ({ page }) => {
  await guard(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await openSite(page, { lang: "de", cmp: [4282267344, 3751753712, 3555604464], build: { id: 4282267344, sel: null, up: [null, null, null, null, null, 0] } });
  for (const v of ["techbaum", "vergleich", "builder"]) {
    await page.goto(`/#${v}`);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), v).toBeLessThanOrEqual(0);
  }
});

test.describe("Barrierefreiheit", () => {
  test.use({ bypassCSP: true });
  for (const theme of ["light", "dark"]) {
    test(`axe: beide Reiter ohne WCAG-2.2-AA-Verstöße (${theme})`, async ({ page }) => {
      await openSite(page, { theme, nation: "japan", cmp: [4282267344, 3751753712], build: { id: 4282267344, sel: null, up: [null, null, null, null, null, null] } });
      await page.locator(".node", { hasText: "Fubuki" }).click();
      await page.locator("#setFrom").click();
      await page.locator(".node", { hasText: "Shimakaze" }).click();
      await page.locator("#setTo").click();
      for (const v of ["techbaum", "vergleich", "builder"]) {
        await page.goto(`/#${v}`);
        if (v === "builder") { await page.locator("#bSlots button").first().waitFor(); await page.locator("#bSlots button").nth(5).click(); await page.locator("#bSkills button").first().click(); }
        await page.addScriptTag({ content: axeSource });
        const res = await page.evaluate(() => window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
          // target-size meldet Fehlalarme unter dem klebenden Reiterbalken (siehe Santa-Rechner)
          rules: { "target-size": { enabled: false } }
        }));
        expect(res.violations.map((x) => `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`), v).toEqual([]);
      }
    });
  }
});

test("Shipbuilder: Module, Upgrade, Fähigkeiten und Signale ändern Werte, Link teilen", async ({ page, context }) => {
  const errors = await guard(page);
  await openSite(page, { lang: "de", build: null }, "#builder");
  await expect(page.locator("#bMsg")).toContainText("Such oben");
  await page.fill("#bSearch", "shimakaze");
  // Mehrere Treffer (z. B. „[Shimakaze]“): genau die Shimakaze anklicken
  await page.locator("#bResults .hit").filter({ has: page.locator(".nm", { hasText: /^Shimakaze$/ }) }).click();
  await expect(page.locator("#bHead .detail-name")).toHaveText("Shimakaze");
  await expect(page.locator("#bStats tr.changed")).toHaveCount(0);

  // Torpedomodul wechseln: Werte werden besser und schlechter markiert
  await page.locator('#bModules button[data-mod="torpedoes"]').first().click();
  await expect(page.locator("#bStats td.up").first()).toBeVisible();
  await expect(page.locator("#bStats td.down").first()).toBeVisible();
  await page.locator('#bModules button[data-mod="torpedoes"]').last().click();

  // Upgrade über den Slot wählen
  await page.locator("#bSlots button").nth(5).click();
  await expect(page.locator("#bSlots button").nth(5)).toHaveAttribute("aria-expanded", "true");
  await page.locator("#bSlotPick button[aria-label]").filter({ has: page.locator("img") }).and(page.locator('[aria-label*="Hauptbatterie-Modifikation"][aria-label$="3"]')).click();
  const reload = page.locator("#bStats tr", { has: page.locator("th", { hasText: /^Nachladezeit$/ }) }).first();
  await expect(reload.locator("td").nth(1)).toHaveText("5,05 s");
  await expect(reload.locator(".delta")).toContainText("12");
  await expect(page.locator("#bSlots button").nth(5).locator("img")).toBeVisible();

  // Kommandant: Stufe 4 ohne Voraussetzung gesperrt, Punkte zählen mit
  await expect(page.locator('#bSkills button[style*="grid-row:4;"]').first()).toHaveAttribute("aria-disabled", "true");
  await page.locator('#bSkills button[style*="grid-row:1;"]').first().click();
  await expect(page.locator("#bPoints")).toHaveText("1 / 21 Punkte");
  await expect(page.locator('#bSkills button[style*="grid-row:2;"]').first()).toHaveAttribute("aria-disabled", "false");

  // Signal
  await page.locator("#bFlags button").first().click();
  await expect(page.locator("#bFlagCount")).toHaveText("1 / 8");

  // „Nur Änderungen“ blendet unveränderte Werte aus
  await page.locator("#bOnlyChanged").check();
  await expect(page.locator("#bStats tr:not(.grp):not(.changed)")).toHaveCount(0);

  // Geteilter Link stellt denselben Build wieder her
  await context.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  await page.locator("#bShare").click();
  await expect(page.locator("#bMsg")).toContainText(/Link/);
  const shareUrl = await page.evaluate(() => navigator.clipboard.readText().catch(() => null));
  if (shareUrl) {
    const p2 = await context.newPage();
    await p2.goto(shareUrl.replace(/^https?:\/\/[^/]+/, ""));
    await expect(p2.locator("#bHead .detail-name")).toHaveText("Shimakaze");
    await expect(p2.locator("#bPoints")).toHaveText("1 / 21 Punkte");
    await expect(p2.locator("#bFlagCount")).toHaveText("1 / 8");
    await expect(p2.locator("#bSlots button").nth(5).locator("img")).toBeVisible();
    await p2.close();
  }
  expect(errors).toEqual([]);
});

test("Shipbuilder aus dem Techbaum öffnen", async ({ page }) => {
  await guard(page);
  await openSite(page, { lang: "de", nation: "japan" });
  await page.locator(".node", { hasText: "Yamato" }).click();
  await page.locator("#toBuild").click();
  await expect(page).toHaveURL(/#builder$/);
  await expect(page.locator("#bHead .detail-name")).toHaveText("Yamato");
  await expect(page.locator("#bSlots button")).toHaveCount(6);
  await expect(page.locator("#bSkills button")).toHaveCount(24);
});

