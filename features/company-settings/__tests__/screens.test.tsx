// A company's Users, General and Integration tabs as a person sees them (Figma 353:999, owner
// 2026-11-10): what each row offers, the invite form, the confirmations, the API's sentences, the
// name/country/currency form and the Xero card. The accounts API is answered per path and method;
// every call must name the company with ?entity=.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DISCARD_CHANGES, GO_BACK_UPPER, LEAVE_TITLE } from "@/components/ui/LeaveDialog";
import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import type { IntegrationPage, UsersPage } from "@/features/company-settings/api/companySettings";
import {
  SETTINGS_DANGER,
  SETTINGS_OUTLINE,
  SETTINGS_PRIMARY,
} from "@/components/ui/settingsButtons";
import { GeneralScreen } from "@/features/company-settings/routes/GeneralScreen";
import { IntegrationScreen } from "@/features/company-settings/routes/IntegrationScreen";
import { UsersScreen } from "@/features/company-settings/routes/UsersScreen";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/entity/e1/olive-shop/settings/users",
}));

const ID = "e1";
const COMPANY = { id: ID, name: "Olive Shop" };
const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Route = (url: URL, init: RequestInit) => Response;
/** General also reads the chart of accounts and contacts (merged in 2026-11-12): empty lists here;
 * their own tests are chart.test.tsx. */
const NONE = { add: false, edit: false, delete: false };
const CHART: Record<string, Route> = {
  "GET /api/me/company/accounts": () =>
    json({
      accounts: [],
      types: [],
      next_codes: {},
      xero_live: false,
      permissions: NONE,
      minty_accounts: [],
    }),
  "GET /api/me/company/contacts": () => json({ contacts: [], xero_live: false, permissions: NONE }),
};

function flask(routes: Record<string, Route>) {
  fetchMock.mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input));
    expect(url.searchParams.get("entity")).toBe(ID);
    const key = `${(init.method ?? "GET").toUpperCase()} ${url.pathname}`;
    const route = { ...CHART, ...routes }[key];
    if (!route) throw new Error(`unexpected ${key}`);
    return route(url, init);
  });
}
const sent = (key: string) =>
  fetchMock.mock.calls
    .filter(
      ([input, init]) =>
        `${((init as RequestInit)?.method ?? "GET").toUpperCase()} ${new URL(String(input)).pathname}` ===
        key,
    )
    .map(([, init]) => JSON.parse(String((init as RequestInit).body ?? "null")));

const MEMBERS: UsersPage["members"] = [
  {
    id: "u1",
    first_name: "Ada",
    last_name: "Admin",
    email: "ada@test.com",
    initials: "AA",
    role: "admin",
    role_label: "Admin",
    subscriber: true,
    is_you: true,
    can_change_role: true,
    can_remove: true,
  },
  {
    id: "u2",
    first_name: "Cas",
    last_name: "O'Brien",
    email: "cas@test.com",
    initials: "CO",
    role: "cashier",
    role_label: "Cashier",
    subscriber: false,
    is_you: false,
    can_change_role: true,
    can_remove: true,
  },
  {
    id: "u3",
    first_name: "Boss",
    last_name: "Person",
    email: "boss@test.com",
    initials: "BP",
    role: "admin",
    role_label: "Admin",
    subscriber: false,
    is_you: false,
    can_change_role: false,
    can_remove: false,
  },
];
const USERS: UsersPage = {
  company: COMPANY,
  modules: ["PETTY_CASH"],
  members: MEMBERS,
  invitations: [
    {
      id: "i1",
      email: "<svg/onload=alert(1)>@x.co",
      first_name: "",
      last_name: "",
      role: "cashier",
      role_label: "Cashier",
      created_at: null,
      resend_cooldown: 0,
      can_manage: true,
    },
  ],
  roles: [
    { value: "admin", label: "Admin" },
    { value: "accountant", label: "Accountant" },
    { value: "shop_manager", label: "Shop Manager" },
    { value: "cashier", label: "Cashier" },
  ],
  can_invite: true,
  notices: [],
};

function showUsers(flash: string | null = null) {
  render(
    <ToastProvider>
      <UsersScreen company={COMPANY} flash={flash} />
    </ToastProvider>,
  );
}

describe("UsersScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", ID, "Olive Shop");
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lists the members with what this person may do to each, and the tab row", async () => {
    flask({ "GET /api/me/company/users": () => json(USERS) });
    showUsers();

    const members = within(await screen.findByRole("list", { name: "Members" }));
    expect(members.getByText("Subscriber")).toBeInTheDocument();
    expect(members.getByText("You")).toBeInTheDocument();
    // an apostrophe is just text (the Jinja roster's onclick broke on it)
    expect(members.getByText("Cas O'Brien")).toBeInTheDocument();
    expect(members.getByRole("combobox", { name: "Role of Cas O'Brien" })).toHaveValue("cashier");
    expect(members.queryByRole("combobox", { name: "Role of Boss Person" })).toBeNull();
    expect(members.queryByRole("button", { name: "Remove Boss Person" })).toBeNull();
    const tabs = within(screen.getByRole("navigation", { name: "Settings sections" }));
    expect(tabs.getByText("Users")).toHaveAttribute("aria-current", "page");
    expect(tabs.queryByText("Payment Settings")).toBeNull(); // the company has no Payment Request
  });

  it("draws an invitation's address as text, never markup", async () => {
    flask({ "GET /api/me/company/users": () => json(USERS) });
    showUsers();

    const pending = within(await screen.findByRole("list", { name: "Pending invitations" }));
    expect(pending.getByText("<svg/onload=alert(1)>@x.co")).toBeInTheDocument();
    expect(document.querySelector("svg[onload]")).toBeNull();
  });

  it("changes a role, then reads the page again", async () => {
    flask({
      "GET /api/me/company/users": () => json(USERS),
      "PATCH /api/me/company/users/u2": () => json({ message: "Role saved.", role: "accountant" }),
    });
    showUsers();

    await userEvent.selectOptions(
      await screen.findByRole("combobox", { name: "Role of Cas O'Brien" }),
      "accountant",
    );

    expect(await screen.findByText("Role saved.")).toBeInTheDocument();
    expect(sent("PATCH /api/me/company/users/u2")).toEqual([{ role: "accountant" }]);
    await waitFor(() => expect(sent("GET /api/me/company/users")).toHaveLength(2));
  });

  it("removing asks first; on Flask's refusal its sentence is shown and the dialog closes", async () => {
    flask({
      "GET /api/me/company/users": () => json(USERS),
      "DELETE /api/me/company/users/u2": () =>
        json({ error: "I can't remove the person who pays for this company." }, 409),
    });
    showUsers();

    await userEvent.click(await screen.findByRole("button", { name: "Remove Cas O'Brien" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("heading", { name: "Remove Cas O'Brien?" })).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Remove" }));

    expect(
      await screen.findByText("I can't remove the person who pays for this company."),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("invites with the address, the role and both names - Send waits for them; Enter sends", async () => {
    flask({
      "GET /api/me/company/users": () => json(USERS),
      "POST /api/me/company/invitations": () =>
        json({ invitation_id: "i2", email_sent: true, message: "Invitation sent." }, 201),
    });
    showUsers();

    await userEvent.click(await screen.findByRole("button", { name: "Invite" }));
    const dialog = within(screen.getByRole("dialog"));
    await userEvent.selectOptions(dialog.getByLabelText(/^Role\s*\*?$/), "shop_manager");
    await userEvent.type(dialog.getByLabelText(/^Email\s*\*?$/), "new@test.com");
    await userEvent.type(dialog.getByLabelText(/^First name\s*\*?$/), "New");
    // no last name yet: nothing can be sent
    expect(dialog.getByRole("button", { name: "Send invitation" })).toBeDisabled();
    await userEvent.type(dialog.getByLabelText(/^Last name\s*\*?$/), "Person{Enter}");

    expect(await screen.findByText("Invitation sent.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sent("POST /api/me/company/invitations")).toEqual([
      { email: "new@test.com", role: "shop_manager", first_name: "New", last_name: "Person" },
    ]);
  });

  it("Invite and Send invitation are the page's one main button", async () => {
    flask({ "GET /api/me/company/users": () => json(USERS) });
    showUsers();

    const invite = await screen.findByRole("button", { name: "Invite" });
    expect(invite.className).toContain(SETTINGS_PRIMARY);
    await userEvent.click(invite);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("button", { name: "Send invitation" }).className).toContain(
      SETTINGS_PRIMARY,
    );
    expect(dialog.getByRole("button", { name: "Cancel" }).className).toContain(SETTINGS_OUTLINE);
  });

  it("a resend still cooling down counts down what Flask said", async () => {
    flask({
      "GET /api/me/company/users": () => json(USERS),
      "POST /api/me/company/invitations/i1/resend": () =>
        json({ error: "Please wait a moment.", retry_after: 42 }, 429),
    });
    showUsers();

    await userEvent.click(await screen.findByRole("button", { name: "Resend" }));

    expect(await screen.findByText("Please wait a moment.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend in 4[12]s/ })).toBeDisabled();
  });

  it("shows what Flask flashed on the way here, once", async () => {
    flask({
      "GET /api/me/company/users": (url) =>
        json({
          ...USERS,
          notices: url.searchParams.get("flash")
            ? [{ category: "success", message: "Invitation accepted." }]
            : [],
        }),
    });
    showUsers("signed");
    expect(await screen.findByText("Invitation accepted.")).toBeInTheDocument();
  });
});

const INTEGRATION: IntegrationPage = {
  company: { id: ID, name: "Olive Shop", country_code: "HK", currency_id: "c-hkd" },
  modules: ["PETTY_CASH", "PAYMENT_REQUEST"],
  countries: [
    { code: "HK", name: "Hong Kong" },
    { code: "SG", name: "Singapore" },
  ],
  currencies: [
    { id: "c-hkd", name: "Hong Kong Dollar" },
    { id: "c-sgd", name: "Singapore Dollar" },
  ],
  xero: {
    status: "connected",
    connected: true,
    needs_reconnect: false,
    organisation: "Olive Shop Ltd",
    last_connected_at: "2026-09-01T02:00:00Z",
  },
  can_edit: true,
  can_rename: true,
  notices: [],
  xero_conflict: null,
};

/**
 * jsdom will not follow a link, so the test does the following: a BUBBLE listener, which the
 * guard's capture-phase one runs before, recording where the click would have gone. Returns the
 * list - empty while the guard is holding the page.
 */
function navigationRecorder(): string[] {
  const went: string[] = [];
  const onClick = (event: MouseEvent) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (anchor instanceof HTMLAnchorElement) {
      event.preventDefault();
      went.push(anchor.getAttribute("href") ?? "");
    }
  };
  window.addEventListener("click", onClick);
  recorders.push(() => window.removeEventListener("click", onClick));
  return went;
}
const recorders: (() => void)[] = [];

function showGeneral() {
  render(
    <ToastProvider>
      <GeneralScreen company={COMPANY} />
    </ToastProvider>,
  );
}

function showIntegration(xeroConflict: string | null = null) {
  render(
    <ToastProvider>
      <IntegrationScreen company={COMPANY} flash={null} xeroConflict={xeroConflict} />
    </ToastProvider>,
  );
}

const NEVER: IntegrationPage["xero"] = {
  status: "disconnected",
  connected: false,
  needs_reconnect: false,
  organisation: null,
  last_connected_at: null,
};

describe("the settings chrome", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", ID, "Olive Shop");
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("the company, the Settings heading and the six tabs, the open one current", async () => {
    flask({ "GET /api/me/company/integration": () => json(INTEGRATION) });
    showGeneral();

    expect(await screen.findByRole("heading", { level: 2, name: "Settings" })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: "Settings sections" });
    expect(nav.querySelectorAll("a, span[aria-current]").length).toBe(6);
    expect([...nav.querySelectorAll("a, span[aria-current]")].map((t) => t.textContent)).toEqual([
      "Users",
      "General",
      "Integration",
      "Petty Cash Settings",
      "Payment Settings",
      "Module & Subscription",
    ]);
    const tabs = within(nav);
    expect(tabs.getByText("General")).toHaveAttribute("aria-current", "page");
    expect(tabs.getByRole("link", { name: "Payment Settings" })).toHaveAttribute(
      "href",
      "/entity/e1/olive-shop/settings/payment",
    );
  });
});

describe("GeneralScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", ID, "Olive Shop");
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    while (recorders.length) recorders.pop()?.();
  });

  it("SET-G: the Entity name card, and Save changes waits for a change", async () => {
    flask({ "GET /api/me/company/integration": () => json(INTEGRATION) });
    showGeneral();

    const name = await screen.findByRole("textbox", { name: /^Entity name/ });
    expect(name).toHaveValue("Olive Shop");
    expect(screen.getByText("The name people see for this company")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();
    expect(save.className).toContain(SETTINGS_PRIMARY);
    expect(screen.getByText("No changes to save yet")).toBeInTheDocument();

    await userEvent.type(name, "s");
    expect(save).toBeEnabled();
    expect(screen.queryByText("No changes to save yet")).toBeNull();
  });

  it("saves only what changed; a refusal stays under the form", async () => {
    flask({
      "GET /api/me/company/integration": () => json(INTEGRATION),
      "PATCH /api/me/company/integration": (_u, init) =>
        JSON.parse(String(init.body)).name === "Other Co"
          ? json({ error: "Oh, someone got there first! Do you have another name in mind?" }, 422)
          : json({
              ...INTEGRATION,
              company: { ...INTEGRATION.company, country_code: "SG" },
              message: "Settings saved!",
            }),
    });
    showGeneral();

    const save = await screen.findByRole("button", { name: "Save changes" });
    await userEvent.selectOptions(screen.getByLabelText(/^Country\s*\*?$/), "SG");
    await userEvent.click(save);
    expect(await screen.findByText("Settings saved!")).toBeInTheDocument();
    expect(sent("PATCH /api/me/company/integration")).toEqual([{ country_code: "SG" }]);

    const name = screen.getByRole("textbox", { name: /^Entity name/ });
    await userEvent.clear(name);
    await userEvent.type(name, "Other Co{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("someone got there first");
  });

  it("an emptied name is never sent: it says so under the field until one is typed", async () => {
    flask({ "GET /api/me/company/integration": () => json(INTEGRATION) });
    showGeneral();
    const missing = "The company name is still empty. Add the company name to continue.";

    const name = await screen.findByRole("textbox", { name: /^Entity name/ });
    await userEvent.clear(name);
    expect(screen.queryByText(missing)).toBeNull(); // not while the field is still being edited
    await userEvent.tab(); // left empty
    expect(screen.getByText(missing)).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");

    await userEvent.type(name, "O");
    expect(screen.queryByText(missing)).toBeNull(); // clears as they type
    await userEvent.clear(name);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByText(missing)).toBeInTheDocument();
    await userEvent.type(name, "   {Enter}");
    expect(screen.getByText(missing)).toBeInTheDocument();
    expect(sent("PATCH /api/me/company/integration")).toEqual([]);
  });

  it("read-only: says so, and offers nothing to change", async () => {
    flask({
      "GET /api/me/company/integration": () =>
        json({ ...INTEGRATION, can_edit: false, can_rename: false }),
    });
    showGeneral();

    expect(await screen.findByText(/view-only access/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Country\s*\*?$/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
  });

  // The guard itself is lib/__tests__/leaveGuard.test.tsx; these are this page's exits.
  it("leaving with changes asks first: Go Back stays, Discard changes puts the saved value back and goes", async () => {
    flask({ "GET /api/me/company/integration": () => json(INTEGRATION) });
    const went = navigationRecorder();
    showGeneral();

    const country = await screen.findByLabelText(/^Country\s*\*?$/);
    await userEvent.selectOptions(country, "SG");

    // The Users tab is a plain anchor - the guard catches it before the browser follows it.
    await userEvent.click(screen.getByRole("link", { name: "Users" }));
    const asked = screen.getByRole("dialog");
    expect(asked).toHaveAccessibleName(LEAVE_TITLE);
    expect(within(asked).getByText("You have unsaved changes.")).toBeInTheDocument();
    expect(
      within(asked).getByText("Your changes will be lost if you leave this page."),
    ).toBeInTheDocument();
    expect(went).toEqual([]);

    await userEvent.click(within(asked).getByRole("button", { name: GO_BACK_UPPER }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(went).toEqual([]);
    expect(country).toHaveValue("SG"); // still being edited

    await userEvent.click(screen.getByRole("link", { name: "Users" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: DISCARD_CHANGES }),
    );
    expect(country).toHaveValue("HK"); // the saved value back
    expect(went).toEqual([expect.stringContaining("/settings/users")]);
  });

  it("after a save nothing is asked", async () => {
    flask({
      "GET /api/me/company/integration": () => json(INTEGRATION),
      "PATCH /api/me/company/integration": () =>
        json({
          ...INTEGRATION,
          company: { ...INTEGRATION.company, country_code: "SG" },
          message: "Settings saved!",
        }),
    });
    const went = navigationRecorder();
    showGeneral();

    await userEvent.selectOptions(await screen.findByLabelText(/^Country\s*\*?$/), "SG");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Settings saved!")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Integration" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(went).toEqual([expect.stringContaining("/settings/integration")]);
  });

  it("a viewer who may change nothing is never asked", async () => {
    flask({
      "GET /api/me/company/integration": () =>
        json({ ...INTEGRATION, can_edit: false, can_rename: false }),
    });
    const went = navigationRecorder();
    showGeneral();

    await screen.findByText(/view-only access/);
    await userEvent.click(screen.getByRole("link", { name: "Users" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(went).toEqual([expect.stringContaining("/settings/users")]);
  });
});

describe("IntegrationScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", ID, "Olive Shop");
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("SET-2: connected - where it publishes, when, and Disconnect from Xero asks first (SET-2b)", async () => {
    flask({
      "GET /api/me/company/integration": () => json(INTEGRATION),
      "POST /api/me/company/xero/disconnect": () =>
        json({
          ...INTEGRATION,
          xero: {
            ...INTEGRATION.xero,
            status: "disconnected",
            connected: false,
            // a disconnect keeps the organisation (Xero optional, 2026-11-10)
            needs_reconnect: true,
          },
          message: "You're disconnected from Xero.",
        }),
    });
    showIntegration();

    expect(await screen.findByRole("heading", { name: "Connected to Xero" })).toBeInTheDocument();
    expect(
      screen.getByText("Reports and petty cash publish to Olive Shop Ltd in Xero."),
    ).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("01 Sep 2026")).toBeInTheDocument(); // 02:00Z is 10:00 in Hong Kong
    expect(screen.queryByText(/Prefer some help first/)).toBeNull();
    const disconnect = screen.getByRole("button", { name: "Disconnect from Xero" });
    expect(disconnect.className).toContain(SETTINGS_DANGER);

    await userEvent.click(disconnect);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Disconnect from Xero?");
    expect(dialog).toHaveTextContent(
      "Minty carries on as normal — reports, petty cash, all of it. They just stop publishing to Xero. Your account matches are kept, so reconnecting later is quicker.",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(sent("POST /api/me/company/xero/disconnect")).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Disconnect from Xero" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }),
    );

    // Disconnected, but it was connected once: the organisation and the date stay, the way back is
    // a Reconnect, and there is nothing left to disconnect.
    expect(await screen.findByText("You're disconnected from Xero.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Disconnected from Xero" })).toBeInTheDocument();
    expect(screen.getByText("Olive Shop Ltd")).toBeInTheDocument();
    expect(screen.getByText("01 Sep 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disconnect from Xero" })).toBeNull();
    const reconnect = screen.getByRole("link", { name: "Reconnect to Xero" });
    expect(reconnect).toHaveAttribute(
      "href",
      expect.stringContaining(`${env.ACCOUNTS_API_URL}/entity/${ID}/enter?next=`),
    );
    expect(reconnect.getAttribute("href")).toContain(
      encodeURIComponent(`/xero_reconnect?entity_id=${ID}`),
    );
  });

  it("SET-1: never connected - Never, None yet, Connect to Xero and the help line", async () => {
    flask({ "GET /api/me/company/integration": () => json({ ...INTEGRATION, xero: NEVER }) });
    showIntegration();

    expect(
      await screen.findByRole("heading", { name: "Not connected to Xero" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Reports stay in Minty until you connect.")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByText("Never")).toBeInTheDocument();
    expect(screen.getByText("None yet")).toBeInTheDocument();
    const connect = screen.getByRole("link", { name: "Connect to Xero" });
    expect(connect.className).toContain(SETTINGS_PRIMARY);
    expect(
      screen.getByText(
        "Prefer some help first? Our service team can set up the Xero connection with you.",
      ),
    ).toBeInTheDocument();
  });

  it("a connection Xero stopped accepting asks for a reconnect, and can still be disconnected", async () => {
    flask({
      "GET /api/me/company/integration": () =>
        json({
          ...INTEGRATION,
          xero: { ...INTEGRATION.xero, needs_reconnect: true, connected: false },
        }),
    });
    showIntegration();

    expect(await screen.findByText("Reconnect needed")).toBeInTheDocument();
    expect(
      screen.getByText("Nothing is published to Olive Shop Ltd until you reconnect."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reconnect to Xero" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect from Xero" })).toBeInTheDocument();
  });

  it("read-only: the card, and nothing to press", async () => {
    flask({
      "GET /api/me/company/integration": () =>
        json({ ...INTEGRATION, can_edit: false, can_rename: false }),
    });
    showIntegration();

    expect(await screen.findByText(/view-only access/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Connected to Xero" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disconnect from Xero" })).toBeNull();
  });

  // A refused Connect: the organisation the person picked on Xero is in use elsewhere. The
  // accounts API signs the holder into the address, the tab reads it once and offers the move.
  // Before 2026-10-09 this case connected anyway and silently unlinked the other company.
  const HELD = {
    entity_id: "e2",
    entity_name: "Vine Cafe",
    organisation: "Vine Cafe Ltd",
    can_move: true,
  };
  const REFUSED = {
    ...INTEGRATION,
    xero: { ...INTEGRATION.xero, status: "disconnected", connected: false, organisation: null },
  };

  it("a refused connect says which company holds the organisation, and moves it on asking", async () => {
    flask({
      "GET /api/me/company/integration": (url) =>
        json({
          ...REFUSED,
          notices: [
            {
              category: "error",
              message: 'This Xero organisation is already connected to "Vine Cafe".',
            },
          ],
          xero_conflict: url.searchParams.get("xero_conflict") ? HELD : null,
        }),
      "POST /api/me/company/xero/release": () =>
        json({ message: '"Vine Cafe" is disconnected from Xero.' }),
    });
    showIntegration("signed-conflict");

    // The message AND a dialog that can do something about it - not a toast on its own.
    expect(await screen.findByText(/already connected to "Vine Cafe"/)).toBeInTheDocument();
    const dialog = within(await screen.findByRole("dialog"));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("That Xero organisation is taken");
    expect(dialog.getByText("Vine Cafe Ltd")).toBeInTheDocument();

    await userEvent.click(dialog.getByRole("button", { name: "Move it here" }));

    // The company freed is the OTHER one, named in the body - never the one being viewed.
    await waitFor(() =>
      expect(sent("POST /api/me/company/xero/release")).toEqual([{ entity_id: "e2" }]),
    );
  });

  it("the move's refusal stays in the dialog, so it can be tried again", async () => {
    flask({
      "GET /api/me/company/integration": (url) =>
        json({ ...REFUSED, xero_conflict: url.searchParams.get("xero_conflict") ? HELD : null }),
      "POST /api/me/company/xero/release": () =>
        json({ error: 'I couldn\'t disconnect "Vine Cafe" from Xero.' }, 502),
    });
    showIntegration("signed-conflict");

    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Move it here" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent(/couldn't disconnect "Vine Cafe"/);
    // Still open, and still offering the move: a navigation would have outrun a toast.
    expect(dialog.getByRole("button", { name: "Move it here" })).toBeEnabled();
  });

  it("no move offered (no permission there, or not development): disconnect it there first", async () => {
    flask({
      "GET /api/me/company/integration": (url) =>
        json({
          ...REFUSED,
          xero_conflict: url.searchParams.get("xero_conflict")
            ? { ...HELD, can_move: false }
            : null,
        }),
    });
    showIntegration("signed-conflict");

    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText(/Disconnect it from Vine Cafe first/)).toBeInTheDocument();
    expect(dialog.queryByRole("button", { name: "Move it here" })).toBeNull();

    await userEvent.click(dialog.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("without the hand-over there is no dialog", async () => {
    flask({
      "GET /api/me/company/integration": (url) =>
        json({ ...REFUSED, xero_conflict: url.searchParams.get("xero_conflict") ? HELD : null }),
    });
    showIntegration();

    await screen.findByRole("link", { name: "Reconnect to Xero" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
