// Browser tests for minty-web. They run against a stack that is ALREADY UP (this app :3002,
// minty-billing-api :8004, Minty :5001) -- nothing is started here, for the reasons the
// onboarding and billing-frontend suites give: the stack has five moving parts, and a config
// that starts one of them starts the wrong one. See e2e/README.md.
//
// Two folders, one runner: e2e/ holds the shell's specs (landing, dark); the feature's own live
// journeys live inside its bounded folder (features/subscription/e2e/) and are picked up here,
// so lifting the feature out takes its specs with it.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["e2e/**/*.spec.ts", "features/*/e2e/**/*.spec.ts"],
  testIgnore: ["node_modules/**", ".next/**"],
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3002",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
