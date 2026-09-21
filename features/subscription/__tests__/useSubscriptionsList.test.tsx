// The list's orchestration over a stubbed fetch: the pages are walked, the transfers ride
// along, search and sort work on the loaded list, Start Trial asks then posts with the
// company's id, and every seam lands where the design points.

import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import { TODAY } from "@/features/subscription/__fixtures__/modulePage";
import {
  ENTITIES,
  INCOMING_TRANSFERS,
  subscriptionsPage,
} from "@/features/subscription/__fixtures__/subscriptions";
import {
  LIST_NOT_WIRED_YET,
  LIST_SERVICE_DARK,
  SEARCH_DEBOUNCE_MS,
  useSubscriptionsList,
} from "@/features/subscription/hooks/useSubscriptionsList";

const push = vi.fn();
const back = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back }),
}));

const API = env.BILLING_API_URL;

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

/** Answer the list's calls by URL, whatever order they arrive in. */
function serve(
  fetchMock: ReturnType<typeof vi.fn<typeof fetch>>,
  pages: unknown[],
  transfers: unknown,
) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/me/subscriptions/transfers") return reply(200, { transfers });
    if (url.pathname === "/api/me/subscriptions") {
      const page = Number(url.searchParams.get("page") ?? "1");
      return reply(200, pages[page - 1]);
    }
    return reply(200, { ok: true });
  });
}

describe("useSubscriptionsList", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    push.mockReset();
    back.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("walks every page of the list and reads the transfers alongside", async () => {
    const half = Math.ceil(ENTITIES.length / 2);
    const p1 = { ...subscriptionsPage(ENTITIES.slice(0, half)), pages: 2, total: ENTITIES.length };
    const p2 = {
      ...subscriptionsPage(ENTITIES.slice(half)),
      page: 2,
      pages: 2,
      total: ENTITIES.length,
    };
    serve(fetchMock, [p1, p2], INCOMING_TRANSFERS);
    const { result } = renderHook(() => useSubscriptionsList({ today: TODAY }), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("ready"));

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain(`${API}/api/me/subscriptions?page=1&per_page=100`);
    expect(urls).toContain(`${API}/api/me/subscriptions?page=2&per_page=100`);
    expect(urls).toContain(`${API}/api/me/subscriptions/transfers`);
    // the portal is person-scoped: no X-Entity-Id on these
    for (const [, init] of fetchMock.mock.calls)
      expect(new Headers(init?.headers).has("X-Entity-Id")).toBe(false);
    expect(result.current.active.length + result.current.suspended.length).toBe(ENTITIES.length);
    expect(result.current.suspended.map((r) => r.entity.entity_name)).toEqual([
      "Halcyon Labs Limited",
    ]);
    expect(result.current.transfers).toHaveLength(1);
    expect(result.current.paymentFailed).toBe(true);
    expect(result.current.hasEntities).toBe(true);
  });

  it("a failed transfers call does not take the list down", async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/transfers")) return reply(500, { error: "boom" });
      return reply(200, subscriptionsPage());
    });
    const { result } = renderHook(() => useSubscriptionsList({ today: TODAY }), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.transfers).toEqual([]);
    expect(result.current.active.length).toBeGreaterThan(0);
  });

  it("the API's 501 stub and its dark 404 read as sentences; reload tries again", async () => {
    fetchMock.mockResolvedValueOnce(reply(501, { error: "not_implemented" }));
    const { result } = renderHook(() => useSubscriptionsList({ today: TODAY }), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(LIST_NOT_WIRED_YET);

    fetchMock.mockResolvedValueOnce(reply(404, { error: "not_found" }));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe(LIST_SERVICE_DARK));
  });

  it("search filters the loaded list after a beat; sort re-orders it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve(fetchMock, [subscriptionsPage()], []);
    const { result } = renderHook(() => useSubscriptionsList({ today: TODAY }), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.setSearchInput("kestrel"));
    expect(result.current.active.length).toBe(ENTITIES.length - 1); // not yet
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 10);
    });
    expect(result.current.active.map((r) => r.entity.entity_name)).toEqual([
      "Kestrel Foods Limited",
    ]);

    act(() => result.current.setSearchInput("acme holdings"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 10);
    });
    expect(result.current.active).toEqual([]);
    expect(result.current.hasEntities).toBe(true); // the no-match state, not the empty one

    act(() => result.current.setSearchInput(""));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 10);
    });
    act(() => result.current.toggleSort("entity"));
    expect(result.current.active[0].entity.entity_name).toBe("Aetheria Capital Limited");
    act(() => result.current.toggleSort("entity"));
    expect(result.current.active[0].entity.entity_name).toBe("Willow Court Limited");
  });

  it("Start Trial asks first, then posts with the company's id and reloads", async () => {
    serve(fetchMock, [subscriptionsPage()], []);
    const { result } = renderHook(() => useSubscriptionsList({ today: TODAY }), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const harbour = ENTITIES[0];

    act(() => result.current.askStartTrial(harbour, "PETTY_CASH"));
    expect(result.current.trialPrompt).toMatchObject({
      code: "PETTY_CASH",
      moduleName: "Petty Cash",
    });
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("start-trial"))).toBe(false);

    const before = fetchMock.mock.calls.length;
    await act(() => result.current.confirmStartTrial());

    const post = fetchMock.mock.calls
      .slice(before)
      .find((c) => String(c[0]).includes("start-trial"));
    expect(post).toBeTruthy();
    expect(String(post![0])).toBe(`${API}/api/entities/${harbour.entity_id}/modules/start-trial`);
    expect(new Headers(post![1]?.headers).get("X-Entity-Id")).toBe(harbour.entity_id);
    expect(JSON.parse(String(post![1]?.body))).toEqual({ codes: ["PETTY_CASH"] });
    await waitFor(() => expect(result.current.trialPrompt).toBeNull());
    // reloaded afterwards
    await waitFor(() =>
      expect(
        fetchMock.mock.calls
          .slice(before)
          .filter((c) => String(c[0]).includes("/api/me/subscriptions?")).length,
      ).toBe(1),
    );
  });

  it("a refused trial is a toast and the prompt stays open", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/start-trial"))
        return reply(409, { error: "Module Petty Cash has already used its free trial." });
      if (url.pathname.endsWith("/transfers")) return reply(200, { transfers: [] });
      return reply(200, init ? subscriptionsPage() : subscriptionsPage());
    });
    const { result } = renderHook(() => useSubscriptionsList({ today: TODAY }), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.askStartTrial(ENTITIES[0], "PETTY_CASH"));
    await act(() => result.current.confirmStartTrial());
    expect(result.current.trialPrompt).not.toBeNull();
    expect(document.body.textContent).toContain(
      "Module Petty Cash has already used its free trial.",
    );
  });

  it("the seams land where the design points", async () => {
    serve(fetchMock, [subscriptionsPage()], INCOMING_TRANSFERS);
    const { result } = renderHook(() => useSubscriptionsList({ today: TODAY }), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    const e = ENTITIES[0];

    act(() => result.current.openRow(e));
    act(() => result.current.subscribe(e, "PAYMENT_REQUEST"));
    act(() => result.current.requestTransfer(e));
    act(() => result.current.cancelSubscription(e));
    act(() => result.current.reactivate(e));
    act(() => result.current.reviewTransfer(INCOMING_TRANSFERS[0]));
    act(() => result.current.updatePaymentMethod());
    act(() => result.current.back());

    expect(push.mock.calls.map((c) => c[0])).toEqual([
      `/subscription/entities/${e.entity_id}/modules`,
      `/subscription/entities/${e.entity_id}/modules/activate/PAYMENT_REQUEST`,
      `/subscription/subscriptions/subscriber?entity=${e.entity_id}`,
      `/subscription/entities/${e.entity_id}/modules/cancel`,
      `/subscription/entities/${e.entity_id}/modules/reactivate`,
      "/subscription/subscriptions/incoming?transfer=t-1",
      "/subscription/billing",
    ]);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("?fixture= serves a frame without the API outside production", async () => {
    const { result } = renderHook(() => useSubscriptionsList({ fixture: "B" }), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.hasEntities).toBe(false);
  });
});
