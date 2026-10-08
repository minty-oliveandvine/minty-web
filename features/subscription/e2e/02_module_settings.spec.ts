// The module settings page in a browser, over a STUBBED API: the page model is served by
// page.route from the same fixtures the unit tests use (features/subscription/__fixtures__),
// because minty-subscription-api's modules router is a 501 stub until Part 2 step 3. What this
// proves is the page in the real app - the route, the proxy's gate, the chrome, the cards, what
// a CTA sends and where a seam goes - not the API. The API's answers are step 3's contract
// tests; a journey over the live API joins this file when the router lands.
//
// Credentials: the token is never verified here (nothing reaches the API), so the spec runs
// with stand-in credentials when E2E_* are unset. Located by role and text, never by class,
// and inside `main` where it counts: `next dev` adds its own dev-tools button and an empty
// alert outside the page.
import { expect, test, type Page } from "@playwright/test";

import { SUBSCRIPTION_API_URL, credentials, handoff, requireApp } from "../../../e2e/helpers";
import { ACCOUNTS } from "../__fixtures__/billing";
import { FIXTURES, NON_MANAGER, type FixtureFrame } from "../__fixtures__/modulePage";

import type { ModulePage } from "../api/moduleSettings";

const STUB_CREDS = {
  secret: "stub-the-api-never-sees-this",
  userId: "u-e2e",
  entityId: "e1",
  entityName: "Olive & Vine Limited",
};

const creds = () => credentials() ?? STUB_CREDS;
// The full id and a placeholder name: the page moves the address to the short id and the
// company's own name (lib/companyFromAddress.ts).
const MODULES = (id: string) => `/entity/${id}/company/settings/modules`;

/**
 * Serve the page model from a fixture and record every action posted; after the first action
 * the page model becomes `next` (the world changed because of it). Count-based switching would
 * be wrong: `next dev` runs React in StrictMode, which mounts the page twice and fetches twice.
 */
async function stubApi(page: Page, model: ModulePage, next?: ModulePage) {
  const posts: { action: string; body: unknown }[] = [];
  await page.route(`${SUBSCRIPTION_API_URL}/api/entities/*/modules`, (route) => {
    const body = posts.length > 0 && next ? next : model;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route(`${SUBSCRIPTION_API_URL}/api/entities/*/modules/**`, (route) => {
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
const frame = (letter: FixtureFrame): ModulePage => FIXTURES[letter];
const body = (page: Page) => page.getByRole("main");

test.describe("module settings page", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("03-A: the chrome, both cards and their CTAs", async ({ page }) => {
    const c = creds();
    await stubApi(page, frame("A"));
    await handoff(page, c, MODULES(c.entityId));

    await expect(page.getByRole("heading", { level: 2, name: "Modules" })).toBeVisible();
    // the browser tab names the company (lib/companyTitle.ts)
    await expect(page).toHaveTitle(`Modules - ${c.entityName}`);
    // "Back" goes where the person came from; its href is the new-tab fallback, Petty Cash's
    // dashboard (/petty-cash since 2026-10-05)
    await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      new RegExp(`/entity/${c.entityId}/petty-cash$`),
    );
    // exact: the route announcer also reads the tab title "Modules - <company>"
    await expect(page.getByText(c.entityName, { exact: true })).toBeVisible();
    const tabs = page.getByRole("navigation", { name: "Settings sections" });
    await expect(tabs.getByRole("link", { name: "Users" })).toBeVisible();
    await expect(tabs.getByText("Modules")).toHaveAttribute("aria-current", "page");

    const petty = body(page).getByRole("article", { name: "Petty Cash" });
    const request = body(page).getByRole("article", { name: "Payment Request" });
    await expect(petty.getByText("3 days remaining")).toBeVisible();
    await expect(request.getByText("30 days trial available")).toBeVisible();
    // onboarding's card (300x366 with its frame), each CTA 34px under it, not inside it
    const under = (card: typeof petty) => card.locator("xpath=..");
    await expect(petty.getByRole("button")).toHaveCount(0);
    const manage = under(petty).getByRole("button", { name: "Manage Subscription" });
    await expect(manage).toBeVisible();
    await expect(under(request).getByRole("button", { name: "Start Free Trial" })).toBeVisible();
    for (const card of [petty, request]) {
      const box = (await card.boundingBox())!;
      expect([box.width, box.height]).toEqual([300, 366]);
    }
    const [card, cta] = [(await petty.boundingBox())!, (await manage.boundingBox())!];
    expect(cta.y - (card.y + card.height)).toBe(34);
    await expect(body(page).getByRole("alert")).toHaveCount(0);
  });

  test("Start Free Trial asks first, then posts and lands in place", async ({ page }) => {
    const c = creds();
    const posts = await stubApi(page, frame("A"), frame("B"));
    await handoff(page, c, MODULES(c.entityId));

    await body(page).getByRole("button", { name: "Start Free Trial" }).click();

    // 04-G's dialog, the same one the list asks with: nothing is posted until Confirm.
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("You've activated free trial for Payment Request."),
    ).toBeVisible();
    expect(posts).toEqual([]);
    await dialog.getByRole("button", { name: "Confirm" }).click();

    // The news is told HERE, in the cards' place (the user, 2026-10-08) - it used to leave for
    // the list's row (Figma RV11, `?started=`), which ended a journey begun on this page on
    // another, under a button offering to go back to a third.
    const landed = body(page).locator("[data-result='celebrate']");
    await expect(landed).toContainText("Congratulations!");
    await expect(landed).toContainText("Payment Request free trial has started — 30 days, free.");
    expect(posts).toEqual([{ action: "start-trial", body: { codes: ["PAYMENT_REQUEST"] } }]);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toMatch(/\/settings\/modules$/);
    // The cards are gone while it shows; the Settings chrome is not.
    await expect(body(page).getByRole("heading", { level: 2, name: "Modules" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

    // And its button leaves for the COMPANY's page - no token trade, because the entity page
    // is the company's and this token is already scoped to it.
    await landed.getByRole("button", { name: "Back to Company" }).click();
    await page.waitForURL((u) => /^\/entity\/[^/]+\/[^/]+$/.test(u.pathname));
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

  // A trial establishes no SUBSCRIBER, so a running trial nobody has confirmed offers Activate
  // Subscription - and the act lands on its result HERE, in the cards' place (the user,
  // 2026-10-08), rather than on a toast or on the list.
  test("activating lands on its result in place, and Back to Company leaves for the entity", async ({
    page,
  }) => {
    const c = creds();
    const before: ModulePage = { ...frame("A"), has_subscriber: false };
    // The after-model: the trial converts now, so it reads confirmed.
    const after: ModulePage = {
      ...frame("A"),
      has_subscriber: true,
      cards: frame("A").cards.map((card) =>
        card.code === "PETTY_CASH"
          ? { ...card, needs_card: false, needs_consent_only: false }
          : card,
      ),
    };
    await stubApi(page, before, after);
    await page.route(`${SUBSCRIPTION_API_URL}/api/me/billing/accounts`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(ACCOUNTS),
      }),
    );
    await handoff(page, c, MODULES(c.entityId));

    await body(page).getByRole("button", { name: "Activate Subscription" }).click();
    await page
      .getByRole("dialog")
      .first()
      .getByRole("button", { name: /^Confirm/ })
      .click();
    const sheet = page.getByRole("dialog", { name: "Billing Accounts" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Confirm" }).click();

    // In place: the result takes the cards' place and the page never navigated.
    const landed = body(page).locator("[data-result]");
    await expect(landed).toBeVisible();
    await expect(landed).toHaveAttribute("data-result", "celebrate");
    await expect(body(page).getByRole("heading", { level: 2, name: "Modules" })).toHaveCount(0);
    // Still on the settings page - it never navigated. (The address carries the company's
    // own name by now; the page rewrites the placeholder slug on load.)
    expect(new URL(page.url()).pathname).toMatch(/\/settings\/modules$/);
    // The chrome stays - the person is still inside Settings.
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

    // Its button carries its own words and leaves for the COMPANY's page, not the portal.
    await landed.getByRole("button", { name: "Back to Company" }).click();
    await page.waitForURL((u) => /^\/entity\/[^/]+\/[^/]+$/.test(u.pathname));
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

  test("03-F: the payment-failed banner, and 'here' opens the company's billing account", async ({
    page,
  }) => {
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
    // The failing card is the company's billing account's: its page (08-B), by `?entity=`.
    await page.waitForURL(
      (u) =>
        u.pathname.endsWith("/subscription/billing") && u.searchParams.get("entity") === c.entityId,
    );
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
