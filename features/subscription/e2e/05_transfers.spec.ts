// Handing a subscription over (Figma section 07) in a browser, over a STUBBED API: the payer
// picks the new subscriber and sends the request (07-A → 07-B), withdraws one already waiting
// (07-C → 07-K → 07-A); the recipient sees nothing waiting (07-F), reviews a request, changes
// the card it is charged to (07-D → 07-E → 07-D) and accepts it, landing on the list's row
// "Subscription Transfer Completed" (07-M). Stand-in credentials when E2E_* are unset (nothing
// reaches the API); located inside `main`.
import { expect, test, type Page } from "@playwright/test";

import {
  BILLING_API_URL,
  credentials,
  handoff,
  requireApp,
  subscriptionsDark,
} from "../../../e2e/helpers";
import { SUMMARY_FIXTURES, WALLET } from "../__fixtures__/modulePage";
import { ENTITIES, subscriptionsPage } from "../__fixtures__/subscriptions";
import {
  INCOMING_REQUEST,
  RECIPIENT_CARDS,
  SUBSCRIBER_OPTIONS,
  SUBSCRIBER_OPTIONS_PENDING,
} from "../__fixtures__/transfers";

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

test.describe("transfers", () => {
  test.beforeEach(async () => {
    await requireApp();
    test.skip(subscriptionsDark(), "dark: the portal goes to not-available");
  });

  test("07-A → 07-B: the payer picks the new subscriber and sends the request", async ({
    page,
  }) => {
    const posts: { url: string; body: unknown }[] = [];
    await page.route(`${BILLING_API_URL}/api/me/subscriptions/subscriber-options?*`, (route) =>
      route.fulfill(json(SUBSCRIBER_OPTIONS)),
    );
    await page.route(`${BILLING_API_URL}/api/me/subscriptions/transfer`, (route) => {
      posts.push({ url: route.request().url(), body: route.request().postDataJSON() });
      return route.fulfill(json({ ok: true, message: "The handover request has been sent." }));
    });
    await handoff(page, creds(), "/subscription/subscriptions/subscriber?entity=e-company-b", {
      entity_id: "",
    });

    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText("Transfer Subscription");
    const picker = body(page).getByRole("region", { name: "Select new subscriber" });
    await expect(picker.getByRole("radio", { name: /Harry Kim/ })).toBeDisabled();
    await expect(picker.getByText("Current")).toBeVisible();
    const request = picker.getByRole("button", { name: "Request transfer" });
    await expect(request).toBeDisabled();
    await picker.getByRole("radio", { name: /Jiwon Kim/ }).click();
    await expect(picker.getByText(/They’ll be charged HKD 88/)).toBeVisible();
    await expect(body(page).getByText(/You are still responsible for/)).toContainText(
      "paid up until",
    );
    await request.click();
    expect(posts).toEqual([
      {
        url: `${BILLING_API_URL}/api/me/subscriptions/transfer`,
        body: { entity: "e-company-b", to_user: "u-jiwon" },
      },
    ]);
    const done = body(page).getByRole("region", { name: "Transfer requested" });
    await expect(done).toContainText("Request has been sent to jiwon.kim@oliveandvine.com.");
    await done.getByRole("button", { name: "Back to Manage Subscription" }).click();
    await page.waitForURL(
      (u) =>
        u.pathname === "/subscription/subscriptions" &&
        u.searchParams.get("entity") === "e-company-b",
    );
  });

  test("07-C → 07-K: a request already waiting is withdrawn, then the picker is back", async ({
    page,
  }) => {
    let options = SUBSCRIBER_OPTIONS_PENDING;
    await page.route(`${BILLING_API_URL}/api/me/subscriptions/subscriber-options?*`, (route) =>
      route.fulfill(json(options)),
    );
    const posts: unknown[] = [];
    await page.route(`${BILLING_API_URL}/api/me/subscriptions/transfer/cancel`, (route) => {
      posts.push(route.request().postDataJSON());
      options = SUBSCRIBER_OPTIONS;
      return route.fulfill(json({ ok: true, message: "The handover request has been withdrawn." }));
    });
    await handoff(page, creds(), "/subscription/subscriptions/subscriber?entity=e-company-b", {
      entity_id: "",
    });
    const pending = body(page).getByRole("region", { name: "Request pending" });
    await expect(pending).toContainText("A request is already waiting.");
    await expect(pending).toContainText("to Jiwon Kim.");
    await expect(pending).toContainText("Pending");
    await pending.getByRole("button", { name: "Withdraw request" }).click();
    expect(posts).toEqual([{ transfer: "t-9" }]);
    const told = page.getByRole("dialog", { name: "Transfer request has been withdrawn" });
    await expect(told).toContainText("You can send a new request to anyone anytime.");
    await told.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(body(page).getByRole("region", { name: "Select new subscriber" })).toBeVisible();
  });

  test("07-F: nothing waiting for the recipient", async ({ page }) => {
    await page.route(`${BILLING_API_URL}/api/me/subscriptions/transfers`, (route) =>
      route.fulfill(json({ transfers: [] })),
    );
    await handoff(page, creds(), "/subscription/subscriptions/incoming", { entity_id: "" });
    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText("Subscription requests");
    const empty = body(page).getByRole("region", { name: "No requests waiting" });
    await expect(empty).toContainText("When someone asks you to take over billing");
    await empty.getByRole("button", { name: "Back to My Profile" }).click();
    await page.waitForURL((u) => u.pathname === "/subscription/subscriptions");
  });

  test("07-D → 07-E → 07-M: the recipient reviews, changes the card, accepts, and lands on the row", async ({
    page,
  }) => {
    const posts: { url: string; body: unknown }[] = [];
    let transfers = [INCOMING_REQUEST];
    let cards = RECIPIENT_CARDS;
    await page.route(`${BILLING_API_URL}/api/me/subscriptions/transfers`, (route) =>
      route.fulfill(json({ transfers })),
    );
    await page.route(`${BILLING_API_URL}/api/me/billing/payment-methods`, (route) =>
      route.fulfill(json(cards)),
    );
    await page.route(`${BILLING_API_URL}/api/me/billing/payment-methods/default`, (route) => {
      posts.push({ url: route.request().url(), body: route.request().postDataJSON() });
      cards = { ...cards, default_id: "pm_master8842" };
      return route.fulfill(json(cards));
    });
    await page.route(`${BILLING_API_URL}/api/entities/*/modules`, (route) =>
      route.fulfill(json(SUMMARY_FIXTURES.M24)),
    );
    await page.route(`${BILLING_API_URL}/api/me/subscriptions/transfer/respond`, (route) => {
      posts.push({ url: route.request().url(), body: route.request().postDataJSON() });
      transfers = [];
      return route.fulfill(json({ ok: true, message: "You're now the subscriber." }));
    });
    // After accepting: the list holds the company (the fixture's, renamed to the request's).
    const mine = { ...ENTITIES[3], entity_id: "e-new-company", entity_name: "New Company Limited" };
    await page.route(`${BILLING_API_URL}/api/me/subscriptions?*`, (route) =>
      route.fulfill(json(subscriptionsPage([mine, ...ENTITIES.slice(0, 2)]))),
    );
    await page.route(`${BILLING_API_URL}/api/me/billing/entity-payment-method?*`, (route) =>
      route.fulfill(json(WALLET)),
    );

    await handoff(page, creds(), "/subscription/subscriptions/incoming", { entity_id: "" });
    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText(
      "Transfer Subscription - Choose Modules",
    );
    const review = body(page).getByRole("region", { name: "Transfer request" });
    await expect(
      review.getByRole("checkbox", { name: "Payment Request subscription" }),
    ).toHaveAttribute("aria-checked", "true");
    const panel = review.getByRole("region", { name: "Subscription Summary" });
    await expect(panel).toContainText("Visa 4121");
    await expect(panel).toContainText("You’ll be charged HK$88 today");

    await panel.getByRole("button", { name: "Change" }).click();
    const picker = body(page).getByRole("region", { name: "Payment Methods" });
    // The radio is visually hidden; the card's label is what a person presses.
    await picker.getByText("Mastercard ending in 8842").click();
    await expect(picker.getByRole("radio", { name: /Mastercard ending in 8842/ })).toBeChecked();
    await picker.getByRole("button", { name: "Confirm" }).click();
    await expect(panel).toContainText("Mastercard 8842");

    await panel.getByRole("button", { name: "Confirm Subscription Transfer" }).click();
    await page.waitForURL(
      (u) =>
        u.pathname === "/subscription/subscriptions" &&
        u.searchParams.get("entity") === "e-new-company" &&
        u.searchParams.get("transferred") === "1",
    );
    expect(posts.map((p) => p.body)).toEqual([
      { payment_method: "pm_master8842" },
      { transfer: "t-1", accept: true },
    ]);
    const landed = body(page).locator("li[data-result='transferred']");
    await expect(landed).toContainText("Subscription Transfer Completed");
    await expect(landed).toContainText(
      "You are now the owner of the New Company Limited subscription and have full control of this Minty.",
    );
    await landed.getByRole("button", { name: "Back to Manage Subscriptions" }).click();
    await expect(body(page).locator("li[data-result]")).toHaveCount(0);
  });
});
