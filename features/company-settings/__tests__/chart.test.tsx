// General's chart of accounts and contacts as a person uses them (owner, 2026-11-12; their own tab
// first, merged into General the same day): the two lists, Edit and Delete on every row, the add
// form with the next free code filled in, delete asking first, the API's sentences shown, and a
// view-only person shown the lists alone (General's own view-only line says why). accounts-api is
// answered per path and method; every call names the company as ?entity=.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import type { AccountsRead, ContactsRead } from "@/features/company-settings/api/chart";
import { ChartSection } from "@/features/company-settings/components/ChartSection";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/entity/360812e1/olive-and-vine/settings/general",
}));

const ID = "360812e1-9f3a-4c21-8e5b-1a2b3c4d5e6f";
const COMPANY = { id: ID, name: "Olive & Vine" };
const ALL = { add: true, edit: true, delete: true };

function accounts(over: Partial<AccountsRead> = {}): AccountsRead {
  const row = (id: string, code: string, name: string, extra = {}) => ({
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
    ...extra,
  });
  return {
    accounts: [
      row("a-rent", "469", "Rent", { in_xero: true, used: true }),
      row("a-wages", "477", "Wages", { source: "template" }),
    ],
    types: [
      { value: "bank", label: "Bank" },
      { value: "expense", label: "Expense" },
    ],
    next_codes: { bank: "090", expense: "478" },
    minty_accounts: [
      {
        id: "t-fuel",
        code: "470",
        name: "Fuel",
        type: "expense",
        type_label: "Expense",
        description: "Vans and cars",
      },
    ],
    xero_live: false,
    permissions: ALL,
    ...over,
  };
}

function contacts(over: Partial<ContactsRead> = {}): ContactsRead {
  return {
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
    xero_live: false,
    permissions: ALL,
    ...over,
  };
}

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
type Handler = (body: unknown) => Response;
const sent: { method: string; path: string; body: unknown }[] = [];

function api(routes: Record<string, Handler>) {
  fetchMock.mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input));
    expect(url.origin).toBe(new URL(env.ACCOUNTS_API_URL).origin);
    expect(url.searchParams.get("entity")).toBe(ID);
    const method = (init.method ?? "GET").toUpperCase();
    const body = init.body ? JSON.parse(String(init.body)) : null;
    if (method !== "GET") sent.push({ method, path: url.pathname, body });
    const handler = routes[`${method} ${url.pathname}`];
    if (!handler) throw new Error(`unexpected ${method} ${url.pathname}`);
    return handler(body);
  });
}

function show() {
  render(
    <ToastProvider>
      <ChartSection entityId={COMPANY.id} />
    </ToastProvider>,
  );
}

const card = (title: string) => within(screen.getByRole("region", { name: title }));
/** The first read drawn: the cards are on the page. */
const loaded = () => screen.findByRole("region", { name: "Chart of accounts" });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  setAuth(`h.${btoa(JSON.stringify({ user_id: "u1", role: "admin" }))}.s`, ID, COMPANY.name);
  sent.length = 0;
});
afterEach(() => vi.unstubAllGlobals());

describe("the two lists", () => {
  it("show Edit and Delete on every row, Minty's copies marked where they came from", async () => {
    api({
      "GET /api/me/company/accounts": () => json(accounts()),
      "GET /api/me/company/contacts": () => json(contacts()),
    });
    show();
    await loaded();

    const chart = card("Chart of accounts");
    expect(await chart.findByText("469 - Rent")).toBeInTheDocument();
    expect(chart.getByRole("button", { name: "Edit 469 - Rent" })).toBeInTheDocument();
    expect(chart.getByRole("button", { name: "Delete 469 - Rent" })).toBeInTheDocument();
    expect(chart.getByText("In Xero")).toBeInTheDocument();
    // a copy of Minty's is the company's own too (owner, 2026-11-12), marked where it came from
    expect(chart.getByRole("button", { name: "Edit 477 - Wages" })).toBeInTheDocument();
    expect(chart.getByRole("button", { name: "Delete 477 - Wages" })).toBeInTheDocument();
    expect(chart.getByText("Comes with Minty")).toBeInTheDocument();

    const people = card("Contacts");
    expect(people.getByRole("button", { name: "Edit Kee Wah" })).toBeInTheDocument();
    expect(people.getByRole("button", { name: "Delete Walk-in Customer" })).toBeInTheDocument();
  });

  it("a view-only person sees the lists alone", async () => {
    const none = { add: false, edit: false, delete: false };
    api({
      "GET /api/me/company/accounts": () => json(accounts({ permissions: none })),
      "GET /api/me/company/contacts": () => json(contacts({ permissions: none })),
    });
    show();
    await loaded();

    expect(await screen.findByText("469 - Rent")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Edit|Delete|Add) / })).toBeNull();
  });

  it("a failed read says so and tries again", async () => {
    let fail = true;
    api({
      "GET /api/me/company/accounts": () =>
        fail ? json({ error: "I couldn't reach the accounts just now." }, 503) : json(accounts()),
      "GET /api/me/company/contacts": () => json(contacts()),
    });
    show();
    expect(await screen.findByText("I couldn't reach the accounts just now.")).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("469 - Rent")).toBeInTheDocument();
  });
});

describe("an account", () => {
  it("one of Minty's accounts is picked from the dropdown and added as it is", async () => {
    api({
      "GET /api/me/company/accounts": () => json(accounts()),
      "GET /api/me/company/contacts": () => json(contacts()),
      "POST /api/me/company/accounts": () => json({ account: {}, message: "Fuel added." }, 201),
    });
    show();
    await loaded();
    const user = userEvent.setup();
    await user.click(
      await card("Chart of accounts").findByRole("button", { name: /Add an account/ }),
    );
    const dialog = within(screen.getByRole("group", { name: "Add an account" }));
    const picker = dialog.getByRole("combobox", { name: /Account/ });
    await user.click(picker);
    // the note on top as the list opens, as Petty Cash Settings' Add New Method
    expect(dialog.getByText("Type an account name to add a new account")).toBeInTheDocument();
    await user.click(dialog.getByRole("option", { name: /Fuel/ }));
    expect(dialog.getByText("470 - Fuel")).toBeInTheDocument();
    expect(dialog.queryByLabelText(/Type/)).toBeNull(); // nothing to fill in
    await user.click(dialog.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Fuel added.")).toBeInTheDocument();
    expect(sent).toEqual([
      { method: "POST", path: "/api/me/company/accounts", body: { template_id: "t-fuel" } },
    ]);
  });

  it("nothing picked is said; a typed name opens the fields for one of the company's own", async () => {
    api({
      "GET /api/me/company/accounts": () => json(accounts()),
      "GET /api/me/company/contacts": () => json(contacts()),
      "POST /api/me/company/accounts": () => json({ account: {}, message: "Parking added." }, 201),
    });
    show();
    await loaded();
    const user = userEvent.setup();
    await user.click(
      await card("Chart of accounts").findByRole("button", { name: /Add an account/ }),
    );
    const dialog = within(screen.getByRole("group", { name: "Add an account" }));
    await user.click(dialog.getByRole("button", { name: "Add" }));
    expect(
      dialog.getByText("Pick one of Minty's accounts, or type a name to add your own."),
    ).toBeInTheDocument();
    await user.type(dialog.getByRole("combobox", { name: /Account/ }), "Parking");
    await user.click(dialog.getByRole("option", { name: "+ Add 'Parking' as a new account" }));
    expect(dialog.getByLabelText(/^Name/)).toHaveValue("Parking");

    await user.selectOptions(dialog.getByLabelText(/Type/), "expense");
    expect(dialog.getByLabelText(/Code/)).toHaveValue("478");
    expect(
      dialog.getByText("478 is the next free code for Expense. You can change it."),
    ).toBeInTheDocument();
    await user.clear(dialog.getByLabelText(/Code/));
    await user.type(dialog.getByLabelText(/Code/), "469");
    expect(
      dialog.getByText("The code 469 is already used by Rent. Choose another code."),
    ).toBeInTheDocument();
    await user.clear(dialog.getByLabelText(/Code/));
    await user.type(dialog.getByLabelText(/Code/), "471");
    await user.click(dialog.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("Parking added.")).toBeInTheDocument();
    expect(sent).toEqual([
      {
        method: "POST",
        path: "/api/me/company/accounts",
        body: { code: "471", name: "Parking", type: "expense", description: "" },
      },
    ]);
  });

  it("a refused Save shows the API's field sentence under the field and keeps the form", async () => {
    api({
      "GET /api/me/company/accounts": () => json(accounts()),
      "GET /api/me/company/contacts": () => json(contacts()),
      "PATCH /api/me/company/accounts/a-rent": () =>
        json(
          {
            error: "Xero didn't accept that: Please enter a unique Code. Change it and try again.",
            fields: {
              code: "Xero didn't accept that: Please enter a unique Code. Change it and try again.",
            },
          },
          422,
        ),
    });
    show();
    await loaded();
    const user = userEvent.setup();
    await user.click(
      await card("Chart of accounts").findByRole("button", { name: "Edit 469 - Rent" }),
    );
    const dialog = within(screen.getByRole("group", { name: "Edit Rent" }));
    expect(dialog.getByText("Your change is made in Xero too.")).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Save" }));
    expect(
      await dialog.findByText(
        "Xero didn't accept that: Please enter a unique Code. Change it and try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Edit Rent" })).toBeInTheDocument();
  });

  it("delete asks first, saying the records keep it and Xero archives it", async () => {
    api({
      "GET /api/me/company/accounts": () => json(accounts()),
      "GET /api/me/company/contacts": () => json(contacts()),
      "DELETE /api/me/company/accounts/a-rent": () =>
        json({ archived: true, message: "Rent deleted." }),
    });
    show();
    await loaded();
    const user = userEvent.setup();
    await user.click(
      await card("Chart of accounts").findByRole("button", { name: "Delete 469 - Rent" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Delete Rent?" });
    expect(dialog).toHaveTextContent(
      "This can't be undone. Records that already use it keep it, but it leaves every list. It's archived in Xero too.",
    );
    await user.click(within(dialog).getByRole("button", { name: "Go back" }));
    expect(sent).toEqual([]);
    await user.click(card("Chart of accounts").getByRole("button", { name: "Delete 469 - Rent" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Rent deleted.")).toBeInTheDocument();
    expect(sent).toEqual([
      { method: "DELETE", path: "/api/me/company/accounts/a-rent", body: null },
    ]);
  });
});

describe("a contact", () => {
  it("is added, a name already there refused as it is typed", async () => {
    api({
      "GET /api/me/company/accounts": () => json(accounts()),
      "GET /api/me/company/contacts": () => json(contacts()),
      "POST /api/me/company/contacts": () => json({ contact: {}, message: "Nina Ng added." }, 201),
    });
    show();
    await loaded();
    const user = userEvent.setup();
    await user.click(await card("Contacts").findByRole("button", { name: /Add a contact/ }));
    const dialog = within(screen.getByRole("group", { name: "Add a contact" }));
    await user.type(dialog.getByLabelText(/Name/), "kee wah");
    expect(
      dialog.getByText(
        "Kee Wah is already in your contacts. Use that one, or choose another name.",
      ),
    ).toBeInTheDocument();
    await user.clear(dialog.getByLabelText(/Name/));
    await user.type(dialog.getByLabelText(/Name/), "Nina  Ng{Enter}");
    expect(await screen.findByText("Nina Ng added.")).toBeInTheDocument();
    expect(sent).toEqual([
      { method: "POST", path: "/api/me/company/contacts", body: { name: "Nina Ng" } },
    ]);
  });
});

describe("the add form opens inline (owner, 2026-11-12: no dialog)", () => {
  it("sits at the top of its card, above the search and the list; the button comes back on Cancel or Escape", async () => {
    api({
      "GET /api/me/company/accounts": () => json(accounts()),
      "GET /api/me/company/contacts": () => json(contacts()),
    });
    show();
    await loaded();
    const user = userEvent.setup();
    const chart = card("Chart of accounts");

    await user.click(chart.getByRole("button", { name: /Add an account/ }));
    const form = chart.getByRole("group", { name: "Add an account" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(chart.queryByRole("button", { name: /Add an account/ })).toBeNull();
    const search = chart.getByRole("searchbox", { name: /Search accounts/ });
    expect(form.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(chart.queryByRole("group", { name: "Add an account" })).toBeNull();
    await user.click(chart.getByRole("button", { name: /Add an account/ }));
    await user.keyboard("{Escape}"); // closes the picker's list first
    await user.keyboard("{Escape}");
    expect(chart.queryByRole("group", { name: "Add an account" })).toBeNull();
    expect(chart.getByRole("button", { name: /Add an account/ })).toBeInTheDocument();
  });
});
