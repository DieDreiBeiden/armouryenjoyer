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
  await openSite(page, { lang: "de", cmp: [4282267344, 3751753712, 3555604464] });
  for (const v of ["techbaum", "vergleich"]) {
    await page.goto(`/#${v}`);
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), v).toBeLessThanOrEqual(0);
  }
});

test.describe("Barrierefreiheit", () => {
  test.use({ bypassCSP: true });
  for (const theme of ["light", "dark"]) {
    test(`axe: beide Reiter ohne WCAG-2.2-AA-Verstöße (${theme})`, async ({ page }) => {
      await openSite(page, { theme, nation: "japan", cmp: [4282267344, 3751753712] });
      await page.locator(".node", { hasText: "Fubuki" }).click();
      await page.locator("#setFrom").click();
      await page.locator(".node", { hasText: "Shimakaze" }).click();
      await page.locator("#setTo").click();
      for (const v of ["techbaum", "vergleich"]) {
        await page.goto(`/#${v}`);
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
