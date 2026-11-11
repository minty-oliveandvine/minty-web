// Petty Cash Settings as a person sees it in the hub: the read, a sales method added, renamed,
// moved and deleted, the Xero mapping and account codes saved, a cashier's read-only page, the
// door's 409 for a company still setting up, and the first mapping save staying on the page (owner,
// 2026-11-11). minty-petty-cash-api is answered per path and method; every call names the
// company in its path and never with X-Entity-Id.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DISCARD_CHANGES, GO_BACK_UPPER, LEAVE_TITLE } from "@/components/ui/LeaveDialog";
import { ToastProvider } from "@/components/ui/Toast";
import { SETTINGS_DANGER_FILL, SETTINGS_PRIMARY } from "@/components/ui/settingsButtons";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import type {
  SettingsPermissions,
  SettingsRead,
} from "@/features/petty-cash-settings/lib/settings";
import type { MappingKey, XeroRead } from "@/features/petty-cash-settings/lib/xeroSettings";
import {
  PettyCashSettingsScreen,
  READ_ONLY,
} from "@/features/petty-cash-settings/routes/PettyCashSettingsScreen";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/entity/e1/olive-shop/settings/petty-cash",
}));

const ID = "e1";
const COMPANY = { id: ID, name: "Olive Shop" };
const PREFIX = `/api/petty-cash/v1/companies/${ID}`;
const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Route = (body: unknown) => Response;
function api(routes: Record<string, Route>) {
  fetchMock.mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input));
    expect(url.origin).toBe(new URL(env.PETTY_CASH_API_URL).origin);
    expect(url.pathname.startsWith(PREFIX)).toBe(true);
    expect(new Headers(init.headers).get("X-Entity-Id")).toBeNull();
    expect(new Headers(init.headers).get("Authorization")).toMatch(/^Bearer /);
    const key = `${(init.method ?? "GET").toUpperCase()} ${url.pathname.slice(PREFIX.length)}`;
    const route = routes[key];
    if (!route) throw new Error(`unexpected ${key}`);
    return route(init.body ? JSON.parse(String(init.body)) : null);
  });
}
const sent = (key: string) =>
  fetchMock.mock.calls
    .filter(
      ([input, init]) =>
        `${((init as RequestInit)?.method ?? "GET").toUpperCase()} ${new URL(String(input)).pathname.slice(PREFIX.length)}` ===
        key,
    )
    .map(([, init]) => JSON.parse(String((init as RequestInit).body ?? "null")));

const ALL: SettingsPermissions = {
  edit_xero: true,
  view_sales_methods: true,
  add_sales_method: true,
  rename_sales_method: true,
  remove_sales_method: true,
  reorder_sales_methods: true,
};
const CASHIER: SettingsPermissions = {
  ...ALL,
  edit_xero: false,
  add_sales_method: false,
  rename_sales_method: false,
  remove_sales_method: false,
  reorder_sales_methods: false,
};
const m = (id: string, name: string, shared = false) => ({
  id,
  name,
  value_name: `${name.toLowerCase()}_sales`,
  shared,
});
const VISA = m("v1", "Visa");
const ALIPAY = m("v2", "AlipayHK");
const FOODPANDA = m("d1", "Foodpanda", true);

function settings(over: Partial<SettingsRead> = {}): SettingsRead {
  return {
    sales_methods: { electronic: [VISA, ALIPAY], delivery: [FOODPANDA] },
    available: {
      electronic: [{ id: "o1", name: "Octopus" }],
      delivery: [{ id: "k1", name: "Keeta" }],
    },
    xero_connected: true,
    permissions: ALL,
    ...over,
  };
}

const KEYS: MappingKey[] = [
  "main_bank",
  "deposit_bank",
  "cashsale_account",
  "cashsale_contact",
  "owners_account",
  "owners_contact",
  "discrepancy_account",
  "discrepancy_contact",
];
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
  { id: "b1", name: "Petty Cash", code: "090" },
  { id: "b2", name: "HSBC Current", code: "091" },
];
const ACCOUNTS = [
  { id: "a1", name: "Sales", code: "200" },
  { id: "a2", name: "Owner Drawings", code: "880" },
];
const CONTACTS = [
  { id: "c1", name: "Walk-in Customer" },
  { id: "c2", name: "Tess Tester" },
];
const SAVED: Record<MappingKey, string | null> = {
  main_bank: "b1",
  deposit_bank: "b2",
  cashsale_account: "a1",
  cashsale_contact: "c1",
  owners_account: "a2",
  owners_contact: "c2",
  discrepancy_account: "a2",
  discrepancy_contact: "c2",
};

function xero(
  over: { live?: boolean; edit?: boolean; mapping?: Record<MappingKey, string | null> } = {},
): XeroRead {
  const live = over.live ?? true;
  const edit = over.edit ?? true;
  const mapping = over.mapping ?? SAVED;
  return {
    live,
    organisation: live ? "Olive Ltd" : null,
    mapping: live
      ? KEYS.map((key) => ({
          key,
          label: LABELS[key],
          kind: key.endsWith("contact") ? ("contact" as const) : ("account" as const),
          options: key.endsWith("bank") ? BANKS : key.endsWith("contact") ? CONTACTS : ACCOUNTS,
          selected: mapping[key],
        }))
      : null,
    mapping_saved: mapping.main_bank !== null,
    account_codes: live
      ? [
          { code: "400", name: "Advertising", selected: true },
          { code: "404", name: "Bank Fees", selected: false },
        ]
      : null,
    permissions: { edit_mapping: edit, edit_account_codes: edit },
  };
}

function show() {
  render(
    <ToastProvider>
      <PettyCashSettingsScreen company={COMPANY} />
    </ToastProvider>,
  );
}

/** The page is drawn once `GET /settings` has answered. */
const drawn = () => screen.findByRole("list", { name: "Electronic methods" });

const card = (name: string) => within(screen.getByRole("region", { name }));

describe("PettyCashSettingsScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", ID, "Olive Shop");
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads the methods in order and the Xero cards once, in the shell's Petty Cash tab", async () => {
    api({
      "GET /settings": () => json(settings()),
      "GET /settings/xero": () => json(xero({ live: false })),
    });
    show();

    const electronic = within(await screen.findByRole("list", { name: "Electronic methods" }));
    expect(electronic.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Visa"),
      expect.stringContaining("AlipayHK"),
    ]);
    const tabs = within(screen.getByRole("navigation", { name: "Settings sections" }));
    expect(tabs.getByText("Petty Cash Settings")).toHaveAttribute("aria-current", "page");
    // not connected: both Xero cards say so, linking to this app's Integration tab
    expect(await screen.findAllByText(/Xero isn.t connected/)).toHaveLength(2);
    for (const link of screen.getAllByRole("link", { name: "Integration" }))
      expect(link).toHaveAttribute("href", "/entity/e1/olive-shop/settings/integration");
    expect(screen.queryByText(READ_ONLY)).toBeNull();
    expect(sent("GET /settings/xero")).toHaveLength(1);
  });

  it("a Non-cash company sees one Non-cash card and no empty Delivery card", async () => {
    api({
      "GET /settings": () =>
        json(
          settings({
            sales_groups: "non_cash",
            sales_methods: { electronic: [VISA, ALIPAY], delivery: [] },
          }),
        ),
      "GET /settings/xero": () => json(xero({ live: false })),
    });
    show();

    expect(await screen.findByRole("list", { name: "Non-cash methods" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Delivery methods" })).toBeNull();
    expect(screen.queryByText("No delivery methods yet.")).toBeNull();
  });

  it("adds from the catalogue, renames, moves and deletes - each the API's answer, its sentence shown", async () => {
    let state = settings();
    const answer = (next: SettingsRead, message: string, status = 200) => {
      state = next;
      return json({ ...next, message }, status);
    };
    api({
      "GET /settings": () => json(state),
      "GET /settings/xero": () => json(xero({ live: false })),
      "POST /sales-methods": () =>
        answer(
          {
            ...state,
            sales_methods: {
              ...state.sales_methods,
              electronic: [...state.sales_methods.electronic, m("o1", "Octopus")],
            },
            available: { ...state.available, electronic: [] },
          },
          "Octopus added.",
          201,
        ),
      "PUT /sales-methods/v2": (body) =>
        answer(
          {
            ...state,
            sales_methods: {
              ...state.sales_methods,
              electronic: state.sales_methods.electronic.map((x) =>
                x.id === "v2" ? { ...x, name: (body as { name: string }).name } : x,
              ),
            },
          },
          "Name saved.",
        ),
      "PUT /sales-methods/order": (body) => {
        const ids = (body as { method_ids: string[] }).method_ids;
        return answer(
          {
            ...state,
            sales_methods: {
              ...state.sales_methods,
              electronic: ids.map((id) => state.sales_methods.electronic.find((x) => x.id === id)!),
            },
          },
          "Order saved.",
        );
      },
      "DELETE /sales-methods/d1": () =>
        answer(
          { ...state, sales_methods: { ...state.sales_methods, delivery: [] } },
          "Method removed. Reports that used it keep their amounts.",
        ),
    });
    show();
    await drawn();
    const user = userEvent.setup();

    // add: the catalogue, picked, sent by id
    await user.click(await card("Electronic").findByRole("button", { name: /Add New Method/ }));
    const picker = card("Electronic").getByRole("combobox", { name: "Method" });
    await waitFor(() => expect(picker).toHaveFocus());
    expect(
      card("Electronic")
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Octopus", "+ Other (type a new name)"]);
    await user.click(card("Electronic").getByRole("option", { name: "Octopus" }));
    await user.click(card("Electronic").getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Octopus added.")).toBeInTheDocument();
    expect(sent("POST /sales-methods")).toEqual([{ type: "electronic", sale_info_id: "o1" }]);
    expect(card("Electronic").getByRole("button", { name: "Octopus" })).toBeInTheDocument();

    // rename: the name becomes a box, checked as typed, Enter saves
    await user.click(card("Electronic").getByRole("button", { name: "AlipayHK" }));
    const box = card("Electronic").getByRole("textbox", { name: "Rename AlipayHK" });
    await user.clear(box);
    await user.type(box, "visa");
    expect(card("Electronic").getByText("visa is already on the list.")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(sent("PUT /sales-methods/v2")).toEqual([]);
    await user.clear(box);
    await user.type(box, "Alipay HK{Enter}");
    expect(await screen.findByText("Name saved.")).toBeInTheDocument();
    expect(sent("PUT /sales-methods/v2")).toEqual([{ name: "Alipay HK" }]);

    // move: the type's whole list in its new order
    await user.click(card("Electronic").getByRole("button", { name: "Actions for Visa" }));
    expect(card("Electronic").getByRole("menuitem", { name: "Move up" })).toBeDisabled();
    await user.click(card("Electronic").getByRole("menuitem", { name: "Move down" }));
    expect(await screen.findByText("Order saved.")).toBeInTheDocument();
    expect(sent("PUT /sales-methods/order")).toEqual([
      { type: "electronic", method_ids: ["v2", "v1", "o1"] },
    ]);

    // a shared method can't be renamed, and says why at once
    await user.click(card("Delivery").getByRole("button", { name: "Foodpanda" }));
    expect(
      card("Delivery").getByText(
        "Other companies use Foodpanda too, so it can't be renamed here. Delete it and add a new method instead.",
      ),
    ).toBeInTheDocument();
    expect(card("Delivery").queryByRole("textbox")).toBeNull();

    // delete asks first: Go back sends nothing, Delete removes it
    await user.click(card("Delivery").getByRole("button", { name: "Actions for Foodpanda" }));
    await user.click(card("Delivery").getByRole("menuitem", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete Delivery Method" })).toHaveTextContent(
      'Are you sure you want to delete "Foodpanda"? This action cannot be undone.',
    );
    let dialog = within(screen.getByRole("dialog", { name: "Delete Delivery Method" }));
    expect(dialog.getByRole("button", { name: "Go back" })).toHaveFocus();
    await user.click(dialog.getByRole("button", { name: "Go back" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sent("DELETE /sales-methods/d1")).toHaveLength(0);
    await user.click(card("Delivery").getByRole("button", { name: "Actions for Foodpanda" }));
    await user.click(card("Delivery").getByRole("menuitem", { name: "Delete" }));
    dialog = within(screen.getByRole("dialog", { name: "Delete Delivery Method" }));
    expect(dialog.getByRole("button", { name: "Delete" }).className).toBe(SETTINGS_DANGER_FILL);
    await user.click(dialog.getByRole("button", { name: "Delete" }));
    expect(
      await screen.findByText("Method removed. Reports that used it keep their amounts."),
    ).toBeInTheDocument();
    expect(card("Delivery").getByText("No delivery methods yet.")).toBeInTheDocument();
  });

  it("an add by name is checked as typed; a refusal says the API's sentence and keeps the form", async () => {
    api({
      "GET /settings": () => json(settings()),
      "GET /settings/xero": () => json(xero({ live: false })),
      "POST /sales-methods": () => json({ error: "Deliveroo is already on the list." }, 409),
    });
    show();
    await drawn();
    const user = userEvent.setup();

    await user.click(await card("Delivery").findByRole("button", { name: /Add New Method/ }));
    await user.click(card("Delivery").getByRole("option", { name: "+ Other (type a new name)" }));
    const name = card("Delivery").getByRole("textbox", { name: "Name" });
    await waitFor(() => expect(name).toHaveFocus());
    expect(card("Delivery").queryByText(/still empty/)).toBeNull();
    await user.click(card("Delivery").getByRole("button", { name: "Add" }));
    expect(
      card("Delivery").getByText("The method's name is still empty. Type a name to add it."),
    ).toBeInTheDocument();
    await user.type(name, "x".repeat(75));
    expect(
      card("Delivery").getByText("That name is too long. Keep it to 74 characters or fewer."),
    ).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");
    await user.clear(name);
    await user.type(name, "Deliveroo{Enter}");
    expect(await screen.findByText("Deliveroo is already on the list.")).toBeInTheDocument();
    expect(sent("POST /sales-methods")).toEqual([{ type: "delivery", name: "Deliveroo" }]);
    expect(name).toHaveValue("Deliveroo");
  });

  it("saves the Xero mapping: a new pick, the eight keys sent, the API's sentence", async () => {
    let read = xero();
    api({
      "GET /settings": () => json(settings()),
      "GET /settings/xero": () => json(read),
      "PUT /settings/xero/mapping": (body) => {
        read = xero({ mapping: body as Record<MappingKey, string> });
        return json({ ...read, message: "Xero account mapping saved.", first_save: false });
      },
    });
    show();
    await drawn();
    const user = userEvent.setup();

    const mapping = card("Xero account mapping");
    const sales = await mapping.findByRole("combobox", {
      name: /Select account code for cash sales/,
    });
    expect(sales).toHaveValue("Sales - 200");
    const save = mapping.getByRole("button", { name: "Save Changes" });
    expect(save).toBeDisabled();
    expect(save.className).toBe(SETTINGS_PRIMARY);
    // the Deposit Bank Account never offers the Petty Cash Account's bank
    await user.click(mapping.getByRole("combobox", { name: /deposit excess cash/ }));
    expect(mapping.getAllByRole("option").map((o) => o.textContent)).toEqual(["HSBC Current091"]);
    await user.keyboard("{Escape}");

    await user.clear(sales);
    await user.type(sales, "880");
    await user.click(mapping.getByRole("option", { name: /Owner Drawings/ }));
    expect(sales).toHaveValue("Owner Drawings - 880");
    await user.click(save);
    expect(await screen.findByText("Xero account mapping saved.")).toBeInTheDocument();
    expect(sent("PUT /settings/xero/mapping")).toEqual([{ ...SAVED, cashsale_account: "a2" }]);
    await waitFor(() =>
      expect(
        card("Xero account mapping").getByRole("button", { name: "Save Changes" }),
      ).toBeDisabled(),
    );
  });

  it("first setup: a refused Save lists what is missing; the first save stays here, saying so", async () => {
    const empty = Object.fromEntries(KEYS.map((k) => [k, null])) as Record<MappingKey, null>;
    api({
      "GET /settings": () => json(settings()),
      "GET /settings/xero": () => json(xero({ mapping: empty })),
      "PUT /settings/xero/mapping": (body) =>
        json({
          ...xero({ mapping: body as Record<MappingKey, string> }),
          message: "Xero account mapping saved.",
          first_save: true,
        }),
    });
    show();
    await drawn();
    const user = userEvent.setup();
    const mapping = card("Xero account mapping");
    const first = await mapping.findByRole("combobox", { name: /Select Petty Cash bank account/ });
    expect(
      mapping.getAllByRole("combobox").filter((b) => b.getAttribute("aria-invalid") === "true"),
    ).toHaveLength(0);
    await user.click(first);
    await user.click(mapping.getByRole("option", { name: /Petty Cash/ }));
    await user.click(mapping.getByRole("button", { name: "Save Changes" }));

    const summary = within(mapping.getByRole("alert"));
    expect(summary.getAllByRole("link")).toHaveLength(7);
    expect(summary.getByRole("link", { name: "Choose the Deposit Bank Account." })).toBeVisible();
    expect(sent("PUT /settings/xero/mapping")).toEqual([]);

    const picks: [RegExp, RegExp][] = [
      [/deposit excess cash/, /HSBC Current/],
      [/for cash sales/, /Sales/],
      [/Customer contact/, /Walk-in Customer/],
      [/Advance Payment from director/, /Owner Drawings/],
      [/Cash Discrepancy/, /Owner Drawings/],
    ];
    for (const [box, option] of picks) {
      await user.click(mapping.getByRole("combobox", { name: box }));
      await user.click(mapping.getAllByRole("option", { name: option })[0]);
    }
    for (const box of mapping.getAllByRole("combobox", { name: /Director or Responsible/ })) {
      await user.click(box);
      await user.click(mapping.getByRole("option", { name: /Tess Tester/ }));
    }
    await user.click(mapping.getByRole("button", { name: "Save Changes" }));
    // Like every save: the sentence shows and the page stays (owner, 2026-11-11 - it used to leave
    // for the Petty Cash dashboard, and the sentence went with the page).
    expect(await screen.findByText("Xero account mapping saved.")).toBeInTheDocument();
    expect(sent("PUT /settings/xero/mapping")).toEqual([SAVED]);
    expect(
      card("Xero account mapping").getByRole("button", { name: "Save Changes" }),
    ).toBeInTheDocument();
  });

  it("saves the account codes: at least one stays ticked, said at once", async () => {
    let read = xero();
    api({
      "GET /settings": () => json(settings()),
      "GET /settings/xero": () => json(read),
      "PUT /settings/xero/account-codes": (body) => {
        const codes = (body as { codes: string[] }).codes;
        read = {
          ...read,
          account_codes: read.account_codes!.map((c) => ({
            ...c,
            selected: codes.includes(c.code),
          })),
        };
        return json({ ...read, message: "Account codes saved." });
      },
    });
    show();
    await drawn();
    const user = userEvent.setup();
    const codes = card("Petty Cash Account Code");
    const advertising = await codes.findByRole("checkbox", { name: "400 - Advertising" });
    await user.click(advertising);
    expect(codes.getByText("Pick at least one account code.")).toBeInTheDocument();
    const save = codes.getByRole("button", { name: "Save Changes" });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription("Pick at least one account code.");
    await user.click(codes.getByRole("checkbox", { name: "404 - Bank Fees" }));
    expect(codes.queryByText("Pick at least one account code.")).toBeNull();
    await user.click(save);
    expect(await screen.findByText("Account codes saved.")).toBeInTheDocument();
    expect(sent("PUT /settings/xero/account-codes")).toEqual([{ codes: ["404"] }]);
  });

  it("a cashier sees it all read-only: the notice, no controls, no Save", async () => {
    api({
      "GET /settings": () => json(settings({ permissions: CASHIER })),
      "GET /settings/xero": () => json(xero({ edit: false })),
    });
    show();

    expect(await screen.findByText(READ_ONLY)).toBeInTheDocument();
    await screen.findByRole("combobox", { name: /Select Petty Cash bank account/ });
    expect(screen.queryByRole("button", { name: "Save Changes" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Add New Method/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Actions for/ })).toBeNull();
    expect(card("Electronic").queryByRole("button", { name: "Visa" })).toBeNull();
    expect(card("Electronic").getByText("Visa")).toBeInTheDocument();
    for (const box of screen.getAllByRole("combobox")) expect(box).toBeDisabled();
    expect(
      card("Petty Cash Account Code").getByRole("checkbox", { name: "400 - Advertising" }),
    ).toBeDisabled();
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(
      true,
    );
  });

  it("a company still setting up: the door's 409 sentence, and no Try again (it can't help)", async () => {
    const SETTING_UP = "This company is still setting up. Finish setting it up to use Petty Cash.";
    let reads = 0;
    api({
      "GET /settings": () => {
        reads += 1;
        return json({ error: SETTING_UP }, 409);
      },
    });
    show();

    expect(await screen.findByText(SETTING_UP)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(reads).toBe(1);
    expect(screen.queryByRole("region", { name: "Electronic" })).toBeNull();
  });

  it("a 403 says the API's sentence and offers no retry", async () => {
    api({
      "GET /settings": () => json({ error: "You don't have access to that company." }, 403),
    });
    show();

    expect(await screen.findByText("You don't have access to that company.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("a Xero read that fails says so in both cards; Try again asks once more", async () => {
    let fail = true;
    api({
      "GET /settings": () => json(settings()),
      "GET /settings/xero": () =>
        fail
          ? json({ error: "I couldn't reach Xero just now. Try again in a minute." }, 502)
          : json(xero()),
    });
    show();

    expect(
      await screen.findAllByText("I couldn't reach Xero just now. Try again in a minute."),
    ).toHaveLength(2);
    expect(card("Electronic").getByRole("button", { name: "Visa" })).toBeInTheDocument();
    fail = false;
    await userEvent.click(card("Xero account mapping").getByRole("button", { name: "Try again" }));
    expect(
      await card("Xero account mapping").findByRole("combobox", {
        name: /Select Petty Cash bank account/,
      }),
    ).toHaveValue("Petty Cash - 090");
    expect(sent("GET /settings/xero")).toHaveLength(2);
  });
});

// "Leave without saving?" over the two Xero cards (2026-11-11; the port had no guard): the sales
// methods save at once, so only the cards can hold unsaved choices.
describe("PettyCashSettingsScreen - leaving with unsaved Xero choices", () => {
  let went: string[];
  const onClick = (event: MouseEvent) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (anchor instanceof HTMLAnchorElement) {
      event.preventDefault();
      went.push(anchor.getAttribute("href") ?? "");
    }
  };
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", ID, "Olive Shop");
    fetchMock.mockReset();
    went = [];
    window.addEventListener("click", onClick);
  });
  afterEach(() => {
    window.removeEventListener("click", onClick);
    vi.unstubAllGlobals();
  });

  it("asks first: Go Back keeps the tick, Discard changes puts the saved ticks back and goes", async () => {
    api({
      "GET /settings": () => json(settings()),
      "GET /settings/xero": () => json(xero()),
    });
    show();
    await drawn();
    const user = userEvent.setup();
    const codes = card("Petty Cash Account Code");
    await user.click(await codes.findByRole("checkbox", { name: "404 - Bank Fees" }));

    await user.click(screen.getByRole("link", { name: "Users" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName(LEAVE_TITLE);
    expect(went).toEqual([]);

    await user.click(within(dialog).getByRole("button", { name: GO_BACK_UPPER }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(codes.getByRole("checkbox", { name: "404 - Bank Fees" })).toBeChecked();

    await user.click(screen.getByRole("link", { name: "Users" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: DISCARD_CHANGES }),
    );
    expect(
      card("Petty Cash Account Code").getByRole("checkbox", { name: "404 - Bank Fees" }),
    ).not.toBeChecked();
    expect(went).toEqual([expect.stringContaining("/settings/users")]);
  });

  it("asks nothing when nothing changed", async () => {
    api({
      "GET /settings": () => json(settings()),
      "GET /settings/xero": () => json(xero()),
    });
    show();
    await drawn();
    await card("Petty Cash Account Code").findByRole("checkbox", { name: "404 - Bank Fees" });
    await userEvent.click(screen.getByRole("link", { name: "Users" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(went).toEqual([expect.stringContaining("/settings/users")]);
  });
});
