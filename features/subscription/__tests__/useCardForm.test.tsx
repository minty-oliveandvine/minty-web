// The two card screens' hooks over a stubbed fetch: the SetupIntent opened once (and the
// refusal when it cannot be), where a saved card lands, and the edit screen - the fields it
// starts with, what it sends, what it refuses to send, and where it goes.

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";

import { WALLET_NONE, WALLET_TWO } from "@/features/subscription/__fixtures__/billing";
import {
  CARD_NOT_FOUND,
  SETUP_FAILED,
  useAddCard,
  useEditCard,
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
