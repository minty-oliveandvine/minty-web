// The billing area (Figma section 08) in a browser, over a STUBBED API: the portal's landing
// (08-A) - one billing account, picked by clicking its card, and its name ("Change billing
// account") moving a company between accounts - one account's page with its cards and invoices (08-B),
// the "Update card" menu and what it does - switch the card the account charges (08-W), refuse
// to remove that card (08-R), remove another one - the empty and expired states (08-H, 08-I),
// the card that just arrived (08-N → 08-S), the account's name and email (08-C), and the
// billing-account sheet - onboarding's list → New billing account form, in place, at its widths.
// Stripe's own fields are not driven here (iframes from js.stripe.com): the add screens and
// 08-C's address are checked as screens, with the key withheld - 04_live_api draws 08-C's. Stand-in credentials when E2E_* are unset
// (nothing reaches the API); located inside `main`, dialogs by role.
import { readFile } from "node:fs/promises";

import { expect, test, type Page, type Route } from "@playwright/test";

import {
  BILLING_API_URL,
  credentials,
  handoff,
  requireApp,
  subscriptionsDark,
} from "../../../e2e/helpers";
import {
  ADDED_CARD,
  BREAKDOWN,
  WALLET_ADDED,
  WALLET_EXPIRED,
  WALLET_NONE,
  WALLET_TWO,
  accountsFor,
  invoicePage,
} from "../__fixtures__/billing";
import { subscriptionsPage } from "../__fixtures__/subscriptions";
import type { BillingAccounts, PayerPaymentMethods } from "../api/payerPortal";
import { ADDRESS_UNAVAILABLE, TOO_LONG } from "../lib/billingAccounts";

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

/**
 * The billing area's reads, and what each write answers - STATEFUL, so a page that re-reads
 * after a write sees the write. `wallet`'s cards sit on Company A (`accountsFor`).
 */
async function stubBilling(page: Page, wallet: PayerPaymentMethods) {
  const posts: { path: string; body: Record<string, unknown> }[] = [];
  const invoiceQueries: string[] = [];
  /** "page/per_page" of every invoices read - the table's paging. */
  const invoicePages: string[] = [];
  let current: BillingAccounts = accountsFor(wallet);
  const post = (route: Route, path: string) => {
    const sent = route.request().postDataJSON() as Record<string, unknown>;
    posts.push({ path, body: sent });
    return sent;
  };
  const serveAccounts = (route: Route) => route.fulfill(json(current));
  await page.route(`${BILLING_API_URL}/api/me/billing/accounts`, serveAccounts);
  await page.route(`${BILLING_API_URL}/api/me/billing/accounts?*`, serveAccounts);
  await page.route(`${BILLING_API_URL}/api/me/billing/accounts/default-card`, (route) => {
    const sent = post(route, "/accounts/default-card");
    current = {
      ...current,
      accounts: current.accounts.map((a) =>
        a.id !== sent.account
          ? a
          : {
              ...a,
              default_id: String(sent.payment_method),
              card: a.cards.find((c) => c.id === sent.payment_method) ?? a.card,
              cards: a.cards.map((c) => ({ ...c, is_default: c.id === sent.payment_method })),
            },
      ),
    };
    return route.fulfill(json(current));
  });
  await page.route(`${BILLING_API_URL}/api/me/billing/accounts/move`, (route) => {
    const sent = post(route, "/accounts/move");
    const from = current.accounts.find((a) =>
      a.companies.some((c) => c.entity_id === sent.entity),
    )!;
    const company = from.companies.find((c) => c.entity_id === sent.entity)!;
    current = {
      ...current,
      accounts: current.accounts.map((a) =>
        a.id === from.id
          ? { ...a, companies: a.companies.filter((c) => c.entity_id !== sent.entity) }
          : a.id === sent.account
            ? { ...a, companies: [...a.companies, company] }
            : a,
      ),
    };
    const to = current.accounts.find((a) => a.id === sent.account)!;
    return route.fulfill(
      json({
        ...current,
        moved: {
          entity_id: company.entity_id,
          entity_name: company.entity_name,
          from_account: { id: from.id, name: from.name },
          to_account: { id: to.id, name: to.name },
        },
      }),
    );
  });
  await page.route(`${BILLING_API_URL}/api/me/billing/accounts/update`, (route) => {
    const sent = post(route, "/accounts/update");
    current = {
      ...current,
      accounts: current.accounts.map((a) =>
        a.id !== sent.account
          ? a
          : {
              ...a,
              name: (sent.billing_company as string) ?? a.name,
              billing_company: (sent.billing_company as string) ?? a.billing_company,
              address: sent.address
                ? { ...a.address!, ...(sent.address as Record<string, string>) }
                : a.address,
            },
      ),
    };
    return route.fulfill(json(current));
  });
  await page.route(`${BILLING_API_URL}/api/me/billing/payment-methods`, (route) =>
    route.fulfill(json(wallet)),
  );
  await page.route(`${BILLING_API_URL}/api/me/billing/payment-methods/remove`, (route) => {
    const sent = post(route, "/remove");
    current = {
      ...current,
      accounts: current.accounts.map((a) => ({
        ...a,
        cards: a.cards.filter((c) => c.id !== sent.payment_method),
      })),
    };
    return route.fulfill(json(wallet));
  });
  await page.route(`${BILLING_API_URL}/api/me/billing/payment-methods/setup-intent`, (route) =>
    // No publishable key: the screen draws, Stripe's iframe never opens (see the header).
    route.fulfill(json({ client_secret: "", publishable_key: "", setup_intent: "seti_stub" })),
  );
  await page.route(`${BILLING_API_URL}/api/me/subscriptions?*`, (route) =>
    route.fulfill(json(subscriptionsPage())),
  );
  await page.route(`${BILLING_API_URL}/api/me/invoices/*/breakdown`, (route) =>
    route.fulfill(json(BREAKDOWN)),
  );
  await page.route(`${BILLING_API_URL}/api/me/invoices?*`, (route) => {
    const params = new URL(route.request().url()).searchParams;
    invoiceQueries.push(params.get("account") ?? "");
    invoicePages.push(`${params.get("page")}/${params.get("per_page")}`);
    return route.fulfill(json(invoicePage()));
  });
  return { posts, invoiceQueries, invoicePages };
}

test.describe("billing", () => {
  test.beforeEach(async () => {
    await requireApp();
    test.skip(subscriptionsDark(), "dark: the portal goes to not-available");
  });

  test("08-A: one billing account at a glance, and Manage Subscription is the list", async ({
    page,
  }) => {
    await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription", { entity_id: "" });

    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText(
      "Subscription & Billing",
    );
    const account = body(page).getByRole("region", { name: "Billing account" });
    await expect(account).toContainText("Company A Limited");
    // The payer's NEXT billing date; the fixture's anchor (28 Jul) is never printed.
    await expect(account).toContainText("28 Sep 2026");
    await expect(account).not.toContainText("28 Jul 2026");
    await expect(account.getByText("Payment Method", { exact: true })).toHaveCount(0);
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

  test("08-A: clicking the card picks which account it shows; the URL carries it", async ({
    page,
  }) => {
    const { posts } = await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription", { entity_id: "" });

    const account = body(page).getByRole("region", { name: "Billing account" });
    await account.getByText("Next Billing Date").click();
    const picker = page.getByRole("dialog", { name: "Billing Accounts" });
    await expect(picker.getByRole("radio")).toHaveCount(3);
    // The label's TEXT is the target - the radio itself is sr-only.
    await picker.getByText("Vine Consulting Limited").click();
    await picker.getByRole("button", { name: "Confirm" }).click();

    await page.waitForURL((u) => u.searchParams.get("account") === "acc-vine");
    await expect(account).toContainText("Vine Consulting Limited");
    expect(posts).toEqual([]); // choosing what to look at writes nothing
  });

  test("08-A → 08-B: the link opens the shown account's page, not the picker", async ({ page }) => {
    const { invoiceQueries } = await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription?account=acc-vine", { entity_id: "" });

    const account = body(page).getByRole("region", { name: "Billing account" });
    await expect(account).toContainText("Vine Consulting Limited");
    await account.getByRole("button", { name: /Go to payment details and invoices/ }).click();
    await page.waitForURL(
      (u) => u.pathname === "/subscription/billing" && u.searchParams.get("account") === "acc-vine",
    );
    const next = body(page).getByRole("region", { name: "Next billing" });
    await expect(next).toContainText("Vine Consulting Limited");
    await expect(next).toContainText("Wan Chai, Hong Kong Island, Hong Kong");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(invoiceQueries).toContain("acc-vine");
  });

  test("Change billing account: a company moves in two steps, and the card says where", async ({
    page,
  }) => {
    const { posts } = await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription", { entity_id: "" });

    const account = body(page).getByRole("region", { name: "Billing account" });
    await account.getByRole("button", { name: /Change billing account/ }).click();
    const step1 = page.getByRole("dialog", { name: "Change billing account" });
    // A company whose payment failed stays where its debt is.
    await expect(step1.getByRole("radio", { name: /Willow Court Limited/ })).toBeDisabled();
    await step1.getByText("Nexora Health Limited").click();
    await step1.getByRole("button", { name: "Next" }).click();

    const step2 = page.getByRole("dialog", { name: "Move Nexora Health Limited to" });
    await expect(step2).not.toContainText("Nothing is charged now."); // the note was taken out
    await step2.getByText("Vine Consulting Limited").click();
    await step2.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(account.getByRole("status")).toHaveText(
      "Nexora Health Limited is now billed to Vine Consulting Limited.",
    );
    expect(posts).toEqual([
      {
        path: "/accounts/move",
        body: { entity: "e-nexora-health-limited", account: "acc-vine" },
      },
    ]);
  });

  test("07-I: a declined handover is told over the landing, once", async ({ page }) => {
    // The payer who ASKED learned by email or not at all until this: every other read of a
    // transfer filters on the open statuses, so a declined offer was invisible here.
    const posts: unknown[] = [];
    await stubBilling(page, WALLET_TWO);
    await page.route(`${BILLING_API_URL}/api/me/subscriptions?*`, (route) =>
      route.fulfill(
        json({
          ...subscriptionsPage(),
          transfer_outcomes: [
            {
              id: "t-9",
              entity_id: "e-company-b",
              entity_name: "Company B Limited",
              status: "declined",
              who: "Sonia Chan",
              responded_at: null,
            },
          ],
        }),
      ),
    );
    await page.route(`${BILLING_API_URL}/api/me/subscriptions/transfer/seen`, (route) => {
      posts.push(route.request().postDataJSON());
      return route.fulfill(json({ ok: true, message: "Done." }));
    });

    await handoff(page, creds(), "/subscription", { entity_id: "" });

    const told = page.getByRole("dialog", { name: "Sonia Chan declined the transfer" });
    await expect(told).toContainText("Company B Limited");
    await expect(told).toContainText("You can send a new request to anyone anytime.");
    await told.getByRole("button", { name: "Done" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    // The server marker is what keeps it closed tomorrow, and on every other device.
    expect(posts).toEqual([{ transfer: "t-9" }]);
  });

  test("08-B: one account - who it bills, its cards with its own first, its invoices", async ({
    page,
  }) => {
    const { invoicePages } = await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription/billing", { entity_id: "" });

    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText(
      "Manage billing details and Payment Methods",
    );
    const next = body(page).getByRole("region", { name: "Next billing" });
    await expect(next).toContainText("Company A Limited");
    await expect(next).toContainText("Unit 10, 1/F, ABC Building");
    await expect(next).toContainText("billing@companyalimited.com");
    await expect(next).toContainText("28 Sep 2026");
    // A company on THIS account failed to pay, so the block is the 08-K one.
    await expect(next).toHaveAttribute("data-state", "failed");
    await expect(next).toContainText("Due Immediately");
    // What the account's next renewal will charge, estimated by the API.
    await expect(next).toContainText("Amount");
    await expect(next).toContainText("HKD 960");
    await expect(next).toContainText("(estimated)");

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
    // Ten to a page until the payer picks 50 or 100 - which reads the first page at that size.
    const paging = invoices.getByRole("navigation", { name: "Invoice pages" });
    await expect(paging.getByLabel("Rows per page")).toHaveValue("10");
    expect(invoicePages.at(-1)).toBe("1/10");
    await paging.getByLabel("Rows per page").selectOption("50");
    await expect.poll(() => invoicePages.at(-1)).toBe("1/50");
  });

  test("08-B keeps the date and amount beside Bill to, however long the billing email", async ({
    page,
  }) => {
    // The regression: a wrapping row put the second column UNDER the first once the email was
    // long - "angelika.tardaguela+catalogue@..." did it on the dev database.
    await stubBilling(page, WALLET_TWO);
    const long = accountsFor(WALLET_TWO);
    const email = "angelika.tardaguela+catalogue@oliveandvinehk.com";
    long.accounts[0] = { ...long.accounts[0], billing_email: email };
    const serveLong = (route: Route) => route.fulfill(json(long));
    await page.route(`${BILLING_API_URL}/api/me/billing/accounts`, serveLong);
    await page.route(`${BILLING_API_URL}/api/me/billing/accounts?*`, serveLong);
    await handoff(page, creds(), "/subscription/billing", { entity_id: "" });

    const next = body(page).getByRole("region", { name: "Next billing" });
    // Wrapped, not clipped: all of it is on the page.
    await expect(next.getByText(email)).toBeVisible();
    const emailBox = (await next.getByText(email).boundingBox())!;
    const billTo = (await next.getByText("Bill to", { exact: true }).boundingBox())!;
    const date = (await next.getByText("Next Bill Date", { exact: true }).boundingBox())!;
    const amount = (await next.getByText("Amount", { exact: true }).boundingBox())!;
    // The second column: right of everything in the first, starting on Bill to's row.
    expect(date.x).toBeGreaterThan(emailBox.x + emailBox.width);
    expect(Math.abs(date.y - billTo.y)).toBeLessThan(8);
    expect(Math.abs(amount.x - date.x)).toBeLessThan(1);
    // Never mid-word ("…vinehk.co" / "m"): the email's two halves each keep to one line, so
    // when it wraps at all it wraps after the "@".
    const halves = await next.getByText(email).evaluate((p) =>
      Array.from(p.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => {
          const range = document.createRange();
          range.selectNodeContents(n);
          return range.getClientRects().length;
        }),
    );
    expect(halves).toEqual([1, 1]);
    // The third column is Minty: clear of the amount, against the card's right padding.
    const card = (await next.boundingBox())!;
    const value = (await next.getByText("HKD 960").boundingBox())!;
    const cat = (await next.locator('img[src*="/portal/minty-"]').locator("..").boundingBox())!;
    expect(cat.x).toBeGreaterThan(value.x + value.width);
    expect(card.x + card.width - (cat.x + cat.width)).toBeCloseTo(32, 0);
  });

  test("08-B: an invoice's billing breakdown downloads as the CSV, named after the invoice", async ({
    page,
  }) => {
    await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription/billing", { entity_id: "" });

    const invoices = body(page).getByRole("region", { name: "Invoice History" });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      invoices.getByRole("button", { name: /billing breakdown of invoice #11241234113/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("Inv-11241234113 Breakdown by Entity.csv");
    const text = await readFile(await download.path(), "utf8");
    // The BOM is what makes Excel read it as UTF-8; after it, the user's sample, line for line.
    expect(text.startsWith("\uFEFF")).toBe(true);
    expect(text.slice(1).split("\r\n").slice(0, 4)).toEqual([
      "Entity Name,Subscription,Monthly amount,Period start,Period end,Charged for the period",
      "Nexora Health Limited,Super Minty,400,26-Jul-26,25-Aug-26,400.00",
      "Aetheria Capital Limited,Payment Request,280,26-Jul-26,25-Aug-26,280.00",
      "Company E Limited,Petty Cash,280,26-Jul-26,5-Aug-26,90.32",
    ]);
  });

  test("08-W: another card becomes the one the account charges, and the chips swap", async ({
    page,
  }) => {
    const { posts } = await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription/billing", { entity_id: "" });
    const panel = body(page).getByRole("region", { name: "Payment Methods" });

    await panel.getByRole("button", { name: "Update card · Mastercard ending in 4651" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Set as default", "Edit", "Delete"]);
    await page.getByRole("menuitem", { name: "Set as default" }).click();

    await expect(panel.locator("li").first()).toContainText("Mastercard ending in 4651");
    await expect(panel.locator("li").first()).toHaveAttribute("data-chip", "default");
    expect(posts).toEqual([
      {
        path: "/accounts/default-card",
        body: { account: "acc-company-a", payment_method: "pm_master4651" },
      },
    ]);
  });

  test("08-R: the card the account charges cannot go; another one can", async ({ page }) => {
    const { posts } = await stubBilling(page, WALLET_TWO);
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
    expect(posts).toEqual([
      { path: "/remove", body: { payment_method: "pm_master4651", account: "acc-company-a" } },
    ]);
  });

  test("08-H → 08-Y: no card on the account, and the screen that adds one to it", async ({
    page,
  }) => {
    await stubBilling(page, WALLET_NONE);
    await handoff(page, creds(), "/subscription/billing", { entity_id: "" });

    await expect(body(page).getByText("No card saved")).toBeVisible();
    await body(page).getByRole("button", { name: "Add a payment method" }).click();
    await page.waitForURL(
      (u) =>
        u.pathname === "/subscription/billing/add" &&
        u.searchParams.get("account") === "acc-company-a",
    );
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

  test("08-N → 08-S: the card that just arrived, and making it the one the account charges", async ({
    page,
  }) => {
    const { posts } = await stubBilling(page, WALLET_ADDED);
    await handoff(
      page,
      creds(),
      `/subscription/billing?account=acc-company-a&added=${ADDED_CARD.id}`,
      { entity_id: "" },
    );

    const told = page.getByRole("dialog");
    await expect(told).toContainText("New Card added Successfully");
    await expect(told).toContainText("Mastercard 8842 is added successfully.");
    await expect(told).toContainText("This card is not your default payment method.");
    await told.getByRole("button", { name: "Set as default" }).click();
    await expect(told).toContainText("This card is set as the default payment method.");
    await expect(told.getByRole("button", { name: "Set as default" })).toHaveCount(0);
    expect(posts).toEqual([
      {
        path: "/accounts/default-card",
        body: { account: "acc-company-a", payment_method: ADDED_CARD.id },
      },
    ]);
    await told.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("08-C: the name and email are ours - over 255 is refused under the field, and only what changed is sent", async ({
    page,
  }) => {
    const { posts } = await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription/billing/details?account=acc-company-a", {
      entity_id: "",
    });

    await expect(body(page).getByRole("heading", { level: 1 })).toHaveText(
      "Update Billing Information",
    );
    const form = body(page).getByRole("form", { name: "Billing information" });
    const company = form.getByLabel("Billing Company");
    await expect(company).toHaveValue("Company A Limited");
    await expect(form.getByLabel("Billing email")).toHaveValue("billing@companyalimited.com");
    // The address is Stripe's own form; the stub withholds its key (as for the card forms), so
    // none is drawn - the page says so rather than showing an empty box.
    await expect(form.getByRole("status")).toHaveText(ADDRESS_UNAVAILABLE);

    // Past the column's 255: the API's words, under the field, and nothing sent.
    await company.fill("x".repeat(256));
    await form.getByRole("button", { name: "Save billing account" }).click();
    await expect(form.getByText(TOO_LONG)).toBeVisible();
    await expect(company).toHaveAttribute("aria-invalid", "true");
    expect(posts).toEqual([]);

    await company.fill("Company A Holdings Limited");
    await form.getByRole("button", { name: "Save billing account" }).click();
    await page.waitForURL(
      (u) =>
        u.pathname === "/subscription/billing" && u.searchParams.get("account") === "acc-company-a",
    );
    await expect(body(page).getByRole("region", { name: "Next billing" })).toContainText(
      "Company A Holdings Limited",
    );
    expect(posts).toEqual([
      {
        path: "/accounts/update",
        body: { account: "acc-company-a", billing_company: "Company A Holdings Limited" },
      },
    ]);
  });

  test("New billing account turns the picker into onboarding's form, in place", async ({
    page,
  }) => {
    const { posts } = await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription", { entity_id: "" });

    const account = body(page).getByRole("region", { name: "Billing account" });
    await account.getByText("Next Billing Date").click();
    const list = page.getByRole("dialog", { name: "Billing Accounts" });
    await expect(list.getByRole("radio")).toHaveCount(3);
    // Onboarding's 01-L is 481 wide.
    expect((await list.boundingBox())?.width).toBeCloseTo(481, 0);

    await list.getByRole("button", { name: "New billing account" }).click();
    // The same sheet, now 01-D: 880 wide, Stripe's note under its title, Minty with a card.
    const form = page.getByRole("dialog", { name: "New billing account" });
    await expect(form).toContainText("never stored by Minty");
    expect((await form.boundingBox())?.width).toBeCloseTo(880, 0);
    await expect(form.locator('img[src*="billing-cat-card"]')).toBeVisible();
    // The stub withholds Stripe's key: the refusal, and Try again, in place.
    await expect(form.getByRole("alert")).toContainText("couldn't open the card form");
    await expect(form.getByRole("button", { name: "Try again" })).toBeVisible();

    // Cancel is 01-D's arrow back to the list; the X closes the sheet.
    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(list.getByRole("radio")).toHaveCount(3);
    await list.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe("/subscription");
    expect(posts).toEqual([]); // opening the form writes nothing
  });

  test("below 900px the form takes 01-L's width and Minty steps aside; the move opens it too", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await stubBilling(page, WALLET_TWO);
    await handoff(page, creds(), "/subscription", { entity_id: "" });

    const account = body(page).getByRole("region", { name: "Billing account" });
    await account.getByRole("button", { name: /Change billing account/ }).click();
    const step1 = page.getByRole("dialog", { name: "Change billing account" });
    await step1.getByText("Nexora Health Limited").click();
    await step1.getByRole("button", { name: "Next" }).click();
    const step2 = page.getByRole("dialog", { name: "Move Nexora Health Limited to" });
    await step2.getByRole("button", { name: "New billing account" }).click();

    const form = page.getByRole("dialog", { name: "New billing account" });
    await expect(form).toContainText("never stored by Minty");
    expect((await form.boundingBox())?.width).toBeLessThanOrEqual(481);
    await expect(form.locator('img[src*="billing-cat-card"]')).toBeHidden();
    // Cancel goes back to where the form was opened from.
    await form.getByRole("button", { name: "Cancel" }).click();
    await expect(step2.getByRole("radio", { name: /Vine Consulting Limited/ })).toBeVisible();
  });
});
