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

  it("frame 3/3b: picks save at once, Finish waits for the used accounts, a suggestion is one tap", async () => {
    const picks: unknown[] = [];
    api({
      "GET /api/me/company/xero/matching": () => json(matchingPage()),
      "PUT /api/me/company/xero/matching": (_url, init) => {
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

    await userEvent.click(screen.getByRole("button", { name: MATCH_COPY.use }));
    await waitFor(() =>
      expect(picks).toEqual([{ account_id: "a-wages", xero_account_id: "x-wages" }]),
    );
    expect(await screen.findByText("2 of 3 matched")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
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
