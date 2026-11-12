// General's chart of accounts and contacts (`/entity/<shortid>/<name>/settings/general`, owner
// 2026-11-12; their own tab first, merged into General the same day) over a STUBBED accounts-api: on a phone, add an account (the next free code filled in), rename a
// contact, delete one after its confirm - each the API's at once - and Minty's own rows locked.
// Nothing wider than the screen at 360 / 768 / 1440, with a dialog open too.

import { expect, test, type Page, type Route } from "@playwright/test";

import {
  ACCOUNTS_API_URL,
  SUBSCRIPTION_API_URL,
  credentials,
  handoff,
  requireApp,
} from "../../../e2e/helpers";

const ID = "360812e1-9f94-46a3-aa31-347e21afde8e";
const NAME = "Olive & Vine";
const PAGE = "/entity/360812e1/olive-and-vine/settings/general";
/** General's own read (the company's details), answered so the page draws. */
const DETAILS = {
  company: {
    id: "360812e1-9f94-46a3-aa31-347e21afde8e",
    name: "Olive & Vine",
    country_code: "HK",
    currency_id: "c-hkd",
  },
  modules: ["PETTY_CASH", "PAYMENT_REQUEST"],
  countries: [{ code: "HK", name: "Hong Kong" }],
  currencies: [{ id: "c-hkd", name: "Hong Kong Dollar" }],
  xero: {
    status: "not_connected",
    connected: false,
    needs_reconnect: false,
    organisation: null,
    last_connected_at: null,
  },
  can_edit: true,
  can_rename: true,
  notices: [],
};
const STUB_CREDS = {
  secret: "stub-api-never-sees-this",
  userId: "u-e2e",
  entityId: ID,
  entityName: NAME,
};
const creds = () => ({ ...(credentials() ?? STUB_CREDS), entityId: ID, entityName: NAME });
const ALL = { add: true, edit: true, delete: true };

type Sent = { method: string; path: string; body: unknown };

function account(id: string, code: string, name: string, over = {}) {
  return {
    id,
    code,
    name,
    type: "expense",
    type_label: "Expense",
    description: "",
    own: true,
    source: "user",
    in_xero: false,
    used: false,
    ...over,
  };
}

async function arrive(page: Page): Promise<Sent[]> {
  const sent: Sent[] = [];
  const state = {
    accounts: [
      account("a-rent", "469", "Rent"),
      account("a-wages", "477", "Wages", { source: "template" }),
    ],
    contacts: [
      {
        id: "c-kee",
        name: "Kee Wah",
        own: true,
        source: "user",
        in_xero: false,
        xero_id: null,
        used: false,
      },
      {
        id: "c-walk",
        name: "Walk-in Customer",
        own: true,
        source: "template",
        in_xero: false,
        xero_id: null,
        used: false,
      },
    ],
  };
  await page.route(`${ACCOUNTS_API_URL}/api/me/company/**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
    const url = new URL(req.url());
    expect(url.searchParams.get("entity")).toBe(ID);
    const path = url.pathname.replace("/api/me/company", "");
    const body = req.postData() ? JSON.parse(req.postData() as string) : null;
    if (req.method() === "GET" && path === "/integration") return route.fulfill({ json: DETAILS });
    if (req.method() === "GET" && path === "/accounts")
      return route.fulfill({
        json: {
          accounts: state.accounts,
          types: [
            { value: "bank", label: "Bank" },
            { value: "expense", label: "Expense" },
          ],
          next_codes: { bank: "090", expense: "478" },
          minty_accounts: [
            {
              id: "t-parking",
              code: "472",
              name: "Parking",
              type: "expense",
              type_label: "Expense",
              description: "",
            },
          ],
          xero_live: false,
          permissions: ALL,
        },
      });
    if (req.method() === "GET" && path === "/contacts")
      return route.fulfill({
        json: { contacts: state.contacts, xero_live: false, permissions: ALL },
      });
    sent.push({ method: req.method(), path, body });
    if (req.method() === "POST" && path === "/accounts") {
      state.accounts = [...state.accounts, account("a-new", body.code, body.name)];
      return route.fulfill({ status: 201, json: { account: {}, message: `${body.name} added.` } });
    }
    if (req.method() === "PATCH" && path === "/contacts/c-kee") {
      state.contacts = state.contacts.map((c) =>
        c.id === "c-kee" ? { ...c, name: body.name } : c,
      );
      return route.fulfill({ json: { contact: {}, message: `${body.name} saved.` } });
    }
    if (req.method() === "DELETE" && path === "/contacts/c-kee") {
      state.contacts = state.contacts.filter((c) => c.id !== "c-kee");
      return route.fulfill({ json: { archived: false, message: "Kee Wah Bakery deleted." } });
    }
    return route.fulfill({ status: 404, json: { error: "not_found" } });
  });
  await page.route(`${ACCOUNTS_API_URL}/api/me/profile**`, (route) =>
    route.fulfill({
      json: {
        user: {
          id: "u1",
          first_name: "Ada",
          last_name: "Admin",
          name: "Ada Admin",
          initials: "AA",
          email: "ada@test.com",
        },
        entity: null,
      },
    }),
  );
  await page.route(`${SUBSCRIPTION_API_URL}/api/me/subscriptions**`, (route) =>
    route.fulfill({ status: 404, json: { error: "not_found" } }),
  );
  await handoff(page, creds(), PAGE);
  await expect(page.getByRole("region", { name: "Chart of accounts" })).toBeVisible();
  return sent;
}

const toast = (page: Page, text: string) =>
  page.locator("[data-toast-type]").filter({ hasText: text });
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe("accounts and contacts", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("on a phone: add an account, rename then delete a contact; Minty's copies marked", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const sent = await arrive(page);
    const chart = page.getByRole("region", { name: "Chart of accounts" });
    await expect(chart.getByRole("button", { name: "Edit 477 - Wages" })).toBeVisible();
    await expect(chart.getByText("Comes with Minty")).toBeVisible();

    await chart.getByRole("button", { name: /Add an account/ }).click();
    const form = page.getByRole("group", { name: "Add an account" });
    // Minty's accounts in the dropdown, the note on top; a typed name not there is a new one
    const picker = form.getByRole("combobox", { name: /Account/ });
    await picker.click();
    await expect(form.getByText("Type an account name to add a new account")).toBeVisible();
    await expect(form.getByRole("option", { name: /Parking/ })).toBeVisible();
    await picker.fill("Fuel");
    await form.getByRole("option", { name: "+ Add 'Fuel' as a new account" }).click();
    await expect(form.getByLabel(/^Name/)).toHaveValue("Fuel");
    await form.getByLabel(/Type/).selectOption("expense");
    await expect(form.getByLabel(/Code/)).toHaveValue("478");
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await form.getByRole("button", { name: "Add" }).click();
    await expect(toast(page, "Fuel added.")).toBeVisible();
    await expect(chart.getByText("478 - Fuel")).toBeVisible();

    const people = page.getByRole("region", { name: "Contacts" });
    await people.getByRole("button", { name: "Edit Kee Wah" }).click();
    const rename = page.getByRole("group", { name: "Rename Kee Wah" });
    await rename.getByLabel(/Name/).fill("Kee Wah Bakery");
    await rename.getByLabel(/Name/).press("Enter");
    await expect(toast(page, "Kee Wah Bakery saved.")).toBeVisible();

    await people.getByRole("button", { name: "Delete Kee Wah Bakery" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete Kee Wah Bakery?" });
    await expect(confirm).toContainText("This can't be undone.");
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(toast(page, "Kee Wah Bakery deleted.")).toBeVisible();
    await expect(people.getByText("Kee Wah Bakery")).toHaveCount(0);

    expect(sent).toEqual([
      {
        method: "POST",
        path: "/accounts",
        body: { code: "478", name: "Fuel", type: "expense", description: "" },
      },
      { method: "PATCH", path: "/contacts/c-kee", body: { name: "Kee Wah Bakery" } },
      { method: "DELETE", path: "/contacts/c-kee", body: null },
    ]);
  });
});

for (const width of [360, 768, 1440]) {
  test(`accounts and contacts: nothing is wider than the screen at ${width}px`, async ({
    page,
  }) => {
    await requireApp();
    await page.setViewportSize({ width, height: 900 });
    await arrive(page);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: /Add a contact/ }).click();
    await expect(page.getByRole("group", { name: "Add a contact" })).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
}
