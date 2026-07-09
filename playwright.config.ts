import { defineConfig, devices } from "@playwright/test";

// E2E tests run against the localStorage demo-mode build (no
// VITE_SUPABASE_URL/ANON_KEY set), so they never need a live Supabase
// session — see src/App.tsx: no Supabase env -> MainApp renders directly,
// no auth gate. Each test starts from a cleared localStorage (see
// e2e/fixtures.ts), so tests don't leak client data into each other.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --port 5174",
    url: "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    env: {
      // explicitly empty so getSupabase() falls back to demo-mode even if
      // the developer's shell/.env has real Supabase creds exported
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_ANON_KEY: "",
    },
  },
});
