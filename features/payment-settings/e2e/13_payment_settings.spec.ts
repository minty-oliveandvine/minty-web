// Payment Settings in the hub (`/entity/<shortid>/<name>/settings/payment`, moved in from
// minty-payment-request-web, owner 2026-11-10) over a STUBBED minty-payment-request-api: the
// account-code picker, the Xero-less card on a phone, Save's two gates and a refusal in the
// server's words, and "Leave without saving?" on the ways out a real browser alone can test - the
// tab row, the header's Back and the browser's own Back (the history sentinel). Ported from that
// app's e2e/06_settings.spec.ts and e2e/07_settings_leave.spec.ts; the pills, the sidebar drawer
// and Logout cases stayed behind (the hub's tab row replaces the pills; the drawer's guard is
// @minty/shared's, tested there). Nothing wider than the screen at 360 / 768 / 1440.

import { expect, test, type Dialog, type Page, type Route } from "@playwright/test";

import {
  ACCOUNTS_API_URL,
  SUBSCRIPTION_API_URL,
  credentials,
  handoff,
  requireApp,
} from "../../../e2e/helpers";

const PAYMENT_REQUEST_API_URL = process.env.E2E_PAYMENT_REQUEST_API_URL || "http://localhost:8020";

const ID = "360812e1-9f94-46a3-aa31-347e21afde8e";
const NAME = "Olive & Vine";
const BASE = "/entity/360812e1/olive-and-vine/settings";
const PAGE = `${BASE}/payment`;
const STUB_CREDS = {
  secret: "stub-api-never-sees-this",
  userId: "u-e2e",
  entityId: ID,
  entityName: NAME,
};
const creds = () => ({ ...(credentials() ?? STUB_CREDS), entityId: ID, entityName: NAME });
const isPage = (u: URL) => u.pathname === PAGE;

/** Two ticked, one not - the same three codes the unit tests use. */
const ACCOUNTS = [
  { code: "200", name: "Sales", active: true },
  { code: "429", name: "General Expenses", active: true },
  { code: "310", name: "Cost of Goods Sold", active: false },
];

const tick = (page: Page, code: string) => {
  const a = ACCOUNTS.find((x) => x.code === code)!;
  return page.getByRole("checkbox", {
    name: `Include ${a.code} - ${a.name} in payment account dropdown`,
  });
};
const leaveDialog = (page: Page) => page.getByRole("dialog", { name: "Leave without saving?" });
const saveButton = (page: Page) => page.getByRole("button", { name: "Save Changes" });
const tabs = (page: Page) => page.getByRole("navigation", { name: "Settings sections" });
const backLink = (page: Page) => page.locator("[data-back-link]").first();
/** The history entry the tab is on (Chrome's Navigation API): shows the sentinel come and go. */
const historyIndex = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { navigation: { currentEntry: { index: number } } }).navigation
        .currentEntry.index,
  );

function cors(route: Route): Record<string, string> {
  const headers = route.request().headers();
  return {
    "access-control-allow-origin": headers["origin"] ?? "*",
    "access-control-allow-headers":
      headers["access-control-request-headers"] ?? "authorization, content-type, x-entity-id",
    "access-control-allow-methods": "GET, PUT, POST, OPTIONS",
  };
}

type Run = {
  prompts: string[];
  /** Whether the codes were read at all. */
  codesRead: boolean;
  /** What a PUT answers; each one sent is recorded in `puts`. */
  put: { status: number; detail?: string };
  puts: { id: string; is_active: boolean }[];
  /** Every call's X-Entity-Id. */
  entityHeaders: string[];
};

async function stub(page: Page, { connected = true } = {}): Promise<Run> {
  const run: Run = {
    prompts: [],
    codesRead: false,
    put: { status: 200 },
    puts: [],
    entityHeaders: [],
  };
  page.on("dialog", (d: Dialog) => {
    run.prompts.push(d.type());
    void d.dismiss();
  });
  await page.route(`${PAYMENT_REQUEST_API_URL}/api/v1/auth/xero-status`, (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: cors(route) });
    run.entityHeaders.push(route.request().headers()["x-entity-id"] ?? "");
    return route.fulfill({
      status: 200,
      headers: cors(route),
      contentType: "application/json",
      body: JSON.stringify({ connected, minty_only: false }),
    });
  });
  await page.route(`${PAYMENT_REQUEST_API_URL}/api/v1/entity-bill-accounts/**`, (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors(route) });
    run.entityHeaders.push(req.headers()["x-entity-id"] ?? "");
    if (req.method() === "PUT") {
      const id = new URL(req.url()).pathname.split("/").pop() ?? "";
      const { is_active } = req.postDataJSON() as { is_active: boolean };
      run.puts.push({ id, is_active });
      const body =
        run.put.status === 200
          ? {
              id,
              entity_id: ID,
              account_code: id.replace("e2e-", ""),
              account_name: "",
              account_type: "EXPENSE",
              is_default: false,
              is_active,
              sort_order: 0,
            }
          : { detail: run.put.detail };
      return route.fulfill({
        status: run.put.status,
        headers: cors(route),
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    }
    run.codesRead = true;
    return route.fulfill({
      status: 200,
      headers: cors(route),
      contentType: "application/json",
      body: JSON.stringify(
        ACCOUNTS.map((a, i) => ({
          id: `e2e-${a.code}`,
          entity_id: ID,
          account_code: a.code,
          account_name: a.name,
          account_type: "EXPENSE",
          is_default: false,
          is_active: a.active,
          sort_order: i,
        })),
      ),
    });
  });
  // the header's initials and the menu's subscriptions: decoration, answered so nothing moves
  await page.route(`${ACCOUNTS_API_URL}/api/me/profile**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "u1",
          first_name: "Ada",
          last_name: "Admin",
          name: "Ada Admin",
          initials: "AA",
          email: "ada@test.com",
        },
        entity: null,
      }),
    }),
  );
  await page.route(`${SUBSCRIPTION_API_URL}/api/me/subscriptions**`, (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not_found" }),
    }),
  );
  // the other tabs' pages read the accounts API: a stub page is enough to see the move
  await page.route(`${ACCOUNTS_API_URL}/api/me/company/**`, (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not_found" }),
    }),
  );
  return run;
}

async function arrive(page: Page, options: { connected?: boolean } = {}): Promise<Run> {
  const run = await stub(page, options);
  await handoff(page, creds(), PAGE);
  await expect(page.getByRole("heading", { name: "Payment Account Code" })).toBeVisible();
  if (options.connected !== false) {
    await expect(tick(page, "200")).toBeChecked();
    await expect(tick(page, "310")).not.toBeChecked();
  }
  return run;
}

/** Arrive with another page of this app behind the tab, so Back has somewhere to go. */
async function arriveFromAnotherPage(page: Page): Promise<Run> {
  const run = await arrive(page);
  await page.goto("/terms");
  await page.goto(PAGE);
  await expect(tick(page, "200")).toBeChecked();
  return run;
}

test.describe("payment settings", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("the tab offers the account-code picker, naming the company on every call", async ({
    page,
  }) => {
    const run = await arrive(page);
    await expect(page).toHaveTitle(`Payment Settings - ${NAME}`);
    await expect(tabs(page).getByText("Payment Settings")).toHaveAttribute("aria-current", "page");
    await expect(saveButton(page)).toBeVisible();
    await expect(page.getByRole("list", { name: "Account codes" })).toContainText(
      "429 - General Expenses",
    );
    expect(run.entityHeaders.length).toBeGreaterThan(0);
    expect(new Set(run.entityHeaders)).toEqual(new Set([ID]));
  });

  test("without Xero the card only says how to connect it (phone)", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const run = await arrive(page, { connected: false });

    const notice = page.getByRole("status").filter({ hasText: "Xero isn't connected." });
    await expect(notice).toBeVisible();
    await expect(notice.getByRole("link", { name: "Integration" })).toHaveAttribute(
      "href",
      `${BASE}/integration`,
    );
    await expect(page.getByRole("searchbox", { name: /search account code/i })).toHaveCount(0);
    await expect(saveButton(page)).toHaveCount(0);
    expect(run.codesRead).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
  });

  test("nothing changed: Save is off, a tick turns it on, putting it back turns it off", async ({
    page,
  }) => {
    const run = await arrive(page);
    await expect(saveButton(page)).toBeDisabled();
    await tick(page, "310").check();
    await expect(saveButton(page)).toBeEnabled();
    await tick(page, "310").uncheck();
    await expect(saveButton(page)).toBeDisabled();
    expect(run.puts).toEqual([]);
  });

  test("nothing ticked: Save is off and says why beside it", async ({ page }) => {
    const run = await arrive(page);
    const hint = page.getByText("Pick at least one account code.");
    await expect(hint).toHaveCount(0);
    await tick(page, "200").uncheck();
    await expect(saveButton(page)).toBeEnabled();
    await tick(page, "429").uncheck();

    await expect(saveButton(page)).toBeDisabled();
    await expect(hint).toBeVisible();
    await expect(saveButton(page)).not.toHaveAttribute("title", /.+/);
    await tick(page, "310").check();
    await expect(saveButton(page)).toBeEnabled();
    await expect(hint).toHaveCount(0);
    expect(run.puts).toEqual([]);
  });

  test("a refused untick shows the server's reason, ON sent before OFF, and the page still asks", async ({
    page,
  }) => {
    const run = await arrive(page);
    run.put = { status: 409, detail: "Keep at least one account code ticked." };
    await tick(page, "310").check();
    await tick(page, "200").uncheck();

    await saveButton(page).click();
    await expect(page.getByText("Keep at least one account code ticked.")).toBeVisible();
    expect(run.puts).toEqual([
      { id: "e2e-310", is_active: true },
      { id: "e2e-200", is_active: false },
    ]);
    await expect(tick(page, "200")).not.toBeChecked();
    await tabs(page).getByRole("link", { name: "Users" }).click();
    await expect(leaveDialog(page)).toBeVisible();
  });
});

test.describe("payment settings: leave without saving", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("nothing changed: a tab leaves at once", async ({ page }) => {
    const run = await arrive(page);
    await tabs(page).getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/users$`));
    await expect(leaveDialog(page)).toHaveCount(0);
    expect(run.prompts).toEqual([]);
  });

  test("a tick held by a tab: Go Back and Escape both stay, the tick kept; Discard goes", async ({
    page,
  }) => {
    const run = await arrive(page);
    await tick(page, "310").check();

    await tabs(page).getByRole("link", { name: "Users" }).click();
    const dialog = leaveDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("You have unsaved changes.");
    await dialog.getByRole("button", { name: "Go Back", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(isPage);
    await expect(tick(page, "310")).toBeChecked();

    await tabs(page).getByRole("link", { name: "Users" }).click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(isPage);
    await expect(tick(page, "310")).toBeChecked();

    await tabs(page).getByRole("link", { name: "Users" }).click();
    await dialog.getByRole("button", { name: "Discard changes" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/users$`));
    expect(run.puts).toEqual([]);
    expect(run.prompts).toEqual([]);
  });

  test("the header's Back link asks too", async ({ page }) => {
    const run = await arriveFromAnotherPage(page);
    await tick(page, "310").check();

    await backLink(page).click();
    const dialog = leaveDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Go Back", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(isPage);
    await expect(tick(page, "310")).toBeChecked();
    expect(run.prompts).toEqual([]);
  });

  test("the browser's Back asks: Go Back stays on the page, the tick and the sentinel kept", async ({
    page,
  }) => {
    const run = await arrive(page);
    const before = await historyIndex(page);
    await tick(page, "310").check();
    await expect.poll(() => historyIndex(page)).toBe(before + 1); // the sentinel

    await page.goBack();
    const dialog = leaveDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Go Back", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(isPage);
    await expect(tick(page, "310")).toBeChecked();
    expect(await historyIndex(page)).toBe(before + 1); // pushed again: Back asks again

    await page.goBack();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(tick(page, "310")).toBeChecked();
    expect(run.prompts).toEqual([]);
  });

  test("the browser's Back, then Discard changes, goes back to the page before", async ({
    page,
  }) => {
    const run = await arriveFromAnotherPage(page);
    await tick(page, "310").check();

    await page.goBack();
    const dialog = leaveDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Discard changes" }).click();

    await expect(page).toHaveURL(/\/terms$/);
    await expect(leaveDialog(page)).toHaveCount(0);
    expect(run.prompts).toEqual([]);
  });

  test("once saved, the browser's Back leaves without asking", async ({ page }) => {
    const run = await arriveFromAnotherPage(page);
    const before = await historyIndex(page);
    await tick(page, "310").check();
    await expect.poll(() => historyIndex(page)).toBe(before + 1);

    await saveButton(page).click();
    await expect(page.getByText("Payment settings updated successfully")).toBeVisible();
    expect(run.puts).toEqual([{ id: "e2e-310", is_active: true }]);
    await expect.poll(() => historyIndex(page)).toBe(before); // the sentinel taken off

    await page.goBack();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(leaveDialog(page)).toHaveCount(0);
    expect(run.prompts).toEqual([]);
  });
});

for (const width of [360, 768, 1440]) {
  test(`payment settings: nothing is wider than the screen at ${width}px`, async ({ page }) => {
    await requireApp();
    await page.setViewportSize({ width, height: 900 });
    await arrive(page);
    const overflow = () =>
      page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow()).toBeLessThanOrEqual(0);

    // the leave dialog at this width too
    await tick(page, "310").check();
    await tabs(page).getByRole("link", { name: "Users" }).click();
    await expect(leaveDialog(page)).toBeVisible();
    expect(await overflow()).toBeLessThanOrEqual(0);
  });
}
