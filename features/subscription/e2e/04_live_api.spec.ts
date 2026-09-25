// The module settings page and the Manage Subscriptions list over the LIVE API - no page.route,
// no fixtures. What this proves is the contract meeting the screens: minty-billing-api's answers
// (Part 2 step 3) render as the pages expect, and two writes land and come back: Start Trial,
// as a running trial, and 08-C's address - typed into Stripe's own form, over real Stripe in
// test mode, and put back. Everything the stubbed specs pin (the chrome, every Figma state, the
// seams) stays in 02/03/06; this file only follows real data.
//
// Needs the whole stack up (this app :3002, minty-billing-api :8004 live) and the identity
// `Minty/scripts/e2e_seed.py --print` creates. The seed is the reset: it hands the
// "E2E Subscription Shop" (E2E_MINTY_SUBSCRIPTION_ENTITY) back with both modules OFF and no
// subscription rows, so the trial journey starts from "never held" on every run. Run it before
// every run - a second run without it finds the trial already started and skips that journey.
import { expect, test, type Page } from "@playwright/test";

import {
  BILLING_API_URL,
  handoff,
  mintModuleToken,
  requireCredentials,
  requireStack,
  subscriptionsDark,
  type Credentials,
} from "../../../e2e/helpers";

const SUBSCRIPTION_SHOP_NAME =
  process.env.E2E_MINTY_SUBSCRIPTION_ENTITY_NAME || "E2E Subscription Shop";

const body = (page: Page) => page.getByRole("main");
const MODULES = (id: string) => `/subscription/entities/${id}/modules`;

/** The subscription shop's credentials: the seeded user on the company the seed resets. */
function subscriptionShop(): Credentials {
  const base = requireCredentials();
  const entityId = process.env.E2E_MINTY_SUBSCRIPTION_ENTITY;
  test.skip(
    !entityId,
    "Set E2E_MINTY_SUBSCRIPTION_ENTITY (Minty/scripts/e2e_seed.py --print prints it)",
  );
  return { ...base, entityId: entityId as string, entityName: SUBSCRIPTION_SHOP_NAME };
}

/** What the API says about one company right now - read the way the page reads it. */
async function pageModel(creds: Credentials) {
  const token = mintModuleToken(creds);
  const res = await fetch(`${BILLING_API_URL}/api/entities/${creds.entityId}/modules`, {
    headers: { Authorization: `Bearer ${token}`, "X-Entity-Id": creds.entityId },
  });
  if (!res.ok) throw new Error(`page model: ${res.status} ${await res.text()}`);
  return (await res.json()) as {
    cards: { code: string; trial_eligible: boolean; subscription_status: string | null }[];
  };
}

test.describe("over the live API", () => {
  test.beforeEach(async () => {
    await requireStack();
    test.skip(subscriptionsDark(), "dark: the API answers 404 and the pages are out of sight");
  });

  test("the module settings page renders the company's real cards", async ({ page }) => {
    const c = requireCredentials();
    await handoff(page, c, MODULES(c.entityId));

    await expect(page.getByRole("heading", { level: 2, name: "Modules" })).toBeVisible();
    await expect(page.getByText(c.entityName)).toBeVisible();
    const cards = body(page).getByRole("article");
    await expect(cards).toHaveCount(2);
    await expect(body(page).getByRole("article", { name: "Petty Cash" })).toBeVisible();
    await expect(body(page).getByRole("article", { name: "Payment Request" })).toBeVisible();
    // Whatever state the seeded shop is in, the page is a page: no load error, no toast.
    await expect(body(page).getByText(/isn't served|went wrong/)).toHaveCount(0);
  });

  test("a card-free trial starts from the page and comes back as a running trial", async ({
    page,
  }) => {
    const c = subscriptionShop();
    const before = await pageModel(c);
    const eligible = before.cards.find((card) => card.code === "PAYMENT_REQUEST");
    test.skip(
      !eligible?.trial_eligible,
      "the subscription shop already holds Payment Request - re-run Minty/scripts/e2e_seed.py",
    );

    await handoff(page, c, MODULES(c.entityId));
    // The card's CTA sits beside the article in its list item, not inside it.
    const request = body(page).getByRole("article", { name: "Payment Request" });
    const item = body(page)
      .getByRole("listitem")
      .filter({ has: page.getByRole("article", { name: "Payment Request" }) });
    await expect(request.getByText("30 days trial available")).toBeVisible();

    await item.getByRole("button", { name: "Start Free Trial" }).click();
    // 04-G's dialog asks first, here as on the list.
    await page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();

    // The API opened the trial and the browser left for the list, where this company's row
    // says so (Figma RV11). The "30 days" is the web's own TRIAL_DAYS, not the API's term.
    await page.waitForURL((u) => u.pathname === "/subscription/subscriptions");
    const landed = body(page).locator(`li[data-result='celebrate'][data-entity='${c.entityId}']`);
    await expect(landed).toContainText("Congratulations!");
    await expect(landed).toContainText("Payment Request free trial has started — 30 days, free.");
    // The seed leaves the shop with nothing else running, so nothing bills.
    await expect(landed).toContainText("Nothing is being charged.");

    const after = await pageModel(c);
    const started = after.cards.find((card) => card.code === "PAYMENT_REQUEST");
    expect(started?.subscription_status).toBe("trialing");
    expect(started?.trial_eligible).toBe(false);
    // The other module was not touched - its own offer is still open.
    expect(after.cards.find((card) => card.code === "PETTY_CASH")?.trial_eligible).toBe(true);

    // Back to Manage Subscriptions leaves for the landing (08-A), over live data.
    await landed.getByRole("button", { name: "Back to Manage Subscriptions" }).click();
    await page.waitForURL((u) => u.pathname === "/subscription");
    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText(
      "Subscription & Billing",
    );
    // And the way out of the portal goes back to THIS company's modules, not the entity picker:
    // Minty routes /entity/<id>/modules to the module selection, or into the only module on.
    const backHref = await body(page)
      .getByRole("link", { name: "Back to the entity dashboard" })
      .getAttribute("href");
    expect(backHref).toContain(`/entity/${c.entityId}/enter?token=`);
    expect(backHref).toContain(encodeURIComponent(`/entity/${c.entityId}/modules`));
  });

  test("the landing and the billing page read the person's real billing accounts", async ({
    page,
  }) => {
    // Read-only: what minty-billing-api holds for this person, then the two pages over it.
    const c = requireCredentials();
    const res = await fetch(`${BILLING_API_URL}/api/me/billing/accounts`, {
      headers: { Authorization: `Bearer ${mintModuleToken(c, { entity_id: "" })}` },
    });
    expect(res.ok, `billing accounts: ${res.status}`).toBe(true);
    const data = (await res.json()) as {
      accounts: { id: string; name: string }[];
      next_billing: string | null;
    };
    expect(Array.isArray(data.accounts)).toBe(true);

    await handoff(page, c, "/subscription", { entity_id: "" });
    const card = body(page).getByRole("region", { name: "Billing account" });
    await expect(card).toBeVisible();
    // The accounts answered, so the card is on them - not on the payer-level fallback.
    await expect(card.getByText("I couldn't load your billing accounts.")).toHaveCount(0);
    if (data.next_billing) await expect(card).toContainText(data.next_billing);

    if (data.accounts.length > 0) {
      const [first] = data.accounts;
      await expect(card).toContainText(first.name);
      await card.getByText("Next Billing Date").click();
      const picker = page.getByRole("dialog", { name: "Billing Accounts" });
      await expect(picker.getByRole("radio")).toHaveCount(data.accounts.length);
      await page.keyboard.press("Escape");
      await card.getByRole("button", { name: /Go to payment details and invoices/ }).click();
      await page.waitForURL(
        (u) => u.pathname === "/subscription/billing" && u.searchParams.get("account") === first.id,
      );
      await expect(body(page).getByRole("region", { name: "Next billing" })).toContainText(
        first.name,
      );
    } else {
      // A person who has never been billed has no account: the billing page offers one.
      await handoff(page, c, "/subscription/billing", { entity_id: "" });
      await expect(body(page).getByText("No billing account yet")).toBeVisible();
    }
  });

  test("08-C's address is Stripe's own form, opened on the card - a change reaches the card, and is put back", async ({
    page,
  }) => {
    // WRITES the charged card's billing address at Stripe - TEST MODE only (skipped otherwise)
    // - and restores it, so the person's card ends as it started.
    const c = requireCredentials();
    const token = mintModuleToken(c, { entity_id: "" });
    const read = async () => {
      const res = await fetch(`${BILLING_API_URL}/api/me/billing/accounts?countries=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.ok, `billing accounts: ${res.status}`).toBe(true);
      return (await res.json()) as {
        publishable_key: string | null;
        accounts: {
          id: string;
          card: { cardholder: string | null } | null;
          address: { line1: string | null; line2: string | null } | null;
        }[];
      };
    };
    const data = await read();
    const account = data.accounts.find((a) => a.card && a.address?.line1);
    test.skip(!account, "the person has no account charging a card with an address");
    test.skip(!data.publishable_key?.startsWith("pk_test_"), "Stripe here is not in test mode");
    const { id, card, address } = account!;
    const line2 = address?.line2 ?? "";

    /** 08-C, with Stripe's form open on what the card holds. */
    const form = async () => {
      await handoff(page, c, `/subscription/billing/details?account=${id}`, { entity_id: "" });
      const region = body(page).getByRole("region", { name: "Address (Stripe)" });
      const stripe = region.locator('iframe[title="Secure address input frame"]').contentFrame();
      await expect(stripe.getByLabel("Address line 1")).toHaveValue(address!.line1!, {
        timeout: 20_000,
      });
      return stripe;
    };
    const save = async () => {
      await body(page).getByRole("button", { name: "Save billing account" }).click();
      await page.waitForURL(
        (u) => u.pathname === "/subscription/billing" && u.searchParams.get("account") === id,
      );
    };

    let stripe = await form();
    await expect(stripe.getByLabel("Full name")).toHaveValue(card!.cardholder ?? "");
    const marker = `E2E 08-C ${Date.now()}`;
    await stripe.getByLabel("Address line 2").fill(marker);
    await save();
    await expect(body(page).getByRole("region", { name: "Next billing" })).toContainText(marker);
    expect((await read()).accounts.find((a) => a.id === id)?.address?.line2).toBe(marker);

    stripe = await form();
    await stripe.getByLabel("Address line 2").fill(line2);
    await save();
    expect((await read()).accounts.find((a) => a.id === id)?.address?.line2 ?? "").toBe(line2);
  });

  test("the Manage Subscriptions list shows the companies the person pays for", async ({
    page,
  }) => {
    const c = subscriptionShop();
    // A trial makes its starter the payer; the list is the payer's companies. Without one the
    // seeded person pays for nothing and the list says so - both are real answers.
    const model = await pageModel(c);
    const holdsSomething = model.cards.some((card) => card.subscription_status !== null);

    await handoff(page, c, "/subscription/subscriptions", { entity_id: "" });

    await expect(
      body(page).getByRole("heading", { level: 1, name: "Manage Subscriptions" }),
    ).toBeVisible();
    if (holdsSomething) {
      const row = body(page).locator("li", { hasText: c.entityName });
      await expect(row).toBeVisible();
      await expect(row.getByText(/days remaining|Currently Active|Suspended/)).toBeVisible();

      // 05·A over the live API: the row opens on the company's real page model and card.
      await row.getByRole("button", { name: `Open ${c.entityName}` }).click();
      const open = body(page).locator("li[data-open]");
      const panel = open.getByRole("region", { name: "Subscription Summary" });
      await expect(panel).toBeVisible();
      await expect(open.getByRole("article")).toHaveCount(2);
      // The seeded shop just started a card-free Payment Request trial: a trial is not
      // billable, so the plan is the trial at nothing a month, and no card is on file.
      await expect(panel.getByText("(Free Trial)")).toBeVisible();
      await expect(panel.getByText(/^(HK\$|HKD ?)0$/)).toBeVisible();
      await expect(panel.getByText("Payment method")).toHaveCount(0);
      await expect(open.getByText(/was originally created/)).toBeVisible();
      // The footer's standing terms are not status, so they read under a company that bills
      // nothing - and the renewal sentence names a real date (the trial's end), not a blank.
      await expect(open.getByText(/Your next subscription renewal date is \d/)).toBeVisible();
      await expect(
        open.getByText(/auto-renew monthly until cancellation is initiated/),
      ).toBeVisible();
    } else {
      await expect(body(page).getByText("You're not paying for anything yet.")).toBeVisible();
    }
  });
});
