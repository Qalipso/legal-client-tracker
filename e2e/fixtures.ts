import { test as base } from "@playwright/test";

// Each test starts from a clean localStorage so demo-mode clients/tasks
// added by one test never leak into the next.
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto("/");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await use(page);
  },
});

export { expect } from "@playwright/test";
