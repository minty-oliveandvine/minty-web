// The Manage Subscriptions list in a browser, over a STUBBED API (features/subscription/
// __fixtures__/subscriptions served by page.route): the list from the landing (which is
// /subscription/subscriptions - /subscription itself is the overview, section 08-A), the transfer
// card, a row's cells, the ⋮ menu, the Start Trial dialog posting with the company's id, search,
// the empty state, a row opened in place (Figma 05·A, served from __fixtures__/modulePage), a tick
// pending (05·B), the modal that asks (06), where its confirmation lands (05·C), and what asks
// when it fails or gets interrupted (06·B).
// Stand-in credentials when E2E_* are unset (nothing reaches the API); located inside `main`.
import { expect, test, type Page } from "@playwright/test";

import {
  BILLING_API_URL,
  credentials,
  handoff,
  requireApp,
  subscriptionsDark,
} from "../../../e2e/helpers";
import { RESULT_FIXTURES, SUMMARY_FIXTURES, WALLET } from "../__fixtures__/modulePage";
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
  // The open row's two reads: every company opens as 05·A's M45 (one active, one cancelling).
  await page.route(`${BILLING_API_URL}/api/entities/*/modules`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(SUMMARY_FIXTURES.M45),
    }),
  );
  await page.route(`${BILLING_API_URL}/api/me/billing/entity-payment-method?*`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(WALLET) }),
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
    await handoff(page, creds(), "/subscription/subscriptions", { entity_id: "" });

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
    await handoff(page, creds(), "/subscription/subscriptions", { entity_id: "" });

    await body(page).getByRole("button", { name: "Actions for Solera Group Limited" }).click();
    await expect(page.getByRole("menuitem")).toHaveText([
      "Request transfer",
      "Cancel subscription",
      "Reactivate",
    ]);
    // 05·D: Cancel subscription is the tick of every active module - the row opens, the modal
    // asks for exactly that change (M45 for everyone: Petty Cash active, nothing else ticked).
    await page.getByRole("menuitem", { name: "Cancel subscription" }).click();
    const ask = page.getByRole("dialog", { name: "Cancel Subscription?" });
    await expect(ask).toBeVisible();
    await expect(ask).toContainText("Solera Group Limited");
    await ask.getByRole("button", { name: "Go back" }).click();
    const opened = body(page).locator("li[data-open]");
    await expect(opened).toHaveAttribute("data-entity", "e-solera-group-limited");
    await expect(
      opened.getByRole("checkbox", { name: "Petty Cash subscription" }),
    ).not.toBeChecked();
    await expect(opened.locator("[data-chip]")).toHaveText("Removing");
    // Request transfer is still a seam to the change-subscriber page.
    await opened.getByRole("button", { name: "Actions for Solera Group Limited" }).click();
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
    await handoff(page, creds(), "/subscription/subscriptions", { entity_id: "" });

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
    await handoff(page, creds(), "/subscription/subscriptions", { entity_id: "" });

    await body(page).getByRole("searchbox").fill("kestrel");
    await expect(
      body(page).getByRole("heading", { name: "Active Subscriptions (1 entity)" }),
    ).toBeVisible();
    await body(page).getByRole("searchbox").fill("acme holdings");
    await expect(body(page).getByText("Nothing matched that.")).toBeVisible();
  });

  test("04-B: nothing paid for", async ({ page }) => {
    await stubApi(page, subscriptionsPage([]));
    await handoff(page, creds(), "/subscription/subscriptions", { entity_id: "" });
    await expect(body(page).getByText("You're not paying for anything yet.")).toBeVisible();
    await expect(body(page).getByRole("link", { name: "Go to entity list" })).toBeVisible();
  });

  test("the module page's Manage Subscription lands on the company's row, opened", async ({
    page,
  }) => {
    await stubApi(page, subscriptionsPage());
    await handoff(page, creds(), "/subscription/subscriptions?entity=e-solera-group-limited", {
      entity_id: "",
    });
    const row = body(page).locator("li[data-entity='e-solera-group-limited']");
    await expect(row).toBeInViewport();
    await expect(row.getByRole("region", { name: "Subscription Summary" })).toBeVisible();
  });

  test("05·A: the chevron opens a row in place - cards, ticks, the summary, the seams", async ({
    page,
  }) => {
    await stubApi(page, subscriptionsPage());
    await handoff(page, creds(), "/subscription/subscriptions", { entity_id: "" });

    await body(page).getByRole("button", { name: "Open Kestrel Foods Limited" }).click();
    const row = body(page).locator("li[data-open]");
    await expect(row).toHaveAttribute("data-entity", "e-kestrel-foods-limited");
    const panel = row.getByRole("region", { name: "Subscription Summary" });
    await expect(panel).toBeVisible();
    // M45: Petty Cash active and ticked, Payment Request cancelling and unticked.
    await expect(row.getByRole("checkbox", { name: "Petty Cash subscription" })).toBeChecked();
    await expect(
      row.getByRole("checkbox", { name: "Payment Request subscription" }),
    ).not.toBeChecked();
    await expect(panel.getByText("(Cancellation in progress)")).toBeVisible();
    await expect(panel.getByText("HK$400")).toBeVisible();
    await expect(panel.getByText("Future Subscription")).toBeVisible();
    await expect(panel.getByText("HK$280")).toBeVisible();
    await expect(row.getByText(/was originally created/)).toBeVisible();
    // One open at a time: opening another closes this one.
    await body(page).getByRole("button", { name: "Open Mino Market Limited" }).click();
    await expect(body(page).locator("li[data-open]")).toHaveAttribute(
      "data-entity",
      "e-mino-market-limited",
    );
    await expect(body(page).locator("li[data-open]")).toHaveCount(1);
    // 05·B: a tick is a pending change, shown on the card and confirmed from the panel. Ticking
    // the cancelling Payment Request = Restoring; the confirm button is the seam to its flow.
    const opened = body(page).locator("li[data-open]");
    const restore = opened.getByRole("checkbox", { name: "Payment Request subscription" });
    await restore.click();
    await expect(restore).toBeChecked();
    await expect(restore).toHaveAttribute("data-changed", "true");
    // 05·B-C: the panel calculates for a beat before the change shows.
    await expect(opened.getByRole("status")).toHaveText("Calculating....");
    await expect(opened.locator("[data-chip]")).toHaveText("Restoring");
    // A second press undoes it.
    await restore.click();
    await expect(restore).not.toBeChecked();
    await expect(opened.locator("[data-chip]")).toHaveCount(0);
    await expect(opened.getByRole("button", { name: "Confirm Subscription Change" })).toHaveCount(
      0,
    );
    await restore.click();
    await expect(opened.getByRole("button", { name: "Confirm Subscription Change" })).toBeVisible();

    // 06·B: leaving with the tick pending asks first - Go Back stays, Discard changes goes.
    await opened.getByRole("button", { name: "Close Mino Market Limited" }).click();
    const leave = page.getByRole("dialog", { name: "Leave without saving?" });
    await expect(leave).toBeVisible();
    await leave.getByRole("button", { name: "Go Back" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opened.locator("[data-chip]")).toHaveText("Restoring");
    await opened.getByRole("button", { name: "Close Mino Market Limited" }).click();
    await page
      .getByRole("dialog", { name: "Leave without saving?" })
      .getByRole("button", { name: "Discard changes" })
      .click();
    await expect(body(page).locator("li[data-open]")).toHaveCount(0);
  });

  test("06·B: the bank declining a charge asks to try again, the ticks staying pending", async ({
    page,
  }) => {
    const posts = await stubApi(page, subscriptionsPage());
    await handoff(page, creds(), "/subscription/subscriptions", { entity_id: "" });
    // M45 for everyone: Payment Request winds down; restoring it is a renew the bank refuses.
    await page.route(`${BILLING_API_URL}/api/entities/*/modules/renew`, (route) =>
      route.fulfill({
        status: 402,
        contentType: "application/json",
        body: JSON.stringify({
          error:
            "We couldn't take the payment to restore this module. Please check your payment method and try again.",
        }),
      }),
    );
    await body(page).getByRole("button", { name: "Open Kestrel Foods Limited" }).click();
    const opened = body(page).locator("li[data-open]");
    await opened.getByRole("checkbox", { name: "Payment Request subscription" }).click();
    await opened.getByRole("button", { name: "Confirm Subscription Change" }).click();
    await page
      .getByRole("dialog", { name: "You have unlocked Super Minty" })
      .getByRole("button", { name: "Confirm" })
      .click();
    const failed = page.getByRole("dialog", { name: "Payment could not be processed" });
    await expect(failed).toBeVisible();
    await expect(failed).toContainText("Visa 4121");
    await expect(failed).not.toContainText("We'll automatically retry");
    await expect(failed).toContainText("If you've resolved the issue, feel free to try again.");
    await failed.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opened.locator("[data-chip]")).toHaveText("Restoring");
    expect(posts.filter((p) => p.url.endsWith("/renew"))).toHaveLength(0);
  });

  test("06 + 05·C: a change asks in its modal, then lands on its result - in the row, or on the cancellation page", async ({
    page,
  }) => {
    const posts = await stubApi(page, subscriptionsPage());
    await handoff(page, creds(), "/subscription/subscriptions", { entity_id: "" });
    const serveModules = (model: unknown) =>
      page.route(`${BILLING_API_URL}/api/entities/*/modules`, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(model),
        }),
      );

    // Restore the cancelling Payment Request (M45): once posted, the company reads as M44.
    await body(page).getByRole("button", { name: "Open Kestrel Foods Limited" }).click();
    const opened = body(page).locator("li[data-open]");
    await opened.getByRole("checkbox", { name: "Payment Request subscription" }).click();
    await serveModules(RESULT_FIXTURES.RW45.after);
    await opened.getByRole("button", { name: "Confirm Subscription Change" }).click();
    // The modal asks first: both ticked after the change is the bundle's modal.
    const unlock = page.getByRole("dialog", { name: "You have unlocked Super Minty" });
    await expect(unlock).toBeVisible();
    await expect(unlock).toContainText("You’ve activated both modules.");
    await expect(unlock).toContainText("Kestrel Foods Limited");
    expect(posts).toEqual([]);
    await unlock.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const result = body(page).locator("li[data-result]");
    await expect(result).toHaveAttribute("data-result", "celebrate");
    await expect(result).toHaveAttribute("data-entity", "e-kestrel-foods-limited");
    await expect(result).toContainText("Congratulations!");
    await expect(result).toContainText(
      "Payment Request is restored and billing carries on as before.",
    );
    await expect(result).toContainText("HK$400 a month.");
    expect(posts.map((p) => [p.url.split("/modules/")[1], p.body, p.entity])).toEqual([
      ["renew", { code: "PAYMENT_REQUEST" }, "e-kestrel-foods-limited"],
    ]);
    // Back: the list again, nothing open.
    await result.getByRole("button", { name: "Back to Manage Subscriptions" }).click();
    await expect(body(page).locator("li[data-result]")).toHaveCount(0);
    await expect(body(page).locator("li[data-open]")).toHaveCount(0);
    await expect(
      body(page).getByRole("button", { name: "Open Kestrel Foods Limited" }),
    ).toBeVisible();

    // Remove Petty Cash while Payment Request winds down (M45): the module cancellation page.
    await serveModules(SUMMARY_FIXTURES.M45);
    await body(page).getByRole("button", { name: "Open Mino Market Limited" }).click();
    const mino = body(page).locator("li[data-open]");
    await expect(mino.getByRole("checkbox", { name: "Petty Cash subscription" })).toBeChecked();
    await mino.getByRole("checkbox", { name: "Petty Cash subscription" }).click();
    await serveModules(RESULT_FIXTURES.RV45.after);
    await mino.getByRole("button", { name: "Confirm Subscription Change" }).click();
    // Nothing is ticked after (Payment Request winds down): Cancel Subscription?, in red; Go
    // back keeps the tick, then confirm for real.
    const ask = page.getByRole("dialog", { name: "Cancel Subscription?" });
    await expect(ask).toContainText("No modules are selected.");
    await ask.getByRole("button", { name: "Go back" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(mino.getByRole("checkbox", { name: "Petty Cash subscription" })).not.toBeChecked();
    await mino.getByRole("button", { name: "Confirm Subscription Change" }).click();
    await page
      .getByRole("dialog", { name: "Cancel Subscription?" })
      .getByRole("button", { name: "Confirm Cancellation" })
      .click();
    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText(
      "Module Cancellation Scheduled",
    );
    const cancelled = body(page).getByRole("region", { name: "Module Cancellation Scheduled" });
    await expect(cancelled.getByRole("heading", { level: 2 })).toHaveText(
      "Petty Cash Cancellation Confirmed",
    );
    await expect(cancelled).toContainText("Mino Market Limited");
    await expect(cancelled).toContainText(
      "We've received your cancellation request for Petty Cash.",
    );
    await expect(cancelled).toContainText(
      "Changed your mind? You can reactivate Petty Cash anytime!",
    );
    expect(posts.at(-1)).toMatchObject({
      body: { code: "PETTY_CASH" },
      entity: "e-mino-market-limited",
    });
    expect(posts.at(-1)!.url).toMatch(/\/modules\/cancel$/);
    await cancelled.getByRole("button", { name: "Back to Manage Subscriptions" }).click();
    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText("Manage Subscriptions");
    await expect(
      body(page).getByRole("button", { name: "Open Mino Market Limited" }),
    ).toBeVisible();
  });
});
