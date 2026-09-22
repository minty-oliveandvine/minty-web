// The open row's data: fetched when a company is open (its page model with X-Entity-Id, its
// card from the person-scoped route), tolerant of the card call failing, loud when the page
// model does, idle for no company, and re-fetched on reload.

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";

import { SUMMARY_FIXTURES, TODAY, WALLET } from "@/features/subscription/__fixtures__/modulePage";
import { ENTITIES } from "@/features/subscription/__fixtures__/subscriptions";
import {
  SUMMARY_LOAD_FAILED,
  useEntitySummary,
} from "@/features/subscription/hooks/useEntitySummary";

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("useEntitySummary", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const entity = ENTITIES[0];

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is idle with no company and fetches nothing", () => {
    const { result } = renderHook(() => useEntitySummary(null, { today: TODAY }));
    expect(result.current.status).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the page model for the company and its nominated card", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === `/api/entities/${entity.entity_id}/modules`) {
        expect(new Headers(init?.headers).get("X-Entity-Id")).toBe(entity.entity_id);
        return reply(200, SUMMARY_FIXTURES.M44);
      }
      if (url.pathname === "/api/me/billing/entity-payment-method") {
        expect(url.searchParams.get("entity")).toBe(entity.entity_id);
        return reply(200, WALLET);
      }
      return reply(404, { error: "not_found" });
    });
    const { result } = renderHook(() => useEntitySummary(entity, { today: TODAY }));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.view?.paymentMethod?.label).toBe("Visa 4121");
    expect(result.current.view?.panel).toMatchObject({ kind: "simple", price: "HK$400" });
  });

  it("keeps the row when only the card call fails", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/modules")) return reply(200, SUMMARY_FIXTURES.M21);
      return reply(403, {
        error: "Only the person who pays for this company can change its subscription.",
      });
    });
    const { result } = renderHook(() => useEntitySummary(entity, { today: TODAY }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.view?.paymentMethod).toBeNull();
    expect(result.current.view?.trialNotice).toBe(true);
  });

  it("says so when the page model fails, and reload asks again", async () => {
    let attempts = 0;
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/modules")) {
        attempts += 1;
        return attempts === 1
          ? reply(500, { error: "Something went wrong on my end. Mind trying again?" })
          : reply(200, SUMMARY_FIXTURES.M11);
      }
      return reply(200, WALLET);
    });
    const { result } = renderHook(() => useEntitySummary(entity, { today: TODAY }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Something went wrong on my end. Mind trying again?");

    result.current.reload();
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.view?.modules.map((m) => m.tick)).toEqual(["start_trial", "start_trial"]);
  });

  it("holds the pending ticks beside the answer: flip, undo, reset, and gone with a reload", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/modules")) return reply(200, SUMMARY_FIXTURES.M44);
      return reply(200, WALLET);
    });
    const { result } = renderHook(() => useEntitySummary(entity, { today: TODAY }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.view?.pendingChange).toBeNull();

    act(() => result.current.toggleTick("PETTY_CASH"));
    expect(result.current.view?.modules[0]).toMatchObject({ tick: "unticked", chip: "Removing" });
    expect(result.current.view?.pendingChange).toMatchObject({
      code: "PETTY_CASH",
      seam: "cancel",
    });

    act(() => result.current.toggleTick("PETTY_CASH"));
    expect(result.current.view?.pendingChange).toBeNull();

    act(() => result.current.toggleTick("PAYMENT_REQUEST"));
    expect(result.current.view?.pendingChange?.code).toBe("PAYMENT_REQUEST");
    act(() => result.current.resetTicks());
    expect(result.current.view?.pendingChange).toBeNull();

    // A fresh answer (reload) starts with nothing pending.
    act(() => result.current.toggleTick("PAYMENT_REQUEST"));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.view?.pendingChange).toBeNull();
  });

  it("uses the house sentence for a dark or unwired API", async () => {
    fetchMock.mockImplementation(async () => reply(404, { error: "not_found" }));
    const { result } = renderHook(() => useEntitySummary(entity, { today: TODAY }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(SUMMARY_LOAD_FAILED);
  });
});
