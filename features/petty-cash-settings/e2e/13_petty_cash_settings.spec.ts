// Petty Cash Settings in the hub (features/petty-cash-settings), against a STUBBED
// minty-petty-cash-api - ported from minty-petty-cash-web's e2e/11_settings.spec.ts when the tab
// moved here (owner, 2026-11-10). Needs only this app's dev server: every call the page makes is
// answered here, and the one way out of the app (the first mapping save, to the Petty Cash
// dashboard through accounts-api's /enter) is caught. Nothing wider than the screen at 360 / 768
// / 1440.

import { expect, test, type Page, type Route } from "@playwright/test";

import { ACCOUNTS_API_URL, SUBSCRIPTION_API_URL, handoff, requireApp } from "../../../e2e/helpers";

const ENTITY = "3d65f186-5ba1-4bf7-a1b0-cc64a113eb5c";
const NAME = "E2E Petty Cash Shop";
const HUB_SETTINGS = "/entity/3d65f186/e2e-petty-cash-shop/settings";
const SETTINGS = `${HUB_SETTINGS}/petty-cash`;
const PETTY_CASH_API_URL = process.env.E2E_PETTY_CASH_API_URL || "http://localhost:8010";
const API =
  /\/api\/petty-cash\/v1\/companies\/[^/]+\/(settings(?:\/xero(?:\/mapping|\/account-codes)?)?|sales-methods(?:\/[^/?]+)?)$/;
const CREDS = { secret: "stub-never-verified", userId: "u", entityId: ENTITY, entityName: NAME };

const VISA = "0a000000-0000-4000-8000-000000000001";
const ALIPAY = "0a000000-0000-4000-8000-000000000002";
const FOODPANDA = "0a000000-0000-4000-8000-000000000003";
const OCTOPUS = "0b000000-0000-4000-8000-000000000001";
const KEETA = "0b000000-0000-4000-8000-000000000002";

type Json = Record<string, unknown>;
type Method = { id: string; name: string; value_name: string; own: boolean };
type Perms = Record<string, boolean>;

const ALL: Perms = {
  edit_xero: true,
  view_sales_methods: true,
  add_sales_method: true,
  rename_sales_method: true,
  remove_sales_method: true,
  reorder_sales_methods: true,
};
const CASHIER: Perms = {
  ...ALL,
  edit_xero: false,
  add_sales_method: false,
  rename_sales_method: false,
  remove_sales_method: false,
  reorder_sales_methods: false,
};

// `own`: typed by the company (pencil and Delete); Minty's only come off its list (owner, 2026-11-12)
const m = (id: string, name: string, own = false): Method => ({
  id,
  name,
  value_name: `${name.toLowerCase()}_sales`,
  own,
});

// the Xero cards (GET /settings/xero and its two PUTs)
const BANK_PC = "b0000000-0000-4000-8000-000000000001";
const BANK_HSBC = "b0000000-0000-4000-8000-000000000002";
const SALES = "a0000000-0000-4000-8000-000000000200";
const DRAWINGS = "a0000000-0000-4000-8000-000000000880";
const SUSPENSE = "a0000000-0000-4000-8000-000000000990";
const WALKIN = "c0000000-0000-4000-8000-000000000001";
const TESS = "c0000000-0000-4000-8000-000000000002";
const NEW_CONTACT = "c0000000-0000-4000-8000-000000000099";
const MAPPING_KEYS = [
  "main_bank",
  "deposit_bank",
  "cashsale_account",
  "cashsale_contact",
  "owners_account",
  "owners_contact",
  "discrepancy_account",
  "discrepancy_contact",
] as const;
type MappingKey = (typeof MAPPING_KEYS)[number];
const LABELS: Record<MappingKey, string> = {
  main_bank: "Petty Cash Account",
  deposit_bank: "Deposit Bank Account",
  cashsale_account: "Cash Sales account code",
  cashsale_contact: "Cash Sales contact",
  owners_account: "Director Personal Account code",
  owners_contact: "Director / Responsible person",
  discrepancy_account: "Discrepancy account code",
  discrepancy_contact: "Discrepancy contact",
};
const BANKS = [
  { id: BANK_PC, name: "Petty Cash", code: "090" },
  { id: BANK_HSBC, name: "HSBC Current", code: "091" },
];
const ACCOUNTS = [
  { id: SALES, name: "Sales", code: "200" },
  { id: DRAWINGS, name: "Owner Drawings", code: "880" },
  { id: SUSPENSE, name: "Suspense", code: "990" },
];
const SAVED_MAPPING: Record<MappingKey, string | null> = {
  main_bank: BANK_PC,
  deposit_bank: BANK_HSBC,
  cashsale_account: SALES,
  cashsale_contact: WALKIN,
  owners_account: DRAWINGS,
  owners_contact: TESS,
  discrepancy_account: SUSPENSE,
  discrepancy_contact: TESS,
};
const EMPTY_MAPPING = Object.fromEntries(MAPPING_KEYS.map((k) => [k, null])) as Record<
  MappingKey,
  string | null
>;

function xeroState(
  over: { live?: boolean; edit?: boolean; mapping?: Record<MappingKey, string | null> } = {},
) {
  const mapping = over.mapping ?? SAVED_MAPPING;
  return {
    live: over.live ?? true,
    edit: over.edit ?? true,
    mapping: { ...mapping },
    saved: mapping.main_bank !== null,
    contacts: [
      { id: WALKIN, name: "Walk-in Customer" },
      { id: TESS, name: "Tess Tester" },
    ],
    codes: [
      { code: "400", name: "Advertising", selected: true },
      { code: "404", name: "Bank Fees", selected: false },
      { code: "429", name: "General Expenses", selected: true },
    ],
  };
}

/** What the stubbed API holds; each write changes it and answers the read again. */
function initialState(over: { perms?: Perms; xero?: ReturnType<typeof xeroState> } = {}) {
  return {
    electronic: [m(VISA, "Visa", true), m(ALIPAY, "AlipayHK", true)],
    delivery: [m(FOODPANDA, "Foodpanda")],
    available: {
      electronic: [{ id: OCTOPUS, name: "Octopus" }],
      delivery: [{ id: KEETA, name: "Keeta" }],
    },
    perms: over.perms ?? ALL,
    xero: over.xero ?? xeroState({ live: false }),
  };
}
type State = ReturnType<typeof initialState>;

function read(s: State): Json {
  return {
    sales_methods: { electronic: s.electronic, delivery: s.delivery },
    available: s.available,
    xero_connected: s.xero.live,
    permissions: s.perms,
  };
}

function xeroRead(s: State): Json {
  const x = s.xero;
  return {
    live: x.live,
    organisation: x.live ? "E2E Xero Org" : null,
    mapping: x.live
      ? MAPPING_KEYS.map((key) => ({
          key,
          label: LABELS[key],
          kind: key.endsWith("contact") ? "contact" : "account",
          options: key.endsWith("bank") ? BANKS : key.endsWith("contact") ? x.contacts : ACCOUNTS,
          selected: x.mapping[key],
        }))
      : null,
    mapping_saved: x.saved,
    account_codes: x.live ? x.codes : null,
    permissions: { edit_mapping: x.edit, edit_account_codes: x.edit },
  };
}

type Sent = { method: string; path: string; body: Json | null };
type Refuse = (sent: Sent) => { status: number; error: string } | null;

/** The hub's own reads around the page: the person (the header) and their subscriptions (the menu). */
async function stubHub(page: Page) {
  await page.route(`${ACCOUNTS_API_URL}/api/me/profile**`, (route) =>
    route.fulfill({
      json: {
        user: {
          id: "u",
          first_name: "Tess",
          last_name: "Tester",
          name: "Tess Tester",
          initials: "TT",
          email: "tess@test.com",
        },
        entity: null,
      },
    }),
  );
  await page.route(`${SUBSCRIPTION_API_URL}/api/me/subscriptions**`, (route) =>
    route.fulfill({ status: 404, json: { error: "not_found" } }),
  );
}

/** Every call the page makes, stubbed; returns what was sent. `refuse` answers a write with a refusal. */
async function stub(page: Page, state: State, refuse: Refuse = () => null) {
  const sent: Sent[] = [];
  // a new contact is accounts-api's (owner, 2026-11-12: Settings' contacts, accountant and up),
  // the company as ?entity=
  await page.route(`${ACCOUNTS_API_URL}/api/me/company/contacts**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
    const url = new URL(req.url());
    expect(url.searchParams.get("entity")).toBe(ENTITY);
    const body = JSON.parse(req.postData() ?? "null") as Json | null;
    const call = { method: req.method(), path: url.pathname, body };
    sent.push(call);
    const no = refuse(call);
    if (no) return route.fulfill({ status: no.status, json: { error: no.error } });
    const made = { id: NEW_CONTACT, name: String(body?.name) };
    state.xero.contacts = [...state.xero.contacts, made];
    return route.fulfill({
      status: 201,
      json: { contact: { id: "row-new", name: made.name, xero_id: NEW_CONTACT }, message: "added" },
    });
  });
  await page.route(API, async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
    expect(req.url().startsWith(PETTY_CASH_API_URL)).toBe(true);
    // the company is in the path and nowhere else (the API's door never reads it)
    expect(req.headers()["x-entity-id"]).toBeUndefined();
    const path = new URL(req.url()).pathname.replace(/^.*\/companies\/[^/]+/, "");
    const body = req.postData() ? (JSON.parse(req.postData() as string) as Json) : null;
    const call = { method: req.method(), path, body };
    if (call.method === "GET" && path === "/settings") return route.fulfill({ json: read(state) });
    if (call.method === "GET" && path === "/settings/xero")
      return route.fulfill({ json: xeroRead(state) });
    sent.push(call);
    const no = refuse(call);
    if (no) return route.fulfill({ status: no.status, json: { error: no.error } });
    if (path === "/settings/xero/mapping") {
      const first = !state.xero.saved;
      for (const key of MAPPING_KEYS) state.xero.mapping[key] = String(body?.[key]);
      state.xero.saved = true;
      return route.fulfill({
        json: { ...xeroRead(state), message: "Account mapping saved.", first_save: first },
      });
    }
    if (path === "/settings/xero/account-codes") {
      const codes = body?.codes as string[];
      state.xero.codes = state.xero.codes.map((c) => ({ ...c, selected: codes.includes(c.code) }));
      return route.fulfill({ json: { ...xeroRead(state), message: "Account codes saved." } });
    }
    let message = "";
    let status = 200;
    if (path === "/sales-methods" && call.method === "POST") {
      const type = body?.type as "electronic" | "delivery";
      const fromCatalogue = state.available[type].find((a) => a.id === body?.sale_info_id);
      const added = fromCatalogue
        ? m(fromCatalogue.id, fromCatalogue.name)
        : m("0c000000-0000-4000-8000-000000000001", String(body?.name), true);
      state[type] = [...state[type], added];
      state.available[type] = state.available[type].filter((a) => a.id !== added.id);
      message = `${added.name} added.`;
      status = 201;
    } else if (path === "/sales-methods/order") {
      const type = body?.type as "electronic" | "delivery";
      const ids = body?.method_ids as string[];
      state[type] = ids.map((id) => state[type].find((x) => x.id === id) as Method);
      message = "Order saved.";
    } else {
      const id = path.split("/").pop();
      const was = [...state.electronic, ...state.delivery].find((x) => x.id === id);
      for (const type of ["electronic", "delivery"] as const) {
        if (call.method === "PUT")
          state[type] = state[type].map((x) =>
            x.id === id ? { ...x, name: String(body?.name) } : x,
          );
        if (call.method === "DELETE") state[type] = state[type].filter((x) => x.id !== id);
      }
      message =
        call.method === "PUT"
          ? "Name saved."
          : was?.own
            ? `${was.name} deleted.`
            : `${was?.name} is off your list. Add it back any time from Add New Method.`;
    }
    return route.fulfill({ status, json: { ...read(state), message } });
  });
  await stubHub(page);
  // the one way out: accounts-api's /enter, on to the Petty Cash app - caught, so nothing leaves
  await page.route(`${ACCOUNTS_API_URL}/entity/*/enter**`, (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Hand-off</title><p>Hand-off</p>" }),
  );
  return sent;
}

async function open(page: Page, state = initialState(), refuse?: Refuse) {
  const sent = await stub(page, state, refuse);
  await handoff(page, CREDS, SETTINGS);
  await expect(card(page, "Electronic").getByRole("listitem").first()).toBeVisible();
  return sent;
}

async function expectNoHorizontalScroll(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
}

const card = (page: Page, title: string) => page.getByRole("region", { name: title, exact: true });
const rows = (page: Page, title: string) =>
  card(page, title).getByRole("list").getByRole("listitem");
const toast = (page: Page, text: string | RegExp) =>
  page.locator("[data-toast-type]").filter({ hasText: text });
// each row's bin and drag handle (owner, 2026-11-12: they replace the ⋮ menu)
const bin = (page: Page, title: string, name: string) =>
  card(page, title).getByRole("button", { name: `Delete ${name}` });
const off = (page: Page, title: string, name: string) =>
  card(page, title).getByRole("button", { name: `Remove ${name} from my list` });
const handle = (page: Page, title: string, name: string) =>
  card(page, title).getByRole("button", { name: `Move ${name}` });

test.describe("petty cash settings", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("the read: the hub's settings tabs, no country or currency, both lists in order", async ({
    page,
  }) => {
    await open(page);
    await expect(page).toHaveTitle(`Petty Cash Settings - ${NAME}`);
    const tabs = page.getByRole("navigation", { name: "Settings sections" });
    await expect(tabs.getByText("Petty Cash Settings")).toHaveAttribute("aria-current", "page");
    // every other tab is this app's own page
    for (const [label, tab] of [
      ["Users", "users"],
      ["General", "general"],
      ["Integration", "integration"],
      ["Payment Settings", "payment"],
    ])
      await expect(tabs.getByRole("link", { name: label, exact: true })).toHaveAttribute(
        "href",
        `${HUB_SETTINGS}/${tab}`,
      );

    // the country and currency are set on the General tab only
    await expect(page.getByRole("combobox", { name: /Country/ })).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: /Currency/ })).toHaveCount(0);

    await expect(rows(page, "Electronic")).toHaveText(
      ["Visa", "AlipayHK"].map((n) => new RegExp(n)),
    );
    await expect(rows(page, "Delivery")).toHaveText([/Foodpanda/]);
    await expect(
      card(page, "Electronic").getByRole("button", { name: "Add New Method" }),
    ).toBeEnabled();
    // not connected to Xero: the two Xero cards say so (their own test is below)
    await expect(page.getByText("Xero isn't connected.", { exact: false })).toHaveCount(2);
    await expect(page.getByText(/view-only access/)).toHaveCount(0);
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page);
    }
  });

  test("a card folds under its heading", async ({ page }) => {
    await open(page);
    const fold = card(page, "Electronic").getByRole("button", { name: "Fold Electronic" });
    await expect(fold).toHaveAttribute("aria-expanded", "true");
    await fold.click();
    await expect(card(page, "Electronic").getByRole("listitem")).toHaveCount(0);
    await card(page, "Electronic").getByRole("button", { name: "Show Electronic" }).click();
    await expect(rows(page, "Electronic")).toHaveCount(2);
  });

  test("adding from the catalogue: the methods offered, picked, sent by id, drawn from the answer", async ({
    page,
  }) => {
    const sent = await open(page);
    const electronic = card(page, "Electronic");
    await electronic.getByRole("button", { name: "Add New Method" }).click();
    const picker = electronic.getByRole("combobox", { name: "Method" });
    await expect(picker).toBeFocused();
    await expect(electronic.getByRole("option")).toHaveText(["Octopus"]);
    // the note on top as the list opens (owner, 2026-11-12), as every contact picker has it
    await expect(electronic.getByText("Type a method name to add a new method")).toBeVisible();
    await picker.fill("zz");
    await expect(electronic.getByText("No matching payment method found")).toBeVisible();
    await picker.fill("oct");
    await electronic.getByRole("option", { name: "Octopus" }).click();
    await electronic.getByRole("button", { name: "Add", exact: true }).click();
    await expect(toast(page, "Octopus added.")).toBeVisible();
    expect(sent).toEqual([
      {
        method: "POST",
        path: "/sales-methods",
        body: { type: "electronic", sale_info_id: OCTOPUS },
      },
    ]);
    await expect(rows(page, "Electronic")).toHaveText([/Visa/, /AlipayHK/, /Octopus/]);
    await expect(electronic.getByRole("button", { name: "Add New Method" })).toBeVisible();
  });

  test("adding by name on a phone: Other, the name checked as it is typed, then sent", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const sent = await open(page);
    const delivery = card(page, "Delivery");
    await delivery.getByRole("button", { name: "Add New Method" }).click();
    await delivery.getByRole("combobox", { name: "Method" }).fill("Lalamove");
    await delivery.getByRole("option", { name: "+ Add 'Lalamove' as a new method" }).click();
    const name = delivery.getByRole("textbox", { name: "Name" });
    await expect(name).toBeFocused();
    await expect(name).toHaveValue("Lalamove");
    await name.fill("");
    // empty: nothing said until Add is refused for it
    await expect(delivery.getByText(/still empty/)).toHaveCount(0);
    await delivery.getByRole("button", { name: "Add", exact: true }).click();
    await expect(
      delivery.getByText("The method's name is still empty. Type a name to add it."),
    ).toBeVisible();
    // the API's add limit: 80 less the "_sales" its value name gets
    await name.fill("x".repeat(74));
    await expect(delivery.getByText(/too long/)).toHaveCount(0);
    await name.fill("x".repeat(75));
    await expect(
      delivery.getByText("That name is too long. Keep it to 74 characters or fewer."),
    ).toBeVisible();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expectNoHorizontalScroll(page);
    await name.fill("foodpanda");
    await expect(delivery.getByText("foodpanda is already on the list.")).toBeVisible();
    await name.press("Enter");
    expect(sent).toEqual([]);
    await name.fill("Deliveroo Plus");
    await expect(name).not.toHaveAttribute("aria-invalid", "true");
    await name.press("Enter");
    await expect(toast(page, "Deliveroo Plus added.")).toBeVisible();
    expect(sent).toEqual([
      {
        method: "POST",
        path: "/sales-methods",
        body: { type: "delivery", name: "Deliveroo Plus" },
      },
    ]);
    await expect(rows(page, "Delivery")).toHaveText([/Foodpanda/, /Deliveroo Plus/]);
  });

  test("an add the API refuses (409) says its sentence and keeps the form", async ({ page }) => {
    await open(page, initialState(), (s) =>
      s.path === "/sales-methods"
        ? { status: 409, error: "Tap & Go is already on the list." }
        : null,
    );
    const electronic = card(page, "Electronic");
    await electronic.getByRole("button", { name: "Add New Method" }).click();
    await electronic.getByRole("combobox", { name: "Method" }).fill("Tap & Go");
    await electronic.getByRole("option", { name: "+ Add 'Tap & Go' as a new method" }).click();
    await expect(electronic.getByRole("textbox", { name: "Name" })).toHaveValue("Tap & Go");
    await electronic.getByRole("button", { name: "Add", exact: true }).click();
    await expect(toast(page, "Tap & Go is already on the list.")).toBeVisible();
    await expect(electronic.getByRole("textbox", { name: "Name" })).toHaveValue("Tap & Go");
    await expect(rows(page, "Electronic")).toHaveCount(2);
    // Cancel closes it, nothing more sent
    await electronic.getByRole("button", { name: "Cancel" }).click();
    await expect(electronic.getByRole("button", { name: "Add New Method" })).toBeVisible();
  });

  test("renaming: the pencil opens the name box, Enter saves; Escape puts it back", async ({
    page,
  }) => {
    const sent = await open(page);
    const electronic = card(page, "Electronic");
    await electronic.getByRole("button", { name: "Edit AlipayHK" }).click();
    const box = electronic.getByRole("textbox", { name: "Rename AlipayHK" });
    await expect(box).toBeFocused();
    await box.fill("visa");
    await expect(electronic.getByText("visa is already on the list.")).toBeVisible();
    // a rename may run to the API's 80 characters
    await box.fill("x".repeat(80));
    await expect(electronic.getByText(/too long/)).toHaveCount(0);
    await box.fill("x".repeat(81));
    await expect(
      electronic.getByText("That name is too long. Keep it to 80 characters or fewer."),
    ).toBeVisible();
    await box.press("Enter");
    expect(sent).toEqual([]);
    await box.press("Escape");
    await expect(electronic.getByRole("button", { name: "Edit AlipayHK" })).toBeVisible();
    expect(sent).toEqual([]);

    await electronic.getByRole("button", { name: "Edit AlipayHK" }).click();
    await electronic.getByRole("textbox", { name: "Rename AlipayHK" }).fill("Alipay HK");
    await electronic.getByRole("textbox", { name: "Rename AlipayHK" }).press("Enter");
    await expect(toast(page, "Name saved.")).toBeVisible();
    expect(sent).toEqual([
      { method: "PUT", path: `/sales-methods/${ALIPAY}`, body: { name: "Alipay HK" } },
    ]);
    await expect(rows(page, "Electronic")).toHaveText([/Visa/, /Alipay HK/]);
  });

  test("a refused rename (409) says the API's sentence and keeps the old name", async ({
    page,
  }) => {
    await open(page, initialState(), (s) =>
      s.method === "PUT" && s.path.startsWith("/sales-methods/")
        ? { status: 409, error: "A method with that name already exists." }
        : null,
    );
    const electronic = card(page, "Electronic");
    await electronic.getByRole("button", { name: "Edit Visa" }).click();
    await electronic.getByRole("textbox", { name: "Rename Visa" }).fill("Visa Card");
    await electronic.getByRole("textbox", { name: "Rename Visa" }).press("Enter");
    await expect(toast(page, "A method with that name already exists.")).toBeVisible();
    await expect(rows(page, "Electronic")).toHaveText([/Visa/, /AlipayHK/]);
    await expect(toast(page, "Name saved.")).toHaveCount(0);
  });

  test("Minty's method has no pencil; the company's own does", async ({ page }) => {
    const sent = await open(page);
    const delivery = card(page, "Delivery");
    await expect(delivery.getByRole("button", { name: "Edit Foodpanda" })).toHaveCount(0);
    await expect(delivery.getByRole("button", { name: "Delete Foodpanda" })).toHaveCount(0);
    await expect(
      delivery.getByRole("button", { name: "Remove Foodpanda from my list" }),
    ).toBeVisible();
    expect(sent).toEqual([]);
    // the company's own method renames
    await card(page, "Electronic").getByRole("button", { name: "Edit Visa" }).click();
    await expect(
      card(page, "Electronic").getByRole("textbox", { name: "Rename Visa" }),
    ).toBeFocused();
    await expectNoHorizontalScroll(page);
  });

  test("removing Minty's method: the confirm, Go back sends nothing, Remove takes it off the list", async ({
    page,
  }) => {
    const sent = await open(page);
    await off(page, "Delivery", "Foodpanda").click();
    const dialog = page.getByRole("dialog", { name: "Remove Delivery Method" });
    await expect(dialog).toContainText(
      'Remove "Foodpanda" from your list? You can add it back any time from Add New Method.',
    );
    await expect(dialog.getByRole("button", { name: "Go back" })).toBeFocused();
    await dialog.getByRole("button", { name: "Go back" }).click();
    await expect(dialog).toHaveCount(0);
    expect(sent).toEqual([]);

    await off(page, "Delivery", "Foodpanda").click();
    await page
      .getByRole("dialog", { name: "Remove Delivery Method" })
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(
      toast(page, "Foodpanda is off your list. Add it back any time from Add New Method."),
    ).toBeVisible();
    expect(sent).toEqual([{ method: "DELETE", path: `/sales-methods/${FOODPANDA}`, body: null }]);
    await expect(rows(page, "Delivery")).toHaveCount(0);
    await expect(card(page, "Delivery").getByText("No delivery methods yet.")).toBeVisible();
  });

  test("deleting the company's own method: confirmed, then gone from the list", async ({
    page,
  }) => {
    const sent = await open(page);
    await bin(page, "Electronic", "AlipayHK").click();
    const dialog = page.getByRole("dialog", { name: "Delete Electronic Method" });
    await expect(dialog).toContainText(
      'Are you sure you want to delete "AlipayHK"? This action cannot be undone.',
    );
    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(toast(page, "AlipayHK deleted.")).toBeVisible();
    expect(sent).toEqual([{ method: "DELETE", path: `/sales-methods/${ALIPAY}`, body: null }]);
    await expect(rows(page, "Electronic")).toHaveText([/Visa/]);
  });

  test("reordering: a dragged method dropped on another row sends the type's whole list in its new order", async ({
    page,
  }) => {
    const sent = await open(page);
    await expect(card(page, "Electronic").getByRole("menu")).toHaveCount(0);

    await handle(page, "Electronic", "AlipayHK").dragTo(rows(page, "Electronic").first());
    await expect(toast(page, "Order saved.")).toBeVisible();
    expect(sent).toEqual([
      {
        method: "PUT",
        path: "/sales-methods/order",
        body: { type: "electronic", method_ids: [ALIPAY, VISA] },
      },
    ]);
    await expect(rows(page, "Electronic")).toHaveText([/AlipayHK/, /Visa/]);
  });

  test("a reorder refused because the list changed (409) keeps the order and says why", async ({
    page,
  }) => {
    await open(page, initialState(), (s) =>
      s.path === "/sales-methods/order"
        ? {
            status: 409,
            error: "The list changed since it was loaded. Reload the page and order it again.",
          }
        : null,
    );
    // the handle's arrow keys move one place, as a drag does
    await handle(page, "Electronic", "Visa").focus();
    await page.keyboard.press("ArrowDown");
    await expect(
      toast(page, "The list changed since it was loaded. Reload the page and order it again."),
    ).toBeVisible();
    await expect(rows(page, "Electronic")).toHaveText([/Visa/, /AlipayHK/]);
  });

  test("a cashier sees it all read-only: the notice, no controls, no Save", async ({ page }) => {
    const sent = await open(page, initialState({ perms: CASHIER }));
    await expect(
      page.getByText(
        "You have view-only access to these settings. Ask an Accountant or Admin to make changes.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Changes" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add New Method" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Move|Delete|Remove|Edit) / })).toHaveCount(0);
    // the names are text, and no pencil
    await expect(
      card(page, "Electronic").getByRole("button", { name: "Visa", exact: true }),
    ).toHaveCount(0);
    await expect(card(page, "Electronic").getByText("Visa")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Edit / })).toHaveCount(0);
    expect(sent).toEqual([]);
    await expectNoHorizontalScroll(page);
  });

  test("a failure says so and offers a retry; a 403 says the API's sentence", async ({ page }) => {
    let forbidden = false;
    await stubHub(page);
    await page.route(/\/api\/petty-cash\/v1\/companies\/[^/]+\/settings$/, async (route) => {
      if (!forbidden)
        return route.fulfill({
          status: 500,
          json: { error: "Something went wrong on our side. Please try again." },
        });
      return route.fulfill({
        status: 403,
        json: { error: "You don't have permission to see these settings." },
      });
    });
    await page.route(/\/api\/petty-cash\/v1\/companies\/[^/]+\/settings\/xero$/, (route) =>
      route.fulfill({ status: 500, json: { error: "Not the subject here." } }),
    );
    await handoff(page, CREDS, SETTINGS);
    await expect(
      page.getByText("Something went wrong on our side. Please try again."),
    ).toBeVisible();
    forbidden = true;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("You don't have permission to see these settings.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  });

  test("a company still setting up: the door's 409 sentence", async ({ page }) => {
    await stubHub(page);
    await page.route(/\/api\/petty-cash\/v1\/companies\/[^/]+\/settings$/, (route) =>
      route.fulfill({
        status: 409,
        json: {
          error: "This company is still setting up. Finish setting it up to use Petty Cash.",
        },
      }),
    );
    await handoff(page, CREDS, SETTINGS);
    await expect(
      page.getByText("This company is still setting up. Finish setting it up to use Petty Cash."),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Electronic" })).toHaveCount(0);
  });

  // ---- the Xero cards ----

  const MAPPING = "Account mapping";
  const CODES = "Petty Cash Account Code";
  const picker = (page: Page, sub: string, nth = 0) =>
    card(page, MAPPING).getByRole("combobox", { name: sub }).nth(nth);
  const PICKERS: [string, number, string][] = [
    ["Select Petty Cash bank account from Xero", 0, "Petty Cash - 090"],
    ["Select bank account to deposit excess cash", 0, "HSBC Current - 091"],
    ["Select account code for cash sales", 0, "Sales - 200"],
    ["Select the Customer contact", 0, "Walk-in Customer"],
    ["Select account code for the Advance Payment from director", 0, "Owner Drawings - 880"],
    ["Select the Director or Responsible person who pays personally", 0, "Tess Tester"],
    ["Select account code to record Cash Discrepancy", 0, "Suspense - 990"],
    ["Select the Director or Responsible person for the cash difference", 0, "Tess Tester"],
  ];
  const saveIn = (page: Page, title: string) =>
    card(page, title).getByRole("button", { name: "Save Changes" });
  const pickFrom = async (page: Page, sub: string, option: RegExp, nth = 0) => {
    await picker(page, sub, nth).click();
    await card(page, MAPPING).getByRole("option", { name: option }).first().click();
  };

  test("Xero not connected: both cards keep their headings and say so, linking to the Integration tab", async ({
    page,
  }) => {
    const sent = await open(page);
    for (const title of [MAPPING, CODES]) {
      await expect(
        card(page, title).getByRole("status").filter({
          hasText: "Xero isn't connected. Connect it in Integration to set these up.",
        }),
      ).toBeVisible();
    }
    await expect(card(page, MAPPING).getByRole("combobox")).toHaveCount(0);
    await expect(card(page, CODES).getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save Changes" })).toHaveCount(0);
    await expect(card(page, MAPPING).getByRole("link", { name: "Integration" })).toHaveAttribute(
      "href",
      `${HUB_SETTINGS}/integration`,
    );
    expect(sent).toEqual([]);
    await expectNoHorizontalScroll(page);
  });

  test("the Xero read: the groups, the eight pickers in order with the saved choices, the codes ticked", async ({
    page,
  }) => {
    let reads = 0;
    page.on("request", (r) => {
      if (r.method() === "GET" && /\/settings\/xero$/.test(r.url())) reads += 1;
    });
    await open(page, initialState({ xero: xeroState() }));
    const mapping = card(page, MAPPING);
    for (const title of [
      "Petty Cash Account",
      "Deposit Bank Account",
      "Cash Sales",
      "Director Personal Account",
      "Discrepancy - Other Expense",
    ]) {
      await expect(mapping.getByRole("heading", { name: title, level: 4 })).toBeVisible();
    }
    await expect(mapping.getByRole("combobox")).toHaveCount(8);
    for (const [sub, nth, value] of PICKERS)
      await expect(picker(page, sub, nth)).toHaveValue(value);
    await expect(picker(page, PICKERS[0][0])).toHaveAttribute("aria-required", "true");
    await expect(saveIn(page, MAPPING)).toBeDisabled();

    const codes = card(page, CODES);
    await expect(codes.getByRole("checkbox", { name: "400 - Advertising" })).toBeChecked();
    await expect(codes.getByRole("checkbox", { name: "404 - Bank Fees" })).not.toBeChecked();
    await expect(codes.getByRole("checkbox", { name: "429 - General Expenses" })).toBeChecked();
    await expect(
      codes.getByRole("checkbox", { name: "Select all visible account codes" }),
    ).not.toBeChecked();
    await expect(saveIn(page, CODES)).toBeDisabled();
    await expect(page.getByText(/view-only access/)).toHaveCount(0);
    // the read asks Xero: once per page load
    expect(reads).toBe(1);
    for (const width of [360, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoHorizontalScroll(page);
    }
  });

  test("saving the mapping: a new pick, the other bank never offered, the eight keys sent, the API's sentence", async ({
    page,
  }) => {
    const sent = await open(page, initialState({ xero: xeroState() }));
    const mapping = card(page, MAPPING);
    // the Deposit Bank Account never offers the Petty Cash Account's bank
    await picker(page, "Select bank account to deposit excess cash").click();
    await expect(mapping.getByRole("option")).toHaveCount(1);
    await expect(mapping.getByRole("option")).toContainText("HSBC Current");
    await page.keyboard.press("Escape");

    const sales = picker(page, "Select account code for cash sales");
    await sales.click();
    await sales.fill("880");
    await expect(mapping.getByRole("option")).toHaveCount(1);
    await mapping.getByRole("option", { name: /Owner Drawings/ }).click();
    await expect(sales).toHaveValue("Owner Drawings - 880");
    await saveIn(page, MAPPING).click();
    await expect(toast(page, "Account mapping saved.")).toBeVisible();
    expect(sent).toEqual([
      {
        method: "PUT",
        path: "/settings/xero/mapping",
        body: { ...SAVED_MAPPING, cashsale_account: DRAWINGS },
      },
    ]);
    await expect(sales).toHaveValue("Owner Drawings - 880");
    await expect(saveIn(page, MAPPING)).toBeDisabled();
    // not the first save: the page stays
    await expect(page).toHaveURL(new RegExp(`${SETTINGS}$`));
  });

  for (const [sentence, marked] of [
    ["Choose the Cash Sales contact from the list.", ["Select the Customer contact"]],
    [
      "The Petty Cash Account and the Deposit Bank Account can't be the same. Choose a different one for each.",
      ["Select Petty Cash bank account from Xero", "Select bank account to deposit excess cash"],
    ],
    ["Choose the Discrepancy account code.", ["Select account code to record Cash Discrepancy"]],
  ] as const) {
    test(`a mapping save refused (422) says the API's sentence and marks its field: "${sentence.slice(0, 32)}..."`, async ({
      page,
    }) => {
      const sent = await open(page, initialState({ xero: xeroState() }), (s) =>
        s.path === "/settings/xero/mapping" ? { status: 422, error: sentence } : null,
      );
      await pickFrom(page, "Select account code for cash sales", /Owner Drawings/);
      await saveIn(page, MAPPING).click();
      await expect(toast(page, sentence)).toBeVisible();
      expect(sent).toHaveLength(1);
      for (const sub of marked)
        await expect(picker(page, sub)).toHaveAttribute("aria-invalid", "true");
      const sales = picker(page, "Select account code for cash sales");
      await expect(sales).not.toHaveAttribute("aria-invalid", "true");
      // the choice is kept, and Save stays on for another go
      await expect(sales).toHaveValue("Owner Drawings - 880");
      await expect(saveIn(page, MAPPING)).toBeEnabled();
    });
  }

  test("a mapping save refused because Xero has not synced (409) says why", async ({ page }) => {
    const why =
      "Some choices haven't synced from Xero yet: Cash Sales contact. Try again once the Xero sync has finished.";
    await open(page, initialState({ xero: xeroState() }), (s) =>
      s.path === "/settings/xero/mapping" ? { status: 409, error: why } : null,
    );
    await pickFrom(page, "Select account code for cash sales", /Owner Drawings/);
    await saveIn(page, MAPPING).click();
    await expect(toast(page, why)).toBeVisible();
  });

  test("first setup: nothing red on open; a refused Save lists what is missing; the first save stays here, saying so", async ({
    page,
  }) => {
    const sent = await open(page, initialState({ xero: xeroState({ mapping: EMPTY_MAPPING }) }));
    const mapping = card(page, MAPPING);
    await expect(picker(page, PICKERS[0][0])).toHaveValue("");
    await expect(mapping.locator("[aria-invalid=true]")).toHaveCount(0);
    await expect(saveIn(page, MAPPING)).toBeDisabled();

    await pickFrom(page, PICKERS[0][0], /Petty Cash/);
    await saveIn(page, MAPPING).click();
    const summary = mapping.getByRole("alert");
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("link")).toHaveCount(7);
    await expect(
      summary.getByRole("link", { name: "Choose the Deposit Bank Account." }),
    ).toBeVisible();
    await expect(picker(page, PICKERS[1][0])).toHaveAttribute("aria-invalid", "true");
    await expect(picker(page, PICKERS[0][0])).not.toHaveAttribute("aria-invalid", "true");
    expect(sent).toEqual([]);
    await summary.getByRole("link", { name: "Choose the Cash Sales account code." }).click();
    await expect(picker(page, PICKERS[2][0])).toBeFocused();
    await page.keyboard.press("Escape");

    await pickFrom(page, PICKERS[1][0], /HSBC Current/);
    await pickFrom(page, PICKERS[2][0], /Sales/);
    await pickFrom(page, PICKERS[3][0], /Walk-in Customer/);
    await pickFrom(page, PICKERS[4][0], /Owner Drawings/);
    await pickFrom(page, PICKERS[5][0], /Tess Tester/);
    await pickFrom(page, PICKERS[6][0], /Suspense/);
    // one left: focus goes to it with its sentence, no summary
    await saveIn(page, MAPPING).click();
    await expect(mapping.getByRole("alert")).toHaveCount(0);
    await expect(picker(page, PICKERS[7][0])).toBeFocused();
    await expect(mapping.getByText("Choose the Discrepancy contact.")).toBeVisible();
    await mapping.getByRole("option", { name: /Tess Tester/ }).click();
    await expect(mapping.getByText("Choose the Discrepancy contact.")).toHaveCount(0);

    await saveIn(page, MAPPING).click();
    // like every save, the first stays here and says so (owner, 2026-11-11: it used to leave for
    // the Petty Cash dashboard, and its sentence went with the page)
    await expect(toast(page, "Account mapping saved.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${SETTINGS}$`));
    expect(sent).toEqual([{ method: "PUT", path: "/settings/xero/mapping", body: SAVED_MAPPING }]);
  });

  test("adding a new contact: the offer, the New Contact box, accounts-api's POST, then chosen and saved", async ({
    page,
  }) => {
    const sent = await open(page, initialState({ xero: xeroState() }));
    const mapping = card(page, MAPPING);
    const contact = picker(page, "Select the Customer contact");
    await contact.click();
    await contact.fill("zz");
    await expect(mapping.getByText("No contact found")).toBeVisible();
    await contact.fill("Tess");
    await expect(mapping.getByRole("option")).toHaveText([
      "Tess Tester",
      "+ Add 'Tess' as a new contact",
    ]);
    await contact.fill("Nina Ng");
    await mapping.getByRole("option", { name: "+ Add 'Nina Ng' as a new contact" }).click();

    const name = mapping.getByRole("textbox", { name: "New Contact" });
    await expect(name).toHaveValue("Nina Ng");
    await expect(name).toBeFocused();
    // emptied: said under the box on Create, nothing sent
    await name.fill("");
    await mapping.getByRole("button", { name: "Create" }).click();
    await expect(
      mapping.getByText("The contact's name is still empty. Type a name to create it."),
    ).toBeVisible();
    expect(sent).toEqual([]);
    await name.fill("Nina Ng");
    await name.press("Enter");
    await expect(toast(page, "That contact's added!")).toBeVisible();
    expect(sent).toEqual([
      { method: "POST", path: "/api/me/company/contacts", body: { name: "Nina Ng" } },
    ]);
    await expect(contact).toHaveValue("Nina Ng");
    // focus comes back to the box without opening its list, which would cover the next box
    await expect(contact).toBeFocused();
    await expect(mapping.getByRole("listbox")).toHaveCount(0);
    // the other contact pickers offer it too
    await picker(page, "Select the Director or Responsible person who pays personally").click();
    await expect(mapping.getByRole("option", { name: "Nina Ng" })).toBeVisible();
    await page.keyboard.press("Escape");

    await saveIn(page, MAPPING).click();
    await expect(toast(page, "Account mapping saved.")).toBeVisible();
    expect(sent[1]).toEqual({
      method: "PUT",
      path: "/settings/xero/mapping",
      body: { ...SAVED_MAPPING, cashsale_contact: NEW_CONTACT },
    });
  });

  test("a new contact the API refuses says its sentence and keeps the box; Cancel puts the picker back", async ({
    page,
  }) => {
    await open(page, initialState({ xero: xeroState() }), (s) =>
      s.path === "/api/me/company/contacts"
        ? { status: 403, error: "You don't have permission to add contacts." }
        : null,
    );
    const mapping = card(page, MAPPING);
    const contact = picker(page, "Select the Customer contact");
    await contact.click();
    await contact.fill("Nina Ng");
    await mapping.getByRole("option", { name: "+ Add 'Nina Ng' as a new contact" }).click();
    await mapping.getByRole("button", { name: "Create" }).click();
    await expect(toast(page, "You don't have permission to add contacts.")).toBeVisible();
    await expect(mapping.getByRole("textbox", { name: "New Contact" })).toHaveValue("Nina Ng");
    await mapping.getByRole("button", { name: "Cancel" }).click();
    await expect(contact).toHaveValue("Walk-in Customer");
  });

  test("account codes: the search, Select all, at least one ticked (said at once), then saved", async ({
    page,
  }) => {
    const sent = await open(page, initialState({ xero: xeroState() }));
    const codes = card(page, CODES);
    const search = codes.getByRole("searchbox", { name: "Search account code" });
    await search.fill("bank");
    await expect(codes.getByRole("checkbox")).toHaveCount(2); // Select all and Bank Fees
    await search.fill("zz");
    await expect(codes.getByText("No codes match your search.")).toBeVisible();
    await search.fill("");

    await codes.getByRole("checkbox", { name: "400 - Advertising" }).uncheck();
    await expect(codes.getByText("Pick at least one account code.")).toHaveCount(0);
    await codes.getByRole("checkbox", { name: "429 - General Expenses" }).uncheck();
    await expect(codes.getByText("Pick at least one account code.")).toBeVisible();
    await expect(saveIn(page, CODES)).toBeDisabled();
    await expect(saveIn(page, CODES)).toHaveAccessibleDescription(
      "Pick at least one account code.",
    );

    // Select all ticks every row shown; some ticked reads as mixed
    const all = codes.getByRole("checkbox", { name: "Select all visible account codes" });
    await all.check();
    for (const n of ["400 - Advertising", "404 - Bank Fees", "429 - General Expenses"])
      await expect(codes.getByRole("checkbox", { name: n })).toBeChecked();
    await codes.getByRole("checkbox", { name: "400 - Advertising" }).uncheck();
    await codes.getByRole("checkbox", { name: "429 - General Expenses" }).uncheck();
    expect(await all.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(true);
    await expect(codes.getByText("Pick at least one account code.")).toHaveCount(0);

    await saveIn(page, CODES).click();
    await expect(toast(page, "Account codes saved.")).toBeVisible();
    expect(sent).toEqual([
      { method: "PUT", path: "/settings/xero/account-codes", body: { codes: ["404"] } },
    ]);
    await expect(codes.getByRole("checkbox", { name: "404 - Bank Fees" })).toBeChecked();
    await expect(saveIn(page, CODES)).toBeDisabled();
  });

  test("account codes the API refuses (422) say its sentence and keep the ticks", async ({
    page,
  }) => {
    await open(page, initialState({ xero: xeroState() }), (s) =>
      s.path === "/settings/xero/account-codes"
        ? { status: 422, error: "Pick at least one account code." }
        : null,
    );
    const codes = card(page, CODES);
    await codes.getByRole("checkbox", { name: "404 - Bank Fees" }).check();
    await saveIn(page, CODES).click();
    await expect(toast(page, "Pick at least one account code.")).toBeVisible();
    await expect(codes.getByRole("checkbox", { name: "404 - Bank Fees" })).toBeChecked();
  });

  test("a cashier sees the Xero cards read-only: the choices and ticks, no Save, the search still works", async ({
    page,
  }) => {
    const sent = await open(
      page,
      initialState({ perms: CASHIER, xero: xeroState({ edit: false }) }),
    );
    for (const [sub, nth, value] of PICKERS) {
      await expect(picker(page, sub, nth)).toHaveValue(value);
      await expect(picker(page, sub, nth)).toBeDisabled();
    }
    const codes = card(page, CODES);
    await expect(codes.getByRole("checkbox", { name: "400 - Advertising" })).toBeChecked();
    await expect(codes.getByRole("checkbox", { name: "400 - Advertising" })).toBeDisabled();
    await expect(
      codes.getByRole("checkbox", { name: "Select all visible account codes" }),
    ).toBeDisabled();
    await expect(saveIn(page, MAPPING)).toHaveCount(0);
    await expect(saveIn(page, CODES)).toHaveCount(0);
    await codes.getByRole("searchbox", { name: "Search account code" }).fill("bank");
    await expect(codes.getByRole("checkbox")).toHaveCount(2);
    expect(sent).toEqual([]);
    await expectNoHorizontalScroll(page);
  });

  test("a Xero read that fails says so in both cards, and Try again asks once more", async ({
    page,
  }) => {
    let fail = true;
    await stub(page, initialState({ xero: xeroState() }));
    // registered after the stub, so it answers first
    await page.route(/\/api\/petty-cash\/v1\/companies\/[^/]+\/settings\/xero$/, (route) =>
      fail
        ? route.fulfill({
            status: 502,
            json: { error: "I couldn't reach Xero just now. Try again in a minute." },
          })
        : route.fallback(),
    );
    await handoff(page, CREDS, SETTINGS);
    await expect(
      card(page, MAPPING).getByText("I couldn't reach Xero just now. Try again in a minute."),
    ).toBeVisible();
    await expect(
      card(page, CODES).getByText("I couldn't reach Xero just now. Try again in a minute."),
    ).toBeVisible();
    // the cards that need no Xero are there all the same
    await expect(rows(page, "Electronic")).toHaveText([/Visa/, /AlipayHK/]);
    fail = false;
    await card(page, MAPPING).getByRole("button", { name: "Try again" }).click();
    await expect(picker(page, PICKERS[0][0])).toHaveValue("Petty Cash - 090");
    await expect(
      card(page, CODES).getByRole("checkbox", { name: "400 - Advertising" }),
    ).toBeChecked();
  });

  test("the page reloads with no console error", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await open(page);
    await page.reload();
    await expect(rows(page, "Electronic")).toHaveCount(2);
    expect(errors).toEqual([]);
  });
});
