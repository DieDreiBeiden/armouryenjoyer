import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: "http://127.0.0.1:4174", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], locale: "de-DE" } },
    { name: "mobile", use: { ...devices["Pixel 7"], locale: "en-US" } }
  ],
  webServer: { command: "python3 -m http.server 4174 --bind 127.0.0.1", url: "http://127.0.0.1:4174", reuseExistingServer: !process.env.CI, stderr: "ignore" }
});
