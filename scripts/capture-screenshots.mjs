// One-off script to capture README screenshots against the localStorage
// demo-mode dev server. Not part of the app or test suite — run manually:
//   npm run dev -- --port 5176  (in another terminal, with VITE_SUPABASE_* unset)
//   node scripts/capture-screenshots.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:5176";
const OUT = new URL("../docs/screenshots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

async function setTheme(theme) {
  await page.evaluate((t) => {
    localStorage.setItem("legal-client-tracker:theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, theme);
}

await page.goto(BASE);
await page.waitForSelector("text=Legal Client Tracker");

// board — dark (default seed data already has 4 clients across statuses)
await setTheme("dark");
await page.reload();
await page.waitForSelector("text=Legal Client Tracker");
await page.screenshot({ path: `${OUT}board-dark.png` });

// board — light
await setTheme("light");
await page.reload();
await page.waitForSelector("text=Legal Client Tracker");
await page.screenshot({ path: `${OUT}board-light.png` });

// table view — light
await page.getByRole("button", { name: "Таблица" }).click();
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}table-light.png` });

// client drawer — light (open first client)
await page.locator("table button").first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}drawer-light.png` });
await page.keyboard.press("Escape").catch(() => {});
await page.getByRole("button", { name: "Закрыть карточку" }).click();

// drawer — dark
await setTheme("dark");
await page.reload();
await page.getByRole("button", { name: "Таблица" }).click();
await page.waitForTimeout(200);
await page.locator("table button").first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}drawer-dark.png` });

// settings — light
await setTheme("light");
await page.goto(`${BASE}/#/settings`);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}settings-light.png` });

await browser.close();
console.log("Screenshots saved to", OUT);
