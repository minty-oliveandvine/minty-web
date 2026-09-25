// One billing account's page over a stubbed fetch: which account (asked for, the one a company is
// on, else the oldest), its two reads (and what survives the second failing), Show more, the card
// menu's three items, the card the ACCOUNT charges switched, its own card refused removal (08-R)
// and another one removed, the card that just arrived on it (08-N → 08-S), a payer with no
// account at all (and the sheet that opens one), and where Add / Edit / Change billing details /
// Back go.

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";

import {
  ACCOUNTS,
  ACCOUNTS_NONE,
  ACCOUNTS_OPENED,
  ADDED_CARD,
  BREAKDOWN,
  INVOICES,
  WALLET_ADDED,
  WALLET_MANY,
  WALLET_TWO,
  accountsFor,
  invoicePage,
} from "@/features/subscription/__fixtures__/billing";
import type { BillingAccounts } from "@/features/subscription/api/payerPortal";
import { useBillingPage } from "@/features/subscription/hooks/useBillingPage";
import { BILLING_LOAD_FAILED } from "@/features/subscription/lib/billing";
import { breakdownCsv } from "@/features/subscription/lib/breakdown";

// What would have been handed to the browser to save - the file itself, not the Blob plumbing.
const saved = vi.hoisted(() => [] as { filename: string; text: string }[]);
vi.mock("@/features/subscription/lib/download", () => ({
  saveTextFile: (filename: string, text: string) => saved.push({ filename, text }),
}));

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
}));

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The accounts after Company A's charged card became `cardId`. */
function charging(data: BillingAccounts, cardId: string): BillingAccounts {
  const [a, ...rest] = data.accounts;
  return {
    ...data,
    accounts: [
      {
        ...a,
        default_id: cardId,
        card: a.cards.find((c) => c.id === cardId) ?? a.card,
        cards: a.cards.map((c) => ({ ...c, is_default: c.id === cardId })),
      },
      ...rest,
    ],
  };
}

describe("useBillingPage", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const posts: { path: string; body: unknown }[] = [];
  const invoiceQueries: string[] = [];

  function serve(
    accounts: BillingAccounts | { status: number; error: string },
    answers: Record<string, { status: number; body: unknown }> = {},
    options: {
      invoices?: boolean;
      after?: BillingAccounts;
      invoiceTotal?: number;
      breakdown?: boolean;
    } = {},
  ) {
    posts.length = 0;
    invoiceQueries.length = 0;
    let current = accounts;
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "POST") {
        posts.push({ path: url.pathname, body: init.body ? JSON.parse(String(init.body)) : null });
        // A removal answers the wallet; the page then reads the accounts again.
        if (options.after) current = options.after;
        const a = answers[url.pathname];
        return a ? reply(a.status, a.body) : reply(200, { ok: true });
      }
      if (url.pathname === "/api/me/billing/accounts") {
        return "status" in current
          ? reply(current.status, { error: current.error })
          : reply(200, current);
      }
      if (/^\/api\/me\/invoices\/[^/]+\/breakdown$/.test(url.pathname)) {
        return options.breakdown === false
          ? reply(404, { error: "That invoice couldn't be found." })
          : reply(200, BREAKDOWN);
      }
      if (url.pathname === "/api/me/invoices") {
        invoiceQueries.push(url.search);
        if (options.invoices === false) return reply(500, { error: "nope" });
        if (options.invoiceTotal === undefined) return reply(200, invoicePage());
        // An account with more invoices than a page holds: answer the page asked for.
        const perPage = Number(url.searchParams.get("per_page") ?? 10);
        const page = Number(url.searchParams.get("page") ?? 1);
        return reply(
          200,
          invoicePage(INVOICES, {
            total: options.invoiceTotal,
            page,
            pages: Math.ceil(options.invoiceTotal / perPage),
            per_page: perPage,
          }),
        );
      }
      return reply(404, { error: "not_found" });
    });
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    push.mockReset();
    replace.mockReset();
    saved.length = 0;
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads the account - its name, address, email and cards - and ITS invoices", async () => {
    serve(accountsFor(WALLET_TWO));
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.rows.map((r) => r.title)).toEqual([
      "Visa ending in 4121",
      "Mastercard ending in 4651",
    ]);
    expect(result.current.next.billTo).toBe("Company A Limited");
    expect(result.current.next.addressLines).toEqual([
      "Unit 10, 1/F, ABC Building",
      "2 ABC Street",
      "Quarry Bay, Hong Kong",
    ]);
    expect(result.current.next.email).toBe("billing@companyalimited.com");
    expect(result.current.next.date).toBe("28 Sep 2026");
    // A company on THIS account failed to pay: 08-K's amber.
    expect(result.current.next.failed).toBe(true);
    expect(result.current.next.failedNames).toEqual(["Willow Court Limited"]);
    // The account's next renewal, estimated - by the currency's code, cents only when any.
    expect(result.current.next.amount).toBe("HKD 960");
    // The invoices are their own read: the first page, ten to a page.
    await waitFor(() => expect(result.current.invoices).toHaveLength(INVOICES.length));
    expect(invoiceQueries).toEqual(["?account=acc-company-a&page=1&per_page=10"]);
    expect(result.current.invoicePaging).toMatchObject({ page: 1, perPage: 10, loading: false });
    expect(result.current.expired).toBeNull();
  });

  it("pages the invoices - 10, 50 or 100 to a page - reading only the page asked for", async () => {
    serve(accountsFor(WALLET_TWO), {}, { invoiceTotal: 23 });
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.invoicePaging.total).toBe(23));
    expect(result.current.invoicePaging).toMatchObject({ page: 1, pages: 3, loading: false });
    const accountReads = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/billing/accounts"),
    ).length;

    act(() => result.current.goToInvoicePage(2));
    await waitFor(() => expect(invoiceQueries.at(-1)).toBe("?account=acc-company-a&page=2&per_page=10"));
    // A new size starts at the first page.
    act(() => result.current.setInvoicesPerPage(50));
    await waitFor(() =>
      expect(invoiceQueries.at(-1)).toBe("?account=acc-company-a&page=1&per_page=50"),
    );
    await waitFor(() => expect(result.current.invoicePaging).toMatchObject({ page: 1, perPage: 50 }));
    // Turning pages never re-reads the accounts (a Stripe read at the API).
    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).includes("/billing/accounts")).length,
    ).toBe(accountReads);
  });

  it("saves an invoice's breakdown as the CSV named after it; a refusal says why", async () => {
    serve(accountsFor(WALLET_TWO));
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => result.current.downloadBreakdown("in_1"));
    expect(saved).toEqual([
      { filename: "Inv-11241234113 Breakdown by Entity.csv", text: breakdownCsv(BREAKDOWN) },
    ]);
    expect(result.current.breakdownBusy).toBeNull();
    expect(result.current.breakdownError).toBeNull();

    serve(accountsFor(WALLET_TWO), {}, { breakdown: false });
    await act(async () => result.current.downloadBreakdown("in_2"));
    expect(result.current.breakdownError).toBe("That invoice couldn't be found.");
    expect(saved).toHaveLength(1); // nothing saved for a refusal
  });

  it("keeps the page when the invoices fail - they are not its subject", async () => {
    serve(accountsFor(WALLET_TWO), {}, { invoices: false });
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.invoices).toEqual([]);
  });

  it("but a failed accounts read IS the page's failure, and retries", async () => {
    serve({ status: 502, error: "Stripe didn't answer." });
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Stripe didn't answer.");

    serve(ACCOUNTS);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    fetchMock.mockRejectedValue(new TypeError("offline"));
    const { result: offline } = renderHook(() => useBillingPage());
    await waitFor(() => expect(offline.current.status).toBe("error"));
    expect(offline.current.error).toBe(BILLING_LOAD_FAILED);
  });

  it("is the account asked for, else the one a company is on, else the payer's oldest", async () => {
    serve(ACCOUNTS);
    const asked = renderHook(() => useBillingPage({ accountId: "acc-vine" })).result;
    const byCompany = renderHook(() => useBillingPage({ entity: "e-halcyon-labs-limited" })).result;
    const neither = renderHook(() => useBillingPage()).result;
    const stale = renderHook(() => useBillingPage({ accountId: "acc-gone" })).result;
    await waitFor(() => expect(stale.current.status).toBe("ready"));
    await waitFor(() => expect(asked.current.status).toBe("ready"));
    await waitFor(() => expect(byCompany.current.status).toBe("ready"));
    await waitFor(() => expect(neither.current.status).toBe("ready"));

    expect(asked.current.next.billTo).toBe("Vine Consulting Limited");
    expect(asked.current.next.failed).toBe(false);
    // Never named: it reads as the payer, and its collection is failing.
    expect(byCompany.current.next.billTo).toBe("Olive Vine");
    expect(byCompany.current.next.failed).toBe(true);
    expect(neither.current.next.billTo).toBe("Company A Limited");
    expect(stale.current.next.billTo).toBe("Company A Limited");
    await waitFor(() => expect(invoiceQueries).toContain("?account=acc-vine&page=1&per_page=10"));
    expect(invoiceQueries).toContain("?account=acc-legacy&page=1&per_page=10");
  });

  it("shows two cards until Show more, then all of them", async () => {
    serve(accountsFor(WALLET_MANY));
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.shown).toHaveLength(2);
    expect(result.current.showMore).toBe("Show more (6)");
    act(() => result.current.toggleExpanded());
    expect(result.current.shown).toHaveLength(8);
  });

  it("switches the card THIS account charges, and the accounts come from the answer", async () => {
    const data = accountsFor(WALLET_TWO);
    serve(data, {
      "/api/me/billing/accounts/default-card": {
        status: 200,
        body: charging(data, "pm_master4651"),
      },
    });
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const master = result.current.rows[1];
    await act(async () => result.current.onMenu(master, "set_default"));
    expect(posts).toEqual([
      {
        path: "/api/me/billing/accounts/default-card",
        body: { account: "acc-company-a", payment_method: "pm_master4651" },
      },
    ]);
    await waitFor(() => expect(result.current.rows[0].card.id).toBe("pm_master4651"));
  });

  it("refuses to remove the account's own card (08-R), removes another one and reads again", async () => {
    const data = accountsFor(WALLET_TWO);
    serve(
      data,
      { "/api/me/billing/payment-methods/remove": { status: 200, body: WALLET_TWO } },
      { after: accountsFor({ ...WALLET_TWO, total: 1, methods: [WALLET_TWO.methods[0]] }) },
    );
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.onMenu(result.current.rows[0], "delete"));
    expect(result.current.prompt).toMatchObject({ kind: "remove_default" });
    await act(async () => result.current.confirmRemove());
    expect(posts).toEqual([]); // nothing is sent for the card the account charges

    act(() => result.current.dismissPrompt());
    act(() => result.current.onMenu(result.current.rows[1], "delete"));
    expect(result.current.prompt).toMatchObject({ kind: "remove" });
    await act(async () => result.current.confirmRemove());
    expect(posts).toEqual([
      {
        path: "/api/me/billing/payment-methods/remove",
        body: { payment_method: "pm_master4651", account: "acc-company-a" },
      },
    ]);
    expect(result.current.prompt).toBeNull();
    expect(result.current.rows).toHaveLength(1);
  });

  it("a refused removal says why and keeps the card on the page", async () => {
    serve(accountsFor(WALLET_TWO), {
      "/api/me/billing/payment-methods/remove": {
        status: 409,
        body: { error: "That card is still paying for two companies." },
      },
    });
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.onMenu(result.current.rows[1], "delete"));
    await act(async () => result.current.confirmRemove());
    expect(result.current.actionError).toBe("That card is still paying for two companies.");
    expect(result.current.rows).toHaveLength(2);
  });

  it("names the card that just arrived on this account, and can make it the one it charges (08-N → 08-S)", async () => {
    const data = accountsFor(WALLET_ADDED);
    serve(data, {
      "/api/me/billing/accounts/default-card": {
        status: 200,
        body: charging(data, ADDED_CARD.id),
      },
    });
    const { result } = renderHook(() =>
      useBillingPage({ accountId: "acc-company-a", addedId: ADDED_CARD.id }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.added).toMatchObject({ isDefault: false });
    expect(result.current.added?.card.last4).toBe("8842");
    await act(async () => result.current.makeAddedDefault());
    expect(posts[0]).toEqual({
      path: "/api/me/billing/accounts/default-card",
      body: { account: "acc-company-a", payment_method: ADDED_CARD.id },
    });
    await waitFor(() => expect(result.current.added?.isDefault).toBe(true));
    act(() => result.current.dismissAdded());
    expect(result.current.added).toBeNull();
  });

  it("says nothing about a card this account does not hold", async () => {
    serve(accountsFor(WALLET_TWO));
    const { result } = renderHook(() => useBillingPage({ addedId: "pm_amex1007" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    // pm_amex1007 is Vine Consulting's card, not Company A's.
    expect(result.current.added).toBeNull();
  });

  it("Add, Edit and Change billing details carry the account; Back is 08-A showing it", async () => {
    serve(accountsFor(WALLET_TWO));
    const { result } = renderHook(() => useBillingPage({ accountId: "acc-company-a" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.addCard());
    act(() => result.current.onMenu(result.current.rows[0], "edit"));
    act(() => result.current.changeDetails());
    act(() => result.current.back());
    expect(push.mock.calls.map((c) => c[0])).toEqual([
      "/subscription/billing/add?account=acc-company-a",
      "/subscription/billing/edit?card=pm_visa4121&account=acc-company-a",
      "/subscription/billing/details?account=acc-company-a",
      "/subscription?account=acc-company-a",
    ]);
  });

  it("a payer with no account at all is offered one, and no invoices are asked for", async () => {
    serve(ACCOUNTS_NONE);
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.account).toBeNull();
    expect(result.current.rows).toEqual([]);
    expect(invoiceQueries).toEqual([]);

    // Onboarding's sheet, over this page - not a page of its own.
    act(() => result.current.openAccount());
    expect(result.current.opening).toBe(true);
    expect(push).not.toHaveBeenCalled();
    act(() => result.current.closeOpening());
    expect(result.current.opening).toBe(false);

    // Done on the sheet: this page becomes the new account's - named in the URL.
    act(() => result.current.openAccount());
    act(() =>
      result.current.accountOpened({
        accountId: "acc-acme",
        accounts: ACCOUNTS_OPENED,
        moved: null,
        moveFailed: null,
        card: null,
        isDefault: false,
      }),
    );
    expect(result.current.opening).toBe(false);
    expect(replace).toHaveBeenCalledWith("/subscription/billing?account=acc-acme");
  });

  it("?fixture= serves a frame without the API outside production", async () => {
    const { result } = renderHook(() => useBillingPage({ fixture: "J" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.rows).toHaveLength(8);
    expect(result.current.invoices).toHaveLength(INVOICES.length);
  });
});
