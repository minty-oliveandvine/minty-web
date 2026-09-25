// The card forms' hooks over a stubbed fetch: the SetupIntent opened once (and the refusal when
// it cannot be), where a saved card lands, what opening a billing account reports to the sheet
// (the move, the re-read, the card 01-J names), and the edit screen - the fields it starts
// with, what it sends, what it refuses to send, and where it goes.

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";

import {
  ACCOUNTS_OPENED,
  OPENED_ACCOUNT,
  WALLET_NONE,
  WALLET_TWO,
} from "@/features/subscription/__fixtures__/billing";
import {
  CARD_NOT_FOUND,
  SETUP_FAILED,
  useAddCard,
  useEditCard,
  useNewAccount,
  type OpenedAccount,
} from "@/features/subscription/hooks/useCardForm";

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

const HANDLE = {
  client_secret: "seti_123_secret",
  publishable_key: "pk_test_123",
  setup_intent: "seti_123",
};

describe("useAddCard", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  function serve(wallet = WALLET_TWO, setup: { status: number; body: unknown } | null = null) {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/me/billing/payment-methods/setup-intent") {
        return setup ? reply(setup.status, setup.body) : reply(200, HANDLE);
      }
      if (url.pathname === "/api/me/billing/payment-methods" && init?.method !== "POST") {
        return reply(200, wallet);
      }
      return reply(404, { error: "not_found" });
    });
  }

  it("opens one SetupIntent and says whether this is the first card", async () => {
    serve(WALLET_NONE);
    const { result } = renderHook(() => useAddCard());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.handle).toEqual(HANDLE);
    expect(result.current.firstCard).toBe(true);
    const opens = fetchMock.mock.calls.filter((c) => String(c[0]).includes("setup-intent")).length;
    expect(opens).toBe(1);
  });

  it("a wallet that cannot be read does not stop the form", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/setup-intent")) return reply(200, HANDLE);
      return reply(500, { error: "nope" });
    });
    const { result } = renderHook(() => useAddCard());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.firstCard).toBe(false);
  });

  it("a refused SetupIntent says why, and Try again asks once more", async () => {
    serve(WALLET_TWO, { status: 503, body: { error: "Stripe is not configured." } });
    const { result } = renderHook(() => useAddCard());
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Stripe is not configured.");

    serve();
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe("ready"));

    fetchMock.mockRejectedValue(new TypeError("offline"));
    const { result: offline } = renderHook(() => useAddCard());
    await waitFor(() => expect(offline.current.status).toBe("error"));
    expect(offline.current.error).toBe(SETUP_FAILED);
  });

  it("a saved card lands on the billing page, named", async () => {
    serve();
    const { result } = renderHook(() => useAddCard());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.saved(WALLET_TWO, "pm_master4651"));
    expect(push).toHaveBeenCalledWith("/subscription/billing?added=pm_master4651");
    // Stripe did not hand one back: the newest card the server now holds is the one to name.
    act(() => result.current.saved(WALLET_TWO, null));
    expect(push).toHaveBeenLastCalledWith("/subscription/billing?added=pm_master4651");
    act(() => result.current.cancel());
    expect(push).toHaveBeenLastCalledWith("/subscription/billing");
  });

  it("a card added from an account's page goes ON that account, and lands back on it", async () => {
    serve();
    const { result } = renderHook(() => useAddCard({ accountId: "acc-company-a" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    // What the form hands the confirm: the card joins this account's shelf.
    expect(result.current.account).toEqual({ billingGroupId: "acc-company-a" });
    act(() => result.current.saved(WALLET_TWO, "pm_master4651"));
    expect(push).toHaveBeenLastCalledWith(
      "/subscription/billing?account=acc-company-a&added=pm_master4651",
    );
    act(() => result.current.cancel());
    expect(push).toHaveBeenLastCalledWith("/subscription/billing?account=acc-company-a");
  });
});

describe("useNewAccount", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const posts: { path: string; body: unknown }[] = [];
  const accountReads: string[] = [];
  const onSaved = vi.fn<(opened: OpenedAccount) => void>();
  const MOVED = {
    ...ACCOUNTS_OPENED,
    moved: {
      entity_id: "e-1",
      entity_name: "Nexora Health Limited",
      from_account: { id: "acc-company-a", name: "Company A Limited" },
      to_account: { id: "acc-acme", name: "Acme Ltd" },
    },
  };

  function serve({
    move = { status: 200, body: MOVED },
    accounts = { status: 200, body: ACCOUNTS_OPENED },
  }: {
    move?: { status: number; body: unknown };
    accounts?: { status: number; body: unknown };
  } = {}) {
    posts.length = 0;
    accountReads.length = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "POST" && url.pathname.endsWith("/setup-intent")) {
        return reply(200, HANDLE);
      }
      if (init?.method === "POST") {
        posts.push({ path: url.pathname, body: init.body ? JSON.parse(String(init.body)) : null });
        return reply(move.status, move.body);
      }
      if (url.pathname === "/api/me/billing/accounts") {
        accountReads.push(url.pathname);
        return reply(accounts.status, accounts.body);
      }
      if (url.pathname === "/api/me/billing/payment-methods") return reply(200, WALLET_TWO);
      return reply(404, { error: "not_found" });
    });
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    push.mockReset();
    onSaved.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("will not let Stripe near the card until the company and email are there", async () => {
    serve();
    const { result } = renderHook(() => useNewAccount({ onSaved }));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    let allowed = true;
    act(() => {
      allowed = result.current.beforeConfirm();
    });
    expect(allowed).toBe(false);
    expect(result.current.errors).toEqual({
      company: "Enter the company name to invoice.",
      email: "Enter the email address invoices should go to.",
    });

    act(() => result.current.setField("company", " Acme Ltd "));
    act(() => result.current.setField("email", "ap@acme.test"));
    act(() => {
      allowed = result.current.beforeConfirm();
    });
    expect(allowed).toBe(true);
    // What the confirm carries: the identity that OPENS the account.
    expect(result.current.account).toEqual({ company: "Acme Ltd", email: "ap@acme.test" });
  });

  it("opened on its own, it reads the accounts again and hands the sheet 01-J's card", async () => {
    serve();
    const { result } = renderHook(() => useNewAccount({ onSaved }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => result.current.saved(OPENED_ACCOUNT, "pm_visa4242"));

    expect(onSaved).toHaveBeenCalledTimes(1);
    const opened = onSaved.mock.calls[0][0];
    expect(opened).toMatchObject({
      accountId: "acc-acme",
      accounts: ACCOUNTS_OPENED,
      moved: null,
      moveFailed: null,
      // The card the new account CHARGES - what 01-J's second line says.
      isDefault: true,
    });
    expect(opened.card?.last4).toBe("4242");
    expect(accountReads).toHaveLength(1);
    expect(posts).toEqual([]); // nothing to move
    expect(push).not.toHaveBeenCalled(); // the sheet says what happened; nothing navigates
  });

  it("opened for a company, it moves that company onto it - the move's answer is the accounts", async () => {
    serve();
    const { result } = renderHook(() => useNewAccount({ move: "e-1", onSaved }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => result.current.saved(OPENED_ACCOUNT, "pm_visa4242"));

    expect(posts).toEqual([
      { path: "/api/me/billing/accounts/move", body: { entity: "e-1", account: "acc-acme" } },
    ]);
    expect(accountReads).toEqual([]); // no second read
    expect(onSaved.mock.calls[0][0]).toMatchObject({
      accountId: "acc-acme",
      accounts: MOVED,
      moved: "e-1",
      moveFailed: null,
    });
  });

  it("a refused move leaves the account open - which it is - and says the company stayed", async () => {
    serve({ move: { status: 409, body: { error: "Settle it there first." } } });
    const { result } = renderHook(() => useNewAccount({ move: "e-1", onSaved }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(async () => result.current.saved(OPENED_ACCOUNT, "pm_visa4242"));

    expect(onSaved.mock.calls[0][0]).toMatchObject({
      accountId: "acc-acme",
      accounts: ACCOUNTS_OPENED, // read again, so the page still learns of the new account
      moved: null,
      moveFailed: "e-1",
    });
  });

  it("a card it cannot name, or accounts it cannot read, are reported - never guessed", async () => {
    serve({ accounts: { status: 500, body: { error: "nope" } } });
    const { result } = renderHook(() => useNewAccount({ onSaved }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    // Stripe handed back no payment method: 01-J would have a blank in it, so the sheet skips it.
    await act(async () => result.current.saved(OPENED_ACCOUNT, null));

    expect(onSaved.mock.calls[0][0]).toMatchObject({
      accountId: "acc-acme",
      accounts: null, // the page reads everything again
      card: null,
      isDefault: false,
    });
  });
});

describe("useEditCard", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const posts: { path: string; body: unknown }[] = [];

  function serve(answer: { status: number; body: unknown } | null = null) {
    posts.length = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "POST") {
        posts.push({ path: url.pathname, body: init.body ? JSON.parse(String(init.body)) : null });
        return answer ? reply(answer.status, answer.body) : reply(200, WALLET_TWO);
      }
      if (url.pathname === "/api/me/billing/payment-methods") return reply(200, WALLET_TWO);
      return reply(404, { error: "not_found" });
    });
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("starts from the card's own name and expiry", async () => {
    serve();
    const { result } = renderHook(() => useEditCard({ cardId: "pm_visa4121" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.card?.last4).toBe("4121");
    expect(result.current.fields).toEqual({ name: "Rebecca Park", expMonth: "09", expYear: "26" });
    expect(result.current.dirty).toBe(false);
  });

  it("sends the name and the four-digit year, and lands back on the billing page", async () => {
    serve();
    const { result } = renderHook(() => useEditCard({ cardId: "pm_visa4121" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.setField("expMonth", "12"));
    act(() => result.current.setField("expYear", "27"));
    act(() => result.current.setField("name", "R. Park"));
    expect(result.current.dirty).toBe(true);
    await act(async () => result.current.save());
    expect(posts).toEqual([
      {
        path: "/api/me/billing/payment-methods/update",
        body: {
          payment_method: "pm_visa4121",
          name: "R. Park",
          exp_month: 12,
          exp_year: 2027,
        },
      },
    ]);
    expect(push).toHaveBeenCalledWith("/subscription/billing");
  });

  it("keeps digits out of the name's way and a bad month out of the request", async () => {
    serve();
    const { result } = renderHook(() => useEditCard({ cardId: "pm_visa4121" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.setField("expMonth", "1x3"));
    expect(result.current.fields.expMonth).toBe("13");
    await act(async () => result.current.save());
    expect(posts[0].body).toEqual({ payment_method: "pm_visa4121", name: "Rebecca Park" });
  });

  it("a refused save says why and keeps the screen", async () => {
    serve({ status: 422, body: { error: "That expiry is in the past." } });
    const { result } = renderHook(() => useEditCard({ cardId: "pm_visa4121" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.setField("name", "Someone Else"));
    await act(async () => result.current.save());
    expect(result.current.saveError).toBe("That expiry is in the past.");
    expect(push).not.toHaveBeenCalled();
  });

  it("a card the account does not hold, or none named at all, says so and reads nothing", async () => {
    serve();
    const { result } = renderHook(() => useEditCard({ cardId: "pm_nope" }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(CARD_NOT_FOUND);

    fetchMock.mockClear();
    const { result: none } = renderHook(() => useEditCard({ cardId: null }));
    expect(none.current.status).toBe("error");
    expect(none.current.error).toBe(CARD_NOT_FOUND);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("?fixture= serves a card without the API outside production", async () => {
    const { result } = renderHook(() => useEditCard({ cardId: "pm_master4651", fixture: "B" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.card?.brand_label).toBe("Mastercard");
  });
});
