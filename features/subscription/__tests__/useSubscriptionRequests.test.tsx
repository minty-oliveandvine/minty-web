// The recipient's side of a handover over a stubbed fetch: the requests read, the one under
// review (asked for, or the only one) with its company's cards and the person's own billing
// accounts, the account picked (or opened in place) before confirming - sent with the accept,
// never a card on its own - accepting landing on the list's 07-M, declining reading again, the
// empty state.

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";

import { SUMMARY_FIXTURES, TODAY } from "@/features/subscription/__fixtures__/modulePage";
import {
  INCOMING_REQUEST,
  INCOMING_REQUEST_TRIAL,
  RECIPIENT_ACCOUNTS,
  RECIPIENT_NO_ACCOUNTS,
} from "@/features/subscription/__fixtures__/transfers";
import type { BillingAccounts, IncomingTransfer } from "@/features/subscription/api/payerPortal";
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
    accounts: BillingAccounts = RECIPIENT_ACCOUNTS,
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
      if (url.pathname === "/api/me/billing/accounts") return reply(200, accounts);
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

  it("one request: reviewed at once - the company's cards, the account that will pay", async () => {
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
    expect(r.accountId).toBe("acc-harbour");
    expect(r.card?.last4).toBe("4121");
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

  it("07-E lists the person's billing accounts: the oldest that can pay preselected, the rest shut with why", async () => {
    serve([INCOMING_REQUEST]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    expect(result.current.reviewed?.targets.map((t) => [t.account.id, t.block])).toEqual([
      ["acc-harbour", null],
      ["acc-kowloon", null],
      ["acc-lapsed", "in_dunning"],
    ]);
    expect(result.current.reviewed?.accountId).toBe("acc-harbour");
    // No wallet is read, and no card is made anyone's default: the account is the choice.
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("payment-methods"))).toBe(false);
  });

  it("Change picks another account - nothing posted - and accepting bills the company to it", async () => {
    serve([INCOMING_REQUEST]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    act(() => result.current.chooseAccount());
    expect(result.current.step).toBe("payment");
    act(() => result.current.pickAccount("acc-kowloon"));
    act(() => result.current.confirmAccount());
    expect(posts).toEqual([]);
    expect(result.current.step).toBe("review");
    // The review's card line is the chosen ACCOUNT's charged card.
    expect(result.current.reviewed?.card?.last4).toBe("8842");

    await act(() => result.current.accept());
    expect(posts).toEqual([
      {
        path: "/api/me/subscriptions/transfer/respond",
        body: { transfer: "t-1", accept: true, billing_group_id: "acc-kowloon" },
        entity: null,
      },
    ]);
  });

  it("a shut account cannot be chosen: picking it leaves nothing chosen and accepting does nothing", async () => {
    serve([INCOMING_REQUEST]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    act(() => result.current.pickAccount("acc-lapsed"));
    expect(result.current.reviewed?.account).toBeNull();
    await act(() => result.current.accept());
    expect(posts).toEqual([]);
  });

  it("New billing account opens the sheet in place; the account it opens comes back picked", async () => {
    serve([INCOMING_REQUEST], {}, RECIPIENT_NO_ACCOUNTS);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    // Nobody to bill yet: nothing chosen, and Confirm Subscription Transfer cannot go.
    expect(result.current.reviewed?.account).toBeNull();

    act(() => result.current.chooseAccount());
    act(() => result.current.addAccount());
    expect(result.current.addingAccount).toBe(true);
    // THE POINT OF IT: leaving for the billing page would throw away the offer being reviewed.
    expect(push).not.toHaveBeenCalled();
    expect(result.current.reviewed?.row.id).toBe("t-1");

    const opened = RECIPIENT_ACCOUNTS.accounts[1];
    act(() =>
      result.current.accountOpened({
        accountId: opened.id,
        accounts: { ...RECIPIENT_NO_ACCOUNTS, accounts: [opened], total: 1 },
        moved: null,
        moveFailed: null,
        card: opened.card,
        isDefault: true,
      }),
    );
    expect(result.current.addingAccount).toBe(false);
    expect(result.current.step).toBe("payment");
    // Picked, because opening it mid-choice IS choosing it.
    expect(result.current.reviewed?.accountId).toBe(opened.id);
    expect(result.current.reviewed?.targets).toHaveLength(1);
  });

  it("Cancel on the sheet goes back to the list, not out of the offer", async () => {
    serve([INCOMING_REQUEST]);
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    act(() => result.current.chooseAccount());
    act(() => result.current.addAccount());
    act(() => result.current.cancelAddAccount());
    expect(result.current.addingAccount).toBe(false);
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
        body: {
          transfer: "t-1",
          accept: true,
          codes: ["PAYMENT_REQUEST"],
          billing_group_id: "acc-harbour",
        },
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
    expect(posts[0].body).toEqual({
      transfer: "t-1",
      accept: true,
      billing_group_id: "acc-harbour",
    });
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
        body: { transfer: "t-1", accept: true, billing_group_id: "acc-harbour" },
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
        body: { error: "Choose a billing account before taking over the billing." },
      },
    });
    const { result } = renderHook(() => useSubscriptionRequests({ today: TODAY }));
    await waitFor(() => expect(result.current.reviewed?.viewStatus).toBe("ready"));
    await act(() => result.current.accept());
    expect(result.current.actionError).toBe(
      "Choose a billing account before taking over the billing.",
    );
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
    expect(result.current.reviewed?.targets).toHaveLength(RECIPIENT_ACCOUNTS.accounts.length);
    expect(result.current.reviewed?.accountId).toBe("acc-harbour");
  });
});
