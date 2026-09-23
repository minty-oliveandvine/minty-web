// The billing area (Figma section 08) in a browser, over a STUBBED API: the portal's landing
// (08-A), the billing page with its cards and invoices (08-B), the "Update card" menu and what
// it does - promote (08-W), refuse to remove the default (08-R), remove another one - the empty
// and expired states (08-H, 08-I), and the card that just arrived (08-N → 08-S). Stripe's own
// card fields are not driven here (an iframe from js.stripe.com); the add screen is checked as
// a screen, with the key withheld. Stand-in credentials when E2E_* are unset (nothing reaches
// the API); located inside `main`.
import { expect, test, type Page } from "@playwright/test";

import {
  BILLING_API_URL,
  credentials,
  handoff,
  requireApp,
  subscriptionsDark,
} from "../../../e2e/helpers";
import {
  ADDED_CARD,
  WALLET_ADDED,
  WALLET_EXPIRED,
  WALLET_NONE,
  WALLET_TWO,
  invoicePage,
} from "../__fixtures__/billing";
import { subscriptionsPage } from "../__fixtures__/subscriptions";
import type { PayerPaymentMethods } from "../api/payerPortal";

const STUB_CREDS = {
  secret: "stub-the-api-never-sees-this",
  userId: "u-e2e",
  entityId: "",
  entityName: "",
};
const creds = () => credentials() ?? STUB_CREDS;
const body = (page: Page) => page.getByRole("main");

const json = (data: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(data),
});

/** The three reads the billing page makes, plus whatever a write answers. */
async function stubBilling(page: Page, wallet: PayerPaymentMethods) {
  const posts: { path: string; body: unknown }[] = [];
  let current = wallet;
  await page.route(`${BILLING_API_URL}/api/me/billing/payment-methods`, (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.fulfill(json(current));
    posts.push({ path: "/payment-methods", body: request.postDataJSON() });
    return route.fulfill(json(current));
  });
  await page.route(`${BILLING_API_URL}/api/me/billing/payment-methods/default`, (route) => {
    posts.push({ path: "/default", body: route.request().postDataJSON() });
    current = { ...current, default_id: route.request().postDataJSON().payment_method };
    return route.fulfill(json(current));
  });
  await page.route(`${BILLING_API_URL}/api/me/billing/payment-methods/remove`, (route) => {
    const id = route.request().postDataJSON().payment_method;
    posts.push({ path: "/remove", body: route.request().postDataJSON() });
    current = {
      ...current,
      methods: current.methods.filter((m) => m.id !== id),
      total: current.total - 1,
    };
    return route.fulfill(json(current));
  });
  await page.route(`${BILLING_API_URL}/api/me/billing/payment-methods/setup-intent`, (route) =>
    // No publishable key: the screen draws, Stripe's iframe never opens (see the header).
    route.fulfill(json({ client_secret: "", publishable_key: "", setup_intent: "seti_stub" })),
  );
  await page.route(`${BILLING_API_URL}/api/me/subscriptions?*`, (route) =>
    route.fulfill(json(subscriptionsPage())),
  );
  await page.route(`${BILLING_API_URL}/api/me/invoices?*`, (route) =>
    route.fulfill(json(invoicePage())),
  );
  return posts;
}

test.describe("billing", () => {
  test.beforeEach(async () => {
    await requireApp();
    test.skip(subscriptionsDark(), "dark: the portal goes to not-available");
  });

  test("08-A: the landing is the account at a glance, and Manage Subscription is the list", async ({
    page,
  }) => {
    await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription", { entity_id: "" });

    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText(
      "Subscription & Billing",
    );
    const payment = body(page).getByRole("region", { name: "Payment Method" });
    await expect(payment).toContainText("Olive Vine");
    await expect(payment).toContainText("28 Sep 2026");
    const overview = body(page).getByRole("region", { name: "Subscription Overview" });
    await expect(overview).toContainText("Active subscriptions");
    await expect(overview).toContainText("Trial ending");
    await expect(overview.locator("li[data-tone='failed']").first()).toContainText(
      "Payment failed",
    );

    await overview.getByRole("button", { name: "Manage Subscription" }).click();
    await page.waitForURL((u) => u.pathname === "/subscription/subscriptions");
    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText("Manage Subscriptions");
  });

  test("08-B: the next bill, the cards with the default first, and the invoices", async ({
    page,
  }) => {
    await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription/billing", { entity_id: "" });

    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText(
      "Manage billing details and Payment Methods",
    );
    const next = body(page).getByRole("region", { name: "Next billing" });
    await expect(next).toContainText("Olive Vine");
    await expect(next).toContainText("28 Sep 2026");
    // The list fixture holds companies whose payment failed, so the block is the 08-K one.
    await expect(next).toHaveAttribute("data-state", "failed");
    await expect(next).toContainText("Due Immediately");

    const rows = body(page).getByRole("region", { name: "Payment Methods" }).locator("li");
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText("Visa ending in 4121");
    await expect(rows.first()).toHaveAttribute("data-chip", "default");
    await expect(rows.first()).toContainText("Sep 2026");

    const invoices = body(page).getByRole("region", { name: "Invoice History" });
    await expect(invoices).toContainText("Amount (HK$)");
    await expect(invoices).toContainText("#11241234113");
    await expect(
      invoices.getByRole("link", { name: "Invoice #11241234113 (PDF)" }),
    ).toHaveAttribute("href", "https://invoice.stripe.test/in_1");
  });

  test("08-W: a saved card is promoted, and the chips swap", async ({ page }) => {
    const posts = await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription/billing", { entity_id: "" });
    const panel = body(page).getByRole("region", { name: "Payment Methods" });

    await panel.getByRole("button", { name: "Update card · Mastercard ending in 4651" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Set as default", "Edit", "Delete"]);
    await page.getByRole("menuitem", { name: "Set as default" }).click();

    await expect(panel.locator("li").first()).toContainText("Mastercard ending in 4651");
    await expect(panel.locator("li").first()).toHaveAttribute("data-chip", "default");
    expect(posts).toEqual([{ path: "/default", body: { payment_method: "pm_master4651" } }]);
  });

  test("08-R: the default card cannot go; another one can", async ({ page }) => {
    const posts = await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription/billing", { entity_id: "" });
    const panel = body(page).getByRole("region", { name: "Payment Methods" });

    await panel.getByRole("button", { name: "Update card · Visa ending in 4121" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const refused = page.getByRole("dialog", { name: "Remove default card?" });
    await expect(refused).toContainText("Visa 4121");
    await expect(refused).toContainText("Another card will need to be selected");
    await refused.getByRole("button", { name: "Go back" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(posts).toEqual([]);

    await panel.getByRole("button", { name: "Update card · Mastercard ending in 4651" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    const asked = page.getByRole("dialog", { name: "Remove this card?" });
    await asked.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(panel.locator("li")).toHaveCount(1);
    expect(posts).toEqual([{ path: "/remove", body: { payment_method: "pm_master4651" } }]);
  });

  test("08-H → 08-Y: no card saved, and the screen that adds one", async ({ page }) => {
    await stubBilling(page, WALLET_NONE);
    await handoff(page, creds(), "/subscription/billing", { entity_id: "" });

    await expect(body(page).getByText("No card saved")).toBeVisible();
    await body(page).getByRole("button", { name: "Add a payment method" }).click();
    await page.waitForURL((u) => u.pathname === "/subscription/billing/add");
    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText("Add Card Details");
    await expect(body(page).getByText(/never stored by Minty/)).toBeVisible();
  });

  test("08-I: the card being charged has expired", async ({ page }) => {
    await stubBilling(page, WALLET_EXPIRED);
    await handoff(page, creds(), "/subscription/billing", { entity_id: "" });

    const alert = body(page).getByRole("alert");
    await expect(alert).toContainText("Your card expired on Aug 2026.");
    const rows = body(page).getByRole("region", { name: "Payment Methods" }).locator("li");
    await expect(rows.first()).toHaveAttribute("data-chip", "expired");
  });

  test("08-N → 08-S: the card that just arrived, and making it the default", async ({ page }) => {
    const posts = await stubBilling(page, WALLET_ADDED);
    await handoff(page, creds(), `/subscription/billing?added=${ADDED_CARD.id}`, { entity_id: "" });

    const told = page.getByRole("dialog");
    await expect(told).toContainText("New Card added Successfully");
    await expect(told).toContainText("Mastercard 8842 is added successfully.");
    await expect(told).toContainText("This card is not your default payment method.");
    await told.getByRole("button", { name: "Set as default" }).click();
    await expect(told).toContainText("This card is set as the default payment method.");
    await expect(told.getByRole("button", { name: "Set as default" })).toHaveCount(0);
    expect(posts).toEqual([{ path: "/default", body: { payment_method: ADDED_CARD.id } }]);
    await told.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
