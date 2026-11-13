// Matching a Minty company's accounts to Xero (Settings Phase 2, 2026-11-11; Figma 353:999 SET-1b,
// frames 3, 3b, 4, 5): the Integration card asks first for a company with its own accounts, shows
// "Matching isn't finished" while it is pending, and the matching page picks, refuses Finish while a
// used account has no match, confirms, brings the contacts over and names the ones Xero refused.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";

import type {
  IntegrationPage,
  MatchingPage,
} from "@/features/company-settings/api/companySettings";
import { IntegrationScreen } from "@/features/company-settings/routes/IntegrationScreen";
import { MATCH_COPY, MatchingScreen } from "@/features/company-settings/routes/MatchingScreen";

const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/entity/e1/olive-shop/settings/integration/match",
}));

const ID = "e1";
const COMPANY = { id: ID, name: "Olive Shop" };
const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Route = (url: URL, init: RequestInit) => Response;
function api(routes: Record<string, Route>) {
  fetchMock.mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input));
    const key = `${(init.method ?? "GET").toUpperCase()} ${url.pathname}`;
    const route = routes[key];
    if (!route) throw new Error(`unexpected ${key}`);
    return route(url, init);
  });
}

const MINTY: IntegrationPage = {
  company: { id: ID, name: "Olive Shop", country_code: "HK", currency_id: "c-hkd" },
  modules: ["PETTY_CASH"],
  countries: [],
  currencies: [],
  xero: {
    status: "disconnected",
    connected: false,
    needs_reconnect: false,
    organisation: null,
    last_connected_at: null,
  },
  can_edit: true,
  can_rename: true,
  setup_mode: "minty",
  own_accounts: 24,
  matching: { accounts: false, contacts: false },
  notices: [],
  xero_conflict: null,
};

function row(
  id: string,
  code: string,
  name: string,
  extra: Partial<MatchingPage["groups"][0]["rows"][0]> = {},
) {
  return {
    account_id: id,
    code,
    name,
    type: "expense",
    kind: "expense",
    used: false,
    system: false,
    pick: null,
    suggestion: null,
    conflict: null,
    combined_with: [],
    ...extra,
  };
}

function matchingPage(over: Partial<MatchingPage> = {}): MatchingPage {
  return {
    organisation: "Olive Ltd",
    groups: [
      {
        key: "running",
        title: "Running the business",
        rows: [
          row("a-rent", "469", "Rent", { pick: { xero_account_id: "x-rent", auto: true } }),
          row("a-wages", "6001", "Salaries - Full Time", { used: true, suggestion: "x-wages" }),
          row("a-lic", "6999", "Licences"),
        ],
      },
    ],
    options: [
      { id: "x-rent", code: "469", name: "Rent", kind: "expense" },
      { id: "x-wages", code: "477", name: "Wages and Salaries", kind: "expense" },
      { id: "x-bank", code: "090", name: "Petty Cash", kind: "bank" },
    ],
    matched: 1,
    total: 3,
    blocking: 1,
    will_archive: ["Licences"],
    will_combine: [],
    pending: { accounts: true, contacts: false },
    failed_contacts: [],
    ...over,
  };
}

const MATCHED = matchingPage({
  groups: [
    {
      key: "running",
      title: "Running the business",
      rows: [
        row("a-rent", "469", "Rent", { pick: { xero_account_id: "x-rent", auto: true } }),
        row("a-wages", "6001", "Salaries - Full Time", {
          used: true,
          pick: { xero_account_id: "x-wages", auto: false },
        }),
        row("a-lic", "6999", "Licences"),
      ],
    },
  ],
  matched: 2,
  blocking: 0,
});

function wrap(node: React.ReactNode) {
  render(<ToastProvider>{node}</ToastProvider>);
}

describe("Matching a Minty company's accounts to Xero", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", ID, "Olive Shop");
    fetchMock.mockReset();
    router.push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("SET-1b: a company with its own accounts is asked first, with the rows to match", async () => {
    api({ "GET /api/me/company/integration": () => json(MINTY) });
    wrap(<IntegrationScreen company={COMPANY} flash={null} xeroConflict={null} />);
    await userEvent.click(await screen.findByRole("button", { name: "Connect to Xero" }));
    const dialog = screen.getByRole("dialog", { name: "One step before we connect" });
    expect(within(dialog).getByText(/match them up - 24 rows/)).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Sign in to Xero" })).toHaveAttribute(
      "href",
      expect.stringContaining("xero_reconnect"),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("an unfinished match says so and offers Continue matching", async () => {
    api({
      "GET /api/me/company/integration": () =>
        json({ ...MINTY, matching: { accounts: true, contacts: false } }),
    });
    wrap(<IntegrationScreen company={COMPANY} flash={null} xeroConflict={null} />);
    expect(
      await screen.findByRole("heading", { name: "Matching isn't finished" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue matching" })).toHaveAttribute(
      "href",
      expect.stringContaining("/settings/integration/match"),
    );
    expect(screen.queryByRole("button", { name: "Connect to Xero" })).toBeNull();
  });

  it("frame 3/3b: picks save at once, Finish waits for the used accounts, the suggestion leads the list", async () => {
    const picks: unknown[] = [];
    api({
      "GET /api/me/company/xero/matching": () => json(matchingPage()),
      "PATCH /api/me/company/xero/matching": (_url, init) => {
        picks.push(JSON.parse(String(init.body)));
        return json(MATCHED);
      },
    });
    wrap(<MatchingScreen company={COMPANY} />);
    expect(await screen.findByText("1 of 3 matched")).toBeInTheDocument();
    expect(screen.getByText(MATCH_COPY.blocking(1))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish" })).toBeDisabled();
    expect(screen.getByText(MATCH_COPY.finishBlocked)).toBeInTheDocument();
    // the bank account is no option for an expense account
    const select = screen.getByRole("combobox", {
      name: /Xero account for 6001 Salaries - Full Time/,
    });
    expect(within(select).queryByRole("option", { name: /Petty Cash/ })).toBeNull();

    // the suggestion leads the dropdown, in its own group
    expect(within(select).getByRole("group", { name: MATCH_COPY.suggested })).toBeInTheDocument();
    await userEvent.selectOptions(select, "x-wages");
    await waitFor(() =>
      expect(picks).toEqual([{ account_id: "a-wages", xero_account_id: "x-wages" }]),
    );
    expect(await screen.findByText("2 of 3 matched")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
  });

  it("a long code runs with the name, and a code that repeats the name isn't shown twice", async () => {
    // Change your matches, 2026-11-13: Xero's codes (4000_01_01, a bank's name as its code) ran
    // out of the 44px code column into the name.
    api({
      "GET /api/me/company/xero/matching": () =>
        json(
          matchingPage({
            groups: [
              {
                key: "cash",
                title: "Cash & bank",
                rows: [row("a-pc", "Petty Cash", "Petty Cash", { kind: "bank", type: "bank" })],
              },
              {
                key: "sales",
                title: "Sales",
                rows: [row("a-cc", "4000_01_01", "Sales_Credit Card")],
              },
            ],
            options: [{ id: "x-pc", code: "Petty Cash", name: "Petty Cash", kind: "bank" }],
          }),
        ),
    });
    wrap(<MatchingScreen company={{ id: ID, name: "Olive Shop" }} />);
    const name = await screen.findByText("Sales_Credit Card");
    expect(name.closest("[data-account]")).toHaveTextContent("4000_01_01 Sales_Credit Card");
    expect(screen.getByText("Petty Cash", { selector: "[data-account]" }).textContent).toBe(
      "Petty Cash",
    );
    expect(screen.getByRole("option", { name: "Petty Cash" })).toBeInTheDocument();
  });

  it("the header's Back goes to Integration itself, not back through Xero's sign-in", async () => {
    api({ "GET /api/me/company/xero/matching": () => json(matchingPage()) });
    wrap(<MatchingScreen company={COMPANY} />);
    await screen.findByText("1 of 3 matched");
    const back = screen.getAllByRole("link", { name: /Back/ })[0];
    expect(back.getAttribute("href")).toMatch(/\/settings\/integration$/);
    expect(back).not.toHaveAttribute("data-back-link");
  });

  it("Finish asks first, then brings the contacts over and goes back connected", async () => {
    api({
      "GET /api/me/company/xero/matching": () => json(MATCHED),
      "POST /api/me/company/xero/matching/finish": () =>
        json({ ...MATCHED, pending: { accounts: false, contacts: false }, connected: true }),
    });
    wrap(<MatchingScreen company={COMPANY} />);
    await userEvent.click(await screen.findByRole("button", { name: "Finish" }));
    const confirm = screen.getByRole("dialog", { name: MATCH_COPY.confirmTitle });
    expect(within(confirm).getByText(/can't be undone/)).toBeInTheDocument();
    expect(within(confirm).getByText(/Licences/)).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole("button", { name: "Finish" }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(expect.stringContaining("/settings/integration")),
    );
  });

  it("frame 5: contacts Xero refused are named, with Try again", async () => {
    let tries = 0;
    api({
      "GET /api/me/company/xero/matching": () => json(MATCHED),
      "POST /api/me/company/xero/matching/finish": () =>
        json({
          ...MATCHED,
          pending: { accounts: false, contacts: true },
          connected: false,
          failed_contacts: ["Wing Lee Trading Co.", "Star Ferry Logistics"],
        }),
      "POST /api/me/company/xero/matching/contacts": () => {
        tries += 1;
        return json({ ...MATCHED, pending: { accounts: false, contacts: false }, connected: true });
      },
    });
    wrap(<MatchingScreen company={COMPANY} />);
    await userEvent.click(await screen.findByRole("button", { name: "Finish" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: MATCH_COPY.confirmTitle })).getByRole("button", {
        name: "Finish",
      }),
    );
    const failed = await screen.findByRole("dialog", { name: MATCH_COPY.failedTitle(2) });
    expect(within(failed).getByText("Star Ferry Logistics")).toBeInTheDocument();
    await userEvent.click(within(failed).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(tries).toBe(1));
    await waitFor(() => expect(router.push).toHaveBeenCalled());
  });
});

describe("Phase 3: a new organisation, new accounts, changing the matches (owner, 2026-11-12)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", ID, "Olive Shop");
    fetchMock.mockReset();
    router.push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  const CONNECTED: IntegrationPage = {
    ...MINTY,
    setup_mode: "xero",
    own_accounts: 0,
    xero: {
      status: "connected",
      connected: true,
      needs_reconnect: false,
      organisation: "Olive Ltd",
      last_connected_at: "2026-11-10T02:00:00Z",
    },
    matching: { accounts: false, contacts: false, reason: null },
  };

  it.each([
    ["new_org", "Your new Xero organisation needs your accounts matched."],
    [
      "new_accounts",
      "Some accounts were added while Xero was disconnected. Match them to finish reconnecting.",
    ],
  ] as const)("the card names why a %s matching is open", async (reason, line) => {
    api({
      "GET /api/me/company/integration": () =>
        json({ ...CONNECTED, matching: { accounts: true, contacts: false, reason } }),
    });
    wrap(<IntegrationScreen company={COMPANY} flash={null} xeroConflict={null} />);
    expect(
      await screen.findByRole("heading", { name: "Matching isn't finished" }),
    ).toBeInTheDocument();
    expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue matching" })).toBeInTheDocument();
  });

  it("a connected company can change its matches: it starts the change, then opens the page", async () => {
    const posted: string[] = [];
    api({
      "GET /api/me/company/integration": () => json(CONNECTED),
      "POST /api/me/company/xero/matching/change": (url) => {
        posted.push(url.pathname);
        return json(matchingPage({ reason: "change" }));
      },
    });
    wrap(<IntegrationScreen company={COMPANY} flash={null} xeroConflict={null} />);
    await userEvent.click(await screen.findByRole("button", { name: "Change matches" }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        expect.stringContaining("/settings/integration/match"),
      ),
    );
    expect(posted).toEqual(["/api/me/company/xero/matching/change"]);
  });

  it("a change in progress says so on the card, publishing going on meanwhile", async () => {
    api({
      "GET /api/me/company/integration": () =>
        json({ ...CONNECTED, matching: { accounts: true, contacts: false, reason: "change" } }),
    });
    wrap(<IntegrationScreen company={COMPANY} flash={null} xeroConflict={null} />);
    expect(
      await screen.findByRole("heading", { name: "Changing your matches" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue changing" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change matches" })).toBeNull();
  });

  it("the page in change mode: its own heading, Cancel, and Finish says only what is published from now on", async () => {
    const posted: string[] = [];
    api({
      "GET /api/me/company/xero/matching": () => json({ ...MATCHED, reason: "change" }),
      "POST /api/me/company/xero/matching/cancel": (url) => {
        posted.push(url.pathname);
        return json({ ...MATCHED, reason: null, pending: { accounts: false, contacts: false } });
      },
    });
    wrap(<MatchingScreen company={COMPANY} />);
    expect(
      await screen.findByRole("heading", { name: MATCH_COPY.changeTitle }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Finish" }));
    const confirm = screen.getByRole("dialog", { name: MATCH_COPY.confirmTitle });
    expect(within(confirm).getByText(MATCH_COPY.confirmChange)).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole("button", { name: "Go back" }));

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(posted).toEqual(["/api/me/company/xero/matching/cancel"]));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(expect.stringContaining("/settings/integration")),
    );
  });

  it("the page for a new organisation says older records stay with the old one", async () => {
    api({ "GET /api/me/company/xero/matching": () => json({ ...MATCHED, reason: "new_org" }) });
    wrap(<MatchingScreen company={COMPANY} />);
    expect(
      await screen.findByRole("heading", { name: MATCH_COPY.newOrgTitle }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Finish" }));
    const confirm = screen.getByRole("dialog", { name: MATCH_COPY.confirmTitle });
    expect(within(confirm).getByText(MATCH_COPY.confirmNewOrg("Olive Ltd"))).toBeInTheDocument();
  });
});
