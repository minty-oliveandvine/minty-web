// The billing page over a stubbed fetch: the three reads (and what survives one of them
// failing), Show more, the card menu's three items, a card promoted, the default refused
// removal (08-R) and another one removed, the card that just arrived (08-N → 08-S), and where
// Add / Edit go.

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";

import {
  ADDED_CARD,
  INVOICES,
  WALLET_ADDED,
  WALLET_MANY,
  WALLET_NONE,
  WALLET_TWO,
  invoicePage,
} from "@/features/subscription/__fixtures__/billing";
import { subscriptionsPage } from "@/features/subscription/__fixtures__/subscriptions";
import type { PayerPaymentMethods } from "@/features/subscription/api/payerPortal";
import { useBillingPage } from "@/features/subscription/hooks/useBillingPage";
import { BILLING_LOAD_FAILED } from "@/features/subscription/lib/billing";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useBillingPage", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const posts: { path: string; body: unknown }[] = [];

  function serve(
    wallet: PayerPaymentMethods | { status: number; error: string },
    answers: Record<string, { status: number; body: unknown }> = {},
    options: { invoices?: boolean; list?: boolean } = {},
  ) {
    posts.length = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "POST") {
        posts.push({ path: url.pathname, body: init.body ? JSON.parse(String(init.body)) : null });
        const a = answers[url.pathname];
        return a ? reply(a.status, a.body) : reply(200, { ok: true });
      }
      if (url.pathname === "/api/me/billing/payment-methods") {
        return "status" in wallet
          ? reply(wallet.status, { error: wallet.error })
          : reply(200, wallet);
      }
      if (url.pathname === "/api/me/subscriptions") {
        return options.list === false
          ? reply(500, { error: "nope" })
          : reply(200, subscriptionsPage());
      }
      if (url.pathname === "/api/me/invoices") {
        return options.invoices === false
          ? reply(500, { error: "nope" })
          : reply(200, invoicePage());
      }
      return reply(404, { error: "not_found" });
    });
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads the cards, who is billed and the invoices", async () => {
    serve(WALLET_TWO);
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.rows.map((r) => r.title)).toEqual([
      "Visa ending in 4121",
      "Mastercard ending in 4651",
    ]);
    expect(result.current.next.billTo).toBe("Olive Vine");
    expect(result.current.next.failed).toBe(true);
    expect(result.current.invoices).toHaveLength(INVOICES.length);
    expect(result.current.invoiceHeader).toBe("Amount (HK$)");
    expect(result.current.expired).toBeNull();
  });

  it("keeps the page when the companies or the invoices fail - they are not its subject", async () => {
    serve(WALLET_TWO, {}, { invoices: false, list: false });
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.rows).toHaveLength(2);
    expect(result.current.invoices).toEqual([]);
    expect(result.current.next.billTo).toBe("");
    expect(result.current.next.failed).toBe(false);
  });

  it("but a failed card read IS the page's failure, and retries", async () => {
    serve({ status: 502, error: "Stripe didn't answer." });
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Stripe didn't answer.");

    serve(WALLET_TWO);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    fetchMock.mockRejectedValue(new TypeError("offline"));
    const { result: offline } = renderHook(() => useBillingPage());
    await waitFor(() => expect(offline.current.status).toBe("error"));
    expect(offline.current.error).toBe(BILLING_LOAD_FAILED);
  });

  it("shows two cards until Show more, then all of them", async () => {
    serve(WALLET_MANY);
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.shown).toHaveLength(2);
    expect(result.current.showMore).toBe("Show more (6)");
    act(() => result.current.toggleExpanded());
    expect(result.current.shown).toHaveLength(8);
  });

  it("promotes a card, and the wallet comes from the answer", async () => {
    serve(WALLET_TWO, {
      "/api/me/billing/payment-methods/default": {
        status: 200,
        body: { ...WALLET_TWO, default_id: "pm_master4651" },
      },
    });
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const master = result.current.rows[1];
    await act(async () => result.current.onMenu(master, "set_default"));
    expect(posts).toEqual([
      {
        path: "/api/me/billing/payment-methods/default",
        body: { payment_method: "pm_master4651" },
      },
    ]);
    await waitFor(() => expect(result.current.rows[0].card.id).toBe("pm_master4651"));
  });

  it("refuses to remove the default card (08-R) and removes another one", async () => {
    serve(WALLET_TWO, {
      "/api/me/billing/payment-methods/remove": {
        status: 200,
        body: { ...WALLET_TWO, total: 1, methods: [WALLET_TWO.methods[0]] },
      },
    });
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.onMenu(result.current.rows[0], "delete"));
    expect(result.current.prompt).toMatchObject({ kind: "remove_default" });
    await act(async () => result.current.confirmRemove());
    expect(posts).toEqual([]); // nothing is sent for the card everything is charged to

    act(() => result.current.dismissPrompt());
    act(() => result.current.onMenu(result.current.rows[1], "delete"));
    expect(result.current.prompt).toMatchObject({ kind: "remove" });
    await act(async () => result.current.confirmRemove());
    expect(posts).toEqual([
      { path: "/api/me/billing/payment-methods/remove", body: { payment_method: "pm_master4651" } },
    ]);
    expect(result.current.prompt).toBeNull();
    expect(result.current.rows).toHaveLength(1);
  });

  it("a refused removal says why and keeps the card on the page", async () => {
    serve(WALLET_TWO, {
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

  it("names the card that just arrived, and can make it the default (08-N → 08-S)", async () => {
    serve(WALLET_ADDED, {
      "/api/me/billing/payment-methods/default": {
        status: 200,
        body: { ...WALLET_ADDED, default_id: ADDED_CARD.id },
      },
    });
    const { result } = renderHook(() => useBillingPage({ addedId: ADDED_CARD.id }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.added).toMatchObject({ isDefault: false });
    expect(result.current.added?.card.last4).toBe("8842");
    await act(async () => result.current.makeAddedDefault());
    await waitFor(() => expect(result.current.added?.isDefault).toBe(true));
    act(() => result.current.dismissAdded());
    expect(result.current.added).toBeNull();
  });

  it("says nothing about a card the account does not hold", async () => {
    serve(WALLET_TWO);
    const { result } = renderHook(() => useBillingPage({ addedId: "pm_someone_else" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.added).toBeNull();
  });

  it("Add and Edit are the two card screens; Back is the overview", async () => {
    serve(WALLET_NONE);
    const { result } = renderHook(() => useBillingPage());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.rows).toEqual([]);
    act(() => result.current.addCard());
    expect(push).toHaveBeenCalledWith("/subscription/billing/add");

    serve(WALLET_TWO);
    const { result: two } = renderHook(() => useBillingPage());
    await waitFor(() => expect(two.current.status).toBe("ready"));
    act(() => two.current.onMenu(two.current.rows[0], "edit"));
    expect(push).toHaveBeenCalledWith("/subscription/billing/edit?card=pm_visa4121");
    act(() => two.current.back());
    expect(push).toHaveBeenCalledWith("/subscription");
  });

  it("?fixture= serves a frame without the API outside production", async () => {
    const { result } = renderHook(() => useBillingPage({ fixture: "J" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.rows).toHaveLength(8);
    expect(result.current.invoices).toHaveLength(INVOICES.length);
  });
});
