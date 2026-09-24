// The recipient's side of a handover over a stubbed fetch: the requests read, the one under
// review (asked for, or the only one) with its company's cards and the person's own wallet,
// what accepting charges, the card picked (made the default) before confirming, accepting
// landing on the list's 07-M, declining reading again, the empty state.

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";

import { SUMMARY_FIXTURES, TODAY } from "@/features/subscription/__fixtures__/modulePage";
import {
  INCOMING_REQUEST,
  INCOMING_REQUEST_TRIAL,
  RECIPIENT_CARDS,
} from "@/features/subscription/__fixtures__/transfers";
import type { IncomingTransfer } from "@/features/subscription/api/payerPortal";
import { useSubscriptionRequests } from "@/features/subscription/hooks/useSubscriptionRequests";

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

describe("useSubscriptionRequests", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const posts: { path: string; body: unknown; entity: string | null }[] = [];

  function serve(
    rows: IncomingTransfer[],
    answers: Record<string, { status: number; body: unknown }> = {},
  ) {
    posts.length = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "POST") {
        posts.push({
          path: url.pathname,
          body: init.body ? JSON.parse(String(init.body)) : null,
          entity: new Headers(init.headers).get("X-Entity-Id"),
        });
        const a = answers[url.pathname];
        return a ? reply(a.status, a.body) : reply(200, { ok: true, message: "Done." });
      }
      if (url.pathname === "/api/me/subscriptions/transfers")
        return reply(200, { transfers: rows });
      if (/^\/api\/entities\/[^/]+\/modules$/.test(url.pathname)) {
        expect(new Headers(init?.headers).get("X-Entity-Id")).toBe("e-new-company");
        return reply(200, SUMMARY_FIXTURES.M24);
      }
      if (url.pathname === "/api/me/billing/payment-methods") return reply(200, RECIPIENT_CARDS);
      return reply(404, { error: "not_found" });
    });
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("nothing waiting: the empty state, and nothing else read", async () => {
    serve([]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.requests).toEqual([]);
    expect(result.current.reviewed).toBeNull();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/modules"))).toBe(false);
  });

  it("one request: reviewed at once - the company's cards, the wallet, what accepting charges", async () => {
    serve([INCOMING_REQUEST]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    const r = result.current.reviewed!;
    expect(r.row.id).toBe("t-1");
    expect(r.view?.modules.map((m) => [m.code, m.tick])).toEqual([
      ["PETTY_CASH", "unticked"],
      ["PAYMENT_REQUEST", "ticked"],
    ]);
    expect(r.view?.panel).toMatchObject({ kind: "simple", price: "HK$280" });
    expect(r.card?.last4).toBe("4121");
    expect(r.cardId).toBe("pm_visa4121");
  });

  it("several requests: none reviewed until picked; ?transfer= picks", async () => {
    const second = { ...INCOMING_REQUEST_TRIAL, id: "t-2" };
    serve([INCOMING_REQUEST, second]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.reviewed).toBeNull();
    act(() => result.current.review(second));
    await waitFor(() => expect(result.current.reviewed?.row.id).toBe("t-2"));

    const { result: byUrl } = renderHook(() =>
      useSubscriptionRequests({ today: TODAY, transferId: "t-1" }),
    );
    await waitFor(() => expect(byUrl.current.reviewed?.row.id).toBe("t-1"));
  });

  it("Change picks another card, made the default on Confirm; Add New Card is the billing page", async () => {
    serve([INCOMING_REQUEST], {
      "/api/me/billing/payment-methods/default": {
        status: 200,
        body: { ...RECIPIENT_CARDS, default_id: "pm_master8842" },
      },
    });
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    act(() => result.current.changeCard());
    expect(result.current.step).toBe("payment");
    act(() => result.current.pickCard("pm_master8842"));
    await act(() => result.current.confirmCard());
    expect(posts).toEqual([
      {
        path: "/api/me/billing/payment-methods/default",
        body: { payment_method: "pm_master8842" },
        entity: null,
      },
    ]);
    expect(result.current.step).toBe("review");
    expect(result.current.reviewed?.card?.last4).toBe("8842");
  });

  it("Add New Card opens the form in place; the new card is picked and the offer is still there", async () => {
    serve([INCOMING_REQUEST]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    act(() => result.current.changeCard());

    act(() => result.current.addCard());
    expect(result.current.step).toBe("add-card");
    // THE POINT OF THE STEP: it used to push to the billing page, which answered "I have no
    // card" by throwing away the offer being reviewed.
    expect(push).not.toHaveBeenCalled();
    expect(result.current.reviewed?.row.id).toBe("t-1");

    const added = {
      ...RECIPIENT_CARDS,
      methods: [...RECIPIENT_CARDS.methods, { ...RECIPIENT_CARDS.methods[0], id: "pm_fresh" }],
    };
    act(() => result.current.cardSaved(added, "pm_fresh"));
    expect(result.current.step).toBe("payment");
    // Picked, because adding it mid-choice IS choosing it.
    expect(result.current.reviewed?.cardId).toBe("pm_fresh");
    expect(result.current.reviewed?.cards).toHaveLength(added.methods.length);
  });

  it("Cancel on the card form goes back to the list, not out of the offer", async () => {
    serve([INCOMING_REQUEST]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    act(() => result.current.changeCard());
    act(() => result.current.addCard());
    act(() => result.current.cancelAddCard());
    expect(result.current.step).toBe("payment");
    expect(push).not.toHaveBeenCalled();
  });

  it("07-D: unticking a module sends only the kept ones; the whole company sends no codes", async () => {
    serve([INCOMING_REQUEST]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    // Everything the company holds starts taken on - arriving here is being offered all of it.
    expect(result.current.reviewed?.taking).toEqual(["PETTY_CASH", "PAYMENT_REQUEST"]);

    act(() => result.current.toggleModule("PETTY_CASH"));
    expect(result.current.reviewed?.taking).toEqual(["PAYMENT_REQUEST"]);

    await act(() => result.current.accept());
    expect(posts).toEqual([
      {
        path: "/api/me/subscriptions/transfer/respond",
        body: { transfer: "t-1", accept: true, codes: ["PAYMENT_REQUEST"] },
        entity: null,
      },
    ]);
  });

  it("taking the whole company omits codes entirely rather than re-listing them", async () => {
    serve([INCOMING_REQUEST]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    // Ticked off and back on again: the choice is unchanged, so it is not a choice.
    act(() => result.current.toggleModule("PETTY_CASH"));
    act(() => result.current.toggleModule("PETTY_CASH"));

    await act(() => result.current.accept());
    expect(posts[0].body).toEqual({ transfer: "t-1", accept: true });
  });

  it("the last ticked module cannot be unticked", async () => {
    serve([INCOMING_REQUEST]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    act(() => result.current.toggleModule("PETTY_CASH"));
    expect(result.current.reviewed?.taking).toEqual(["PAYMENT_REQUEST"]);

    // Taking nothing on is declining the handover, which is the other button - so the
    // screen never reaches a state Confirm would have to refuse.
    act(() => result.current.toggleModule("PAYMENT_REQUEST"));
    expect(result.current.reviewed?.taking).toEqual(["PAYMENT_REQUEST"]);

    // And it still ticks back on.
    act(() => result.current.toggleModule("PETTY_CASH"));
    expect(result.current.reviewed?.taking).toEqual(["PETTY_CASH", "PAYMENT_REQUEST"]);
  });

  it("Confirm Subscription Transfer accepts and lands on the list's row, transferred", async () => {
    serve([INCOMING_REQUEST]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    await act(() => result.current.accept());
    expect(posts).toEqual([
      {
        path: "/api/me/subscriptions/transfer/respond",
        body: { transfer: "t-1", accept: true },
        entity: null,
      },
    ]);
    expect(push).toHaveBeenCalledWith(
      "/subscription/subscriptions?entity=e-new-company&transferred=1",
    );
  });

  it("a refused accept says why and lets the person try again; a blocked one cannot be accepted", async () => {
    serve([INCOMING_REQUEST], {
      "/api/me/subscriptions/transfer/respond": {
        status: 422,
        body: { error: "Add a card to your billing account first." },
      },
    });
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    await act(() => result.current.accept());
    expect(result.current.actionError).toBe("Add a card to your billing account first.");
    expect(result.current.busy).toBe(false);
    expect(push).not.toHaveBeenCalled();

    serve([{ ...INCOMING_REQUEST, blockers: ["That person needs a saved payment method."] }]);
    const { result: blocked } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(blocked.current.reviewed?.viewStatus).toBe("ready"));
    await act(() => blocked.current.accept());
    expect(posts).toEqual([]);
  });

  it("Decline posts, then the requests are read again", async () => {
    serve([INCOMING_REQUEST]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    serve([]);
    await act(() => result.current.decline());
    expect(posts).toEqual([
      {
        path: "/api/me/subscriptions/transfer/respond",
        body: { transfer: "t-1", accept: false },
        entity: null,
      },
    ]);
    await waitFor(() => expect(result.current.requests).toEqual([]));
    expect(result.current.reviewed).toBeNull();
  });

  it("?fixture= serves the frames without the API outside production", async () => {
    const { result } = renderHook(() => useSubscriptionRequests({ fixture: "D" }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.reviewed?.cards).toHaveLength(2);
  });
});
