// A company's Users and Entity & Integration tabs as a person sees them (phase 2): what each
// row offers, the invite form, the confirmations, Flask's sentences, and the Xero card. Flask is
// answered per path and method; every call must name the company with ?entity=.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import type { IntegrationPage, UsersPage } from "@/features/company-settings/api/companySettings";
import { IntegrationScreen } from "@/features/company-settings/routes/IntegrationScreen";
import { UsersScreen } from "@/features/company-settings/routes/UsersScreen";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/entities/e1/olive-shop/settings/users" }));

const ID = "e1";
const COMPANY = { id: ID, name: "Olive Shop" };
const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Route = (url: URL, init: RequestInit) => Response;
function flask(routes: Record<string, Route>) {
  fetchMock.mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input));
    expect(url.searchParams.get("entity")).toBe(ID);
    const key = `${(init.method ?? "GET").toUpperCase()} ${url.pathname}`;
    const route = routes[key];
    if (!route) throw new Error(`unexpected ${key}`);
    return route(url, init);
  });
}
const sent = (key: string) =>
  fetchMock.mock.calls
    .filter(([input, init]) => `${((init as RequestInit)?.method ?? "GET").toUpperCase()} ${new URL(String(input)).pathname}` === key)
    .map(([, init]) => JSON.parse(String((init as RequestInit).body ?? "null")));

const MEMBERS: UsersPage["members"] = [
  { id: "u1", first_name: "Ada", last_name: "Admin", email: "ada@test.com", initials: "AA", role: "admin", role_label: "Admin", subscriber: true, is_you: true, can_change_role: true, can_remove: true },
  { id: "u2", first_name: "Cas", last_name: "O'Brien", email: "cas@test.com", initials: "CO", role: "cashier", role_label: "Cashier", subscriber: false, is_you: false, can_change_role: true, can_remove: true },
  { id: "u3", first_name: "Boss", last_name: "Person", email: "boss@test.com", initials: "BP", role: "admin", role_label: "Admin", subscriber: false, is_you: false, can_change_role: false, can_remove: false },
];
const USERS: UsersPage = {
  company: COMPANY,
  modules: ["PETTY_CASH"],
  members: MEMBERS,
  invitations: [
    { id: "i1", email: "<svg/onload=alert(1)>@x.co", first_name: "", last_name: "", role: "cashier", role_label: "Cashier", created_at: null, resend_cooldown: 0, can_manage: true },
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

  it("lists the members with what this person may do to each, and the pill row", async () => {
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
    expect(tabs.queryByText("Payment Request Settings")).toBeNull(); // the company has no Payment Request
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

    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Role of Cas O'Brien" }), "accountant");

    expect(await screen.findByText("Role saved.")).toBeInTheDocument();
    expect(sent("PATCH /api/me/company/users/u2")).toEqual([{ role: "accountant" }]);
    await waitFor(() => expect(sent("GET /api/me/company/users")).toHaveLength(2));
  });

  it("removing asks first; on Flask's refusal its sentence is shown and the dialog closes", async () => {
    flask({
      "GET /api/me/company/users": () => json(USERS),
      "DELETE /api/me/company/users/u2": () => json({ error: "I can't remove the person who pays for this company." }, 409),
    });
    showUsers();

    await userEvent.click(await screen.findByRole("button", { name: "Remove Cas O'Brien" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("heading", { name: "Remove Cas O'Brien?" })).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Remove" }));

    expect(await screen.findByText("I can't remove the person who pays for this company.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("invites with the address, the role and both names - Send waits for them; Enter sends", async () => {
    flask({
      "GET /api/me/company/users": () => json(USERS),
      "POST /api/me/company/invitations": () => json({ invitation_id: "i2", email_sent: true, message: "Invitation sent." }, 201),
    });
    showUsers();

    await userEvent.click(await screen.findByRole("button", { name: "Invite" }));
    const dialog = within(screen.getByRole("dialog"));
    await userEvent.selectOptions(dialog.getByLabelText("Role"), "shop_manager");
    await userEvent.type(dialog.getByLabelText("Email"), "new@test.com");
    await userEvent.type(dialog.getByLabelText("First name"), "New");
    // no last name yet: nothing can be sent
    expect(dialog.getByRole("button", { name: "Send invitation" })).toBeDisabled();
    await userEvent.type(dialog.getByLabelText("Last name"), "Person{Enter}");

    expect(await screen.findByText("Invitation sent.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(sent("POST /api/me/company/invitations")).toEqual([
      { email: "new@test.com", role: "shop_manager", first_name: "New", last_name: "Person" },
    ]);
  });

  it("a resend still cooling down counts down what Flask said", async () => {
    flask({
      "GET /api/me/company/users": () => json(USERS),
      "POST /api/me/company/invitations/i1/resend": () => json({ error: "Please wait a moment.", retry_after: 42 }, 429),
    });
    showUsers();

    await userEvent.click(await screen.findByRole("button", { name: "Resend" }));

    expect(await screen.findByText("Please wait a moment.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend in 4[12]s/ })).toBeDisabled();
  });

  it("shows what Flask flashed on the way here, once", async () => {
    flask({ "GET /api/me/company/users": (url) => json({ ...USERS, notices: url.searchParams.get("flash") ? [{ category: "success", message: "Invitation accepted." }] : [] }) });
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
  xero: { status: "connected", connected: true, needs_reconnect: false, organisation: "Olive Shop Ltd", last_connected_at: "2026-09-01T02:00:00Z" },
  can_edit: true,
  can_rename: true,
  notices: [],
};

function showIntegration() {
  render(
    <ToastProvider>
      <IntegrationScreen company={COMPANY} flash={null} />
    </ToastProvider>,
  );
}

describe("IntegrationScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", ID, "Olive Shop");
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("saves only what changed; a refusal stays under the form", async () => {
    flask({
      "GET /api/me/company/integration": () => json(INTEGRATION),
      "PATCH /api/me/company/integration": (_u, init) =>
        JSON.parse(String(init.body)).name === "Other Co"
          ? json({ error: "Oh, someone got there first! Do you have another name in mind?" }, 422)
          : json({ ...INTEGRATION, company: { ...INTEGRATION.company, country_code: "SG" }, message: "Settings saved!" }),
    });
    showIntegration();

    const save = await screen.findByRole("button", { name: "Save Changes" });
    expect(save).toBeDisabled(); // nothing changed yet
    await userEvent.selectOptions(screen.getByLabelText("Country"), "SG");
    await userEvent.click(save);
    expect(await screen.findByText("Settings saved!")).toBeInTheDocument();
    expect(sent("PATCH /api/me/company/integration")).toEqual([{ country_code: "SG" }]);

    const name = screen.getByLabelText("Company name");
    await userEvent.clear(name);
    await userEvent.type(name, "Other Co{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("someone got there first");
  });

  it("read-only: says so, and offers nothing to change", async () => {
    flask({ "GET /api/me/company/integration": () => json({ ...INTEGRATION, can_edit: false, can_rename: false }) });
    showIntegration();

    expect(await screen.findByText(/view-only access/)).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save Changes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Disconnect" })).toBeNull();
  });

  it("the Xero card: connected, disconnect asks first and shows the new state", async () => {
    flask({
      "GET /api/me/company/integration": () => json(INTEGRATION),
      "POST /api/me/company/xero/disconnect": () =>
        json({ ...INTEGRATION, xero: { ...INTEGRATION.xero, status: "disconnected", connected: false, organisation: null }, message: "You're disconnected from Xero." }),
    });
    showIntegration();

    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Olive Shop Ltd")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Disconnect" }));

    expect(await screen.findByText("You're disconnected from Xero.")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connect to Xero" })).toHaveAttribute(
      "href",
      expect.stringContaining(`${env.PETTY_CASH_URL}/entity/${ID}/enter?token=`),
    );
    expect(screen.getByRole("link", { name: "Connect to Xero" }).getAttribute("href")).toContain(
      encodeURIComponent(`/xero_reconnect?entity_id=${ID}`),
    );
  });

  it("a connection revoked at Xero asks for a reconnect", async () => {
    flask({ "GET /api/me/company/integration": () => json({ ...INTEGRATION, xero: { ...INTEGRATION.xero, needs_reconnect: true, connected: false } }) });
    showIntegration();

    expect(await screen.findByText("Reconnect needed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reconnect to Xero" })).toBeInTheDocument();
  });
});
