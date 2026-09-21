// The Manage Subscriptions list in a browser, over a STUBBED API (features/subscription/
// __fixtures__/subscriptions served by page.route - `/api/me/subscriptions` is a 501 stub until
// Part 2 step 3): the list from the landing, the transfer card, a row's cells, the ⋮ menu, the
// Start Trial dialog posting with the company's id, search, and the empty state.
// Stand-in credentials when E2E_* are unset (nothing reaches the API); located inside `main`.
import { expect, test, type Page } from "@playwright/test";

import {
  BILLING_API_URL,
  credentials,
  handoff,
  requireApp,
  subscriptionsDark,
} from "../../../e2e/helpers";
import { ENTITIES, INCOMING_TRANSFERS, subscriptionsPage } from "../__fixtures__/subscriptions";
import type { PayerSubscriptions } from "../api/payerPortal";

const STUB_CREDS = {
  secret: "stub-the-api-never-sees-this",
  userId: "u-e2e",
  entityId: "",
  entityName: "",
};
const creds = () => credentials() ?? STUB_CREDS;
const body = (page: Page) => page.getByRole("main");

async function stubApi(page: Page, list: PayerSubscriptions, transfers: unknown[] = []) {
  const posts: { url: string; body: unknown; entity: string | null }[] = [];
  await page.route(`${BILLING_API_URL}/api/me/subscriptions/transfers`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ transfers }),
    }),
  );
  await page.route(`${BILLING_API_URL}/api/me/subscriptions?*`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(list) }),
  );
  await page.route(`${BILLING_API_URL}/api/entities/*/modules/**`, (route) => {
    const req = route.request();
    posts.push({
      url: req.url(),
      body: req.postDataJSON(),
      entity: req.headers()["x-entity-id"] ?? null,
    });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  return posts;
}

test.describe("manage subscriptions", () => {
  test.beforeEach(async () => {
    await requireApp();
    test.skip(subscriptionsDark(), "dark: the portal goes to not-available");
  });

  test("04-A: the landing lands on the list with its rows, the transfer card and the sections", async ({
    page,
  }) => {
    await stubApi(page, subscriptionsPage(), INCOMING_TRANSFERS);
    await handoff(page, creds(), "/subscription", { entity_id: "" });

    await expect(
      body(page).getByRole("heading", { level: 1, name: "Manage Subscriptions" }),
    ).toBeVisible();
    await expect(body(page).getByText("New Company Limited")).toBeVisible();
    await expect(
      body(page).getByRole("heading", {
        name: `Active Subscriptions (${ENTITIES.length - 1} entities)`,
      }),
    ).toBeVisible();
    await expect(
      body(page).getByRole("heading", { name: "Suspended Subscriptions (1 entity)" }),
    ).toBeVisible();
    await expect(body(page).getByRole("alert")).toContainText("Payment failed.");
    const kestrel = body(page).locator("li", { hasText: "Kestrel Foods Limited" });
    await expect(kestrel.getByText("3 days remaining")).toBeVisible();
    await expect(kestrel.getByRole("button", { name: /^Start Trial ·/ })).toBeVisible();
  });

  test("the ⋮ menu shows the items the row's states call for", async ({ page }) => {
    await stubApi(page, subscriptionsPage());
    await handoff(page, creds(), "/subscription", { entity_id: "" });

    await body(page).getByRole("button", { name: "Actions for Solera Group Limited" }).click();
    await expect(page.getByRole("menuitem")).toHaveText([
      "Request transfer",
      "Cancel subscription",
      "Reactivate",
    ]);
    await page.getByRole("menuitem", { name: "Request transfer" }).click();
    await page.waitForURL(
      (u) =>
        u.pathname === "/subscription/subscriptions/subscriber" &&
        u.searchParams.get("entity") === "e-solera-group-limited",
    );
  });

  test("04-G: Start Trial asks, then posts with the company's id and the list reloads", async ({
    page,
  }) => {
    const posts = await stubApi(page, subscriptionsPage());
    await handoff(page, creds(), "/subscription", { entity_id: "" });

    await body(page)
      .getByRole("button", { name: "Start Trial · Petty Cash · Harbour & Vine Limited" })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Harbour & Vine Limited");
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect(dialog).toBeHidden();

    expect(posts).toEqual([
      {
        url: `${BILLING_API_URL}/api/entities/e-harbour-vine-limited/modules/start-trial`,
        body: { codes: ["PETTY_CASH"] },
        entity: "e-harbour-vine-limited",
      },
    ]);
  });

  test("search narrows the list and says so when nothing matches", async ({ page }) => {
    await stubApi(page, subscriptionsPage());
    await handoff(page, creds(), "/subscription", { entity_id: "" });

    await body(page).getByRole("searchbox").fill("kestrel");
    await expect(
      body(page).getByRole("heading", { name: "Active Subscriptions (1 entity)" }),
    ).toBeVisible();
    await body(page).getByRole("searchbox").fill("acme holdings");
    await expect(body(page).getByText("Nothing matched that.")).toBeVisible();
  });

  test("04-B: nothing paid for", async ({ page }) => {
    await stubApi(page, subscriptionsPage([]));
    await handoff(page, creds(), "/subscription", { entity_id: "" });
    await expect(body(page).getByText("You're not paying for anything yet.")).toBeVisible();
    await expect(body(page).getByRole("link", { name: "Go to entity list" })).toBeVisible();
  });

  test("the module page's Manage Subscription lands on the company's row", async ({ page }) => {
    await stubApi(page, subscriptionsPage());
    await handoff(page, creds(), "/subscription/subscriptions?entity=e-solera-group-limited", {
      entity_id: "",
    });
    const row = body(page).locator("li[data-entity='e-solera-group-limited']");
    await expect(row).toBeInViewport();
  });
});
