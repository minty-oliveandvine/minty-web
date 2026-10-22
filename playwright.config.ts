// Browser tests for minty-web. They run against a stack that is ALREADY UP (this app :3000,
// minty-subscription-api :8001, Minty :8000) -- nothing is started here, for the reasons the
// minty-onboarding-web and minty-payment-request-web suites give: the stack has five moving parts, and a config
// that starts one of them starts the wrong one. See e2e/README.md. The settings every app shares
// (one worker, traces on failure, E2E_BASE_URL) are @minty/shared/playwright's.
//
// Two folders, one runner: e2e/ holds the shell's specs (landing, terms); the feature's own live
// journeys live inside its bounded folder (features/subscription/e2e/) and are picked up here,
// so lifting the feature out takes its specs with it.
import { mintyPlaywright } from "@minty/shared/playwright";

export default mintyPlaywright({
  port: 3000,
  testDir: ".",
  testMatch: ["e2e/**/*.spec.ts", "features/*/e2e/**/*.spec.ts"],
});
