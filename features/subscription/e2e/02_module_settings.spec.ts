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
import { FIXTURES, NON_MANAGER, WALLET, type FixtureFrame } from "../__fixtures__/modulePage";
import { ENTITIES, subscriptionsPage } from "../__fixtures__/subscriptions";
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

/**
 * The payer's list holding exactly this company - what the browser reads when a trial started
 * here lands on the list. The id must be the one the token carries or there is no row to open.
 */
async function stubList(page: Page, entityId: string, entityName: string) {
  const list = subscriptionsPage([
    {
      ...ENTITIES[0],
      entity_id: entityId,
      entity_name: entityName,
      settings_path: `/entity/settings/module/${entityId}`,
    },
  ]);
  const json = (data: unknown) => ({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
  await page.route(`${BILLING_API_URL}/api/me/subscriptions/transfers`, (route) =>
    route.fulfill(json({ transfers: [] })),
  );
  await page.route(`${BILLING_API_URL}/api/me/subscriptions?*`, (route) =>
    route.fulfill(json(list)),
  );
  await page.route(`${BILLING_API_URL}/api/me/billing/entity-payment-method?*`, (route) =>
    route.fulfill(json(WALLET)),
  );
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
    const request = body(page).getByRole("article", { name: "Payment Request" });
    await expect(petty.getByText("3 days remaining")).toBeVisible();
    await expect(request.getByText("30 days trial available")).toBeVisible();
    // 03-A's redesign: the tall card, each CTA inside it
    await expect(petty.getByRole("button", { name: "Manage Subscription" })).toBeVisible();
    await expect(request.getByRole("button", { name: "Start Free Trial" })).toBeVisible();
    expect((await petty.boundingBox())?.height).toBe(504);
    expect((await request.boundingBox())?.height).toBe(504);
    await expect(body(page).getByRole("alert")).toHaveCount(0);
  });

  test("Start Free Trial asks first, then posts and lands on the Congratulations row", async ({
    page,
  }) => {
    const c = creds();
    const posts = await stubApi(page, frame("A"), frame("B"));
    await stubList(page, c.entityId, c.entityName);
    await handoff(page, c, MODULES(c.entityId));

    await body(page).getByRole("button", { name: "Start Free Trial" }).click();

    // 04-G's dialog, the same one the list asks with: nothing is posted until Confirm.
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("You've activated free trial for Payment Request."),
    ).toBeVisible();
    expect(posts).toEqual([]);
    await dialog.getByRole("button", { name: "Confirm" }).click();

    // The news is told on the list, in this company's row (Figma RV11).
    await page.waitForURL((u) => u.pathname === "/subscription/subscriptions");
    const landed = body(page).locator(`li[data-result='celebrate'][data-entity='${c.entityId}']`);
    await expect(landed).toContainText("Congratulations!");
    await expect(landed).toContainText("Payment Request free trial has started — 30 days, free.");
    expect(posts).toEqual([{ action: "start-trial", body: { codes: ["PAYMENT_REQUEST"] } }]);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Back to Manage Subscriptions leaves for the portal's landing (08-A).
    await landed.getByRole("button", { name: "Back to Manage Subscriptions" }).click();
    await page.waitForURL((u) => u.pathname === "/subscription");
    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText(
      "Subscription & Billing",
    );
  });

  test("04-G's modal is laid out as the design draws it, without the design's collision", async ({
    page,
  }) => {
    const c = creds();
    await stubApi(page, frame("A"));
    await handoff(page, c, MODULES(c.entityId));
    await body(page).getByRole("button", { name: "Start Free Trial" }).click();

    const dialog = page.getByRole("dialog");
    const box = async (l: ReturnType<typeof page.getByRole>) => (await l.boundingBox())!;
    const card = await box(dialog);
    expect(card.width).toBe(435);

    // "Entity" sits in the title's column: same left edge, same width, CLEAR of the last line
    // of it - and never colliding, which the design does when the title takes four lines.
    const heading = await box(dialog.getByRole("heading", { level: 2 }));
    const entity = await box(dialog.getByText(/^Entity/));
    expect(entity.x).toBe(heading.x);
    expect(entity.width).toBe(heading.width);
    // A real gap (it used to tuck 4px INTO the title's trailing leading, which read as one
    // block); still inside the card's rhythm rather than adrift from the sentence it belongs to.
    const offset = entity.y - (heading.y + heading.height);
    expect(offset).toBeGreaterThan(8);
    expect(offset).toBeLessThan(30);

    // The design's button row: equal widths, a 20px gap, 39px to each edge. The two share the
    // row, so their widths land on a half pixel - compare within one.
    const back = await box(dialog.getByRole("button", { name: "Go back" }));
    const confirm = await box(dialog.getByRole("button", { name: "Confirm" }));
    const near = (actual: number, expected: number) =>
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
    near(confirm.width, back.width);
    near(confirm.x - (back.x + back.width), 20);
    near(back.x - card.x, 39);
    near(card.x + card.width - (confirm.x + confirm.width), 39);
    expect(back.height).toBe(66);
  });

  test("Go back from the trial dialog posts nothing", async ({ page }) => {
    const c = creds();
    const posts = await stubApi(page, frame("A"));
    await handoff(page, c, MODULES(c.entityId));

    await body(page).getByRole("button", { name: "Start Free Trial" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Go back" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(posts).toEqual([]);
    await expect(
      body(page)
        .getByRole("article", { name: "Payment Request" })
        .getByText("30 days trial available"),
    ).toBeVisible();
  });

  test("a seam navigates to the flow's page under the module page", async ({ page }) => {
    const c = creds();
    await stubApi(page, frame("D"));
    await handoff(page, c, MODULES(c.entityId));

    // Activating is one module's pending change, so it lands on the list with it ticked.
    await body(page).getByRole("button", { name: "Activate Subscription" }).click();
    await page.waitForURL(
      (u) =>
        u.pathname === "/subscription/subscriptions" &&
        u.searchParams.get("tick") === "PETTY_CASH" &&
        u.searchParams.get("entity") === c.entityId,
    );
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
    // not 03-A: the cards end under the status line, equal to each other, the CTAs below
    const heights = await Promise.all(
      ["Petty Cash", "Payment Request"].map(async (name) => {
        const card = body(page).getByRole("article", { name });
        await expect(card.getByRole("button")).toHaveCount(0);
        return (await card.boundingBox())?.height ?? 0;
      }),
    );
    expect(heights[0]).toBe(heights[1]);
    expect(heights[0]).toBeLessThan(504);
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
