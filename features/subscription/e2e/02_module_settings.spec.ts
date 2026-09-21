// The module settings page in a browser, over a STUBBED API: the page model is served by
// page.route from the same fixtures the unit tests use (features/subscription/__fixtures__),
// because minty-billing-api's modules router is a 501 stub until Part 2 step 3. What this
// proves is the page in the real app - the route, the proxy's gate, the chrome, the cards, what
// a CTA sends and where a seam goes - not the API. The API's answers are step 3's contract
// tests; a journey over the live API joins this file when the router lands.
//
// Credentials: the token is never verified here (nothing reaches the API), so the spec runs
// with stand-in credentials when E2E_* are unset. Located by role and text, never by class,
// and inside `main` where it counts: `next dev` adds its own dev-tools button and an empty
// alert outside the page.
import { expect, test, type Page } from "@playwright/test";

import {
  BILLING_API_URL,
  credentials,
  handoff,
  requireApp,
  subscriptionsDark,
} from "../../../e2e/helpers";
import { FIXTURES, NON_MANAGER, type FixtureFrame } from "../__fixtures__/modulePage";
import type { ModulePage } from "../api/moduleSettings";

const STUB_CREDS = {
  secret: "stub-the-api-never-sees-this",
  userId: "u-e2e",
  entityId: "e1",
  entityName: "Olive & Vine Limited",
};

const creds = () => credentials() ?? STUB_CREDS;
const MODULES = (id: string) => `/subscription/entities/${id}/modules`;
const PAYMENTS_WEB_URL = (process.env.E2E_PAYMENTS_WEB_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);

/**
 * Serve the page model from a fixture and record every action posted; after the first action
 * the page model becomes `next` (the world changed because of it). Count-based switching would
 * be wrong: `next dev` runs React in StrictMode, which mounts the page twice and fetches twice.
 */
async function stubApi(page: Page, model: ModulePage, next?: ModulePage) {
  const posts: { action: string; body: unknown }[] = [];
  await page.route(`${BILLING_API_URL}/api/entities/*/modules`, (route) => {
    const body = posts.length > 0 && next ? next : model;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route(`${BILLING_API_URL}/api/entities/*/modules/**`, (route) => {
    const req = route.request();
    const action = new URL(req.url()).pathname.split("/modules/")[1];
    posts.push({ action, body: req.postDataJSON() });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  return posts;
}

const frame = (letter: FixtureFrame): ModulePage => FIXTURES[letter];
const body = (page: Page) => page.getByRole("main");

test.describe("module settings page", () => {
  test.beforeEach(async () => {
    await requireApp();
    test.skip(subscriptionsDark(), "dark: the page goes to not-available (see below)");
  });

  test("03-A: the chrome, both cards and their CTAs", async ({ page }) => {
    const c = creds();
    await stubApi(page, frame("A"));
    await handoff(page, c, MODULES(c.entityId) + "?from=bills");

    await expect(page.getByRole("heading", { level: 2, name: "Modules" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Payments" })).toHaveAttribute(
      "href",
      PAYMENTS_WEB_URL,
    );
    await expect(page.getByText(c.entityName)).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Settings sections" });
    await expect(tabs.getByRole("link", { name: "Users" })).toBeVisible();
    await expect(tabs.getByText("Module")).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("navigation", { name: "Subscription sections" })).toHaveCount(0);

    const petty = body(page).getByRole("article", { name: "Petty Cash" });
    await expect(petty.getByText("3 days remaining")).toBeVisible();
    await expect(
      body(page)
        .getByRole("article", { name: "Payment Request" })
        .getByText("30 days trial available"),
    ).toBeVisible();
    await expect(body(page).getByRole("button", { name: "Manage Subscription" })).toBeVisible();
    await expect(body(page).getByRole("button", { name: "Start Free Trial" })).toBeVisible();
    await expect(body(page).getByRole("alert")).toHaveCount(0);
  });

  test("Start Free Trial posts the module and the page shows the trial", async ({ page }) => {
    const c = creds();
    const posts = await stubApi(page, frame("A"), frame("B"));
    await handoff(page, c, MODULES(c.entityId));

    await body(page).getByRole("button", { name: "Start Free Trial" }).click();

    await expect(
      body(page).getByRole("article", { name: "Payment Request" }).getByText("15 days remaining"),
    ).toBeVisible();
    expect(posts).toEqual([{ action: "start-trial", body: { codes: ["PAYMENT_REQUEST"] } }]);
    // both trialing now: one shared CTA
    await expect(body(page).getByRole("button", { name: "Manage Subscription" })).toHaveCount(1);
  });

  test("a seam navigates to the flow's page under the module page", async ({ page }) => {
    const c = creds();
    await stubApi(page, frame("D"));
    await handoff(page, c, MODULES(c.entityId));

    await body(page).getByRole("button", { name: "Activate Subscription" }).click();
    await page.waitForURL((u) => u.pathname.endsWith("/modules/activate/PETTY_CASH"));
  });

  test("03-F: the payment-failed banner, and 'here' opens the payment method", async ({ page }) => {
    const c = creds();
    await stubApi(page, frame("F"));
    await handoff(page, c, MODULES(c.entityId));

    const banner = body(page).getByRole("alert");
    await expect(banner).toContainText("Payment failed. Update your payment method here.");
    await expect(body(page).getByRole("button", { name: "Reactivate Subscription" })).toHaveCount(
      2,
    );
    await banner.getByRole("button", { name: "here" }).click();
    await page.waitForURL((u) => u.pathname.endsWith("/modules/payment-method"));
  });

  test("back from Checkout: checkout-complete is posted once and session_id leaves the URL", async ({
    page,
  }) => {
    const c = creds();
    const posts = await stubApi(page, frame("C"));
    await handoff(page, c, MODULES(c.entityId) + "?from=bills&session_id=cs_test_1");

    await expect(body(page).getByText("Currently Active").first()).toBeVisible();
    expect(posts).toEqual([{ action: "checkout-complete", body: { session_id: "cs_test_1" } }]);
    const url = new URL(page.url());
    expect(url.searchParams.has("session_id")).toBe(false);
    expect(url.searchParams.get("from")).toBe("bills");

    await page.reload();
    await expect(body(page).getByText("Currently Active").first()).toBeVisible();
    expect(posts).toHaveLength(1);
  });

  test("someone who may not manage sees no buttons and who does", async ({ page }) => {
    const c = creds();
    await stubApi(page, NON_MANAGER);
    await handoff(page, c, MODULES(c.entityId));

    await expect(body(page).getByRole("article", { name: "Petty Cash" })).toBeVisible();
    await expect(body(page).getByRole("button")).toHaveCount(0);
    await expect(body(page).getByText(/managed by Priya Chan/)).toBeVisible();
  });
});

test.describe("dark", () => {
  test.beforeEach(async () => {
    await requireApp();
    test.skip(!subscriptionsDark(), "the app runs live (E2E_SUBSCRIPTIONS != 0)");
  });

  test("the module page goes to not-available", async ({ page }) => {
    const c = creds();
    await handoff(page, c, MODULES(c.entityId));
    expect(new URL(page.url()).pathname).toBe("/not-available");
  });
});
