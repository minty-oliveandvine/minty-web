// The list's orchestration over a stubbed fetch: the pages are walked, the transfers ride
// along, search and sort work on the loaded list, Start Trial asks then posts with the
// company's id, and every seam lands where the design points.

import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";

import { RESULT_FIXTURES, TODAY, WALLET } from "@/features/subscription/__fixtures__/modulePage";
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
    // The page model is read before and after the trial starts (for the result's "what changed").
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (/^\/api\/entities\/[^/]+\/modules$/.test(url.pathname) && init?.method !== "POST")
        return reply(200, RESULT_FIXTURES.RV14.before);
      return base(input, init);
    });
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

    act(() => result.current.subscribe(e, "PAYMENT_REQUEST"));
    act(() => result.current.requestTransfer(e));
    act(() => result.current.reviewTransfer(INCOMING_TRANSFERS[0]));
    act(() => result.current.updatePaymentMethod());
    act(() => result.current.changePaymentMethod(e));
    act(() => result.current.back());

    const b = `/subscription/entities/${e.entity_id}/modules`;
    expect(push.mock.calls.map((c) => c[0])).toEqual([
      `${b}/activate/PAYMENT_REQUEST`,
      `/subscription/subscriptions/subscriber?entity=${e.entity_id}`,
      "/subscription/subscriptions/incoming?transfer=t-1",
      "/subscription/billing",
      `${b}/payment-method`,
    ]);
    expect(back).toHaveBeenCalledTimes(1);
  });

  /**
   * The open row over a stubbed company: its page model answers `before` until the actions
   * have been posted, `after` from then on; every action answers what the API would.
   */
  function serveChange(
    fetchMock: ReturnType<typeof vi.fn<typeof fetch>>,
    frame: keyof typeof RESULT_FIXTURES,
    answers: Record<string, { status: number; body: unknown }> = {},
  ) {
    const { before, after } = RESULT_FIXTURES[frame];
    const posts: { action: string; body: unknown; entity: string | null }[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/me/subscriptions/transfers") return reply(200, { transfers: [] });
      if (url.pathname === "/api/me/subscriptions") return reply(200, subscriptionsPage());
      if (url.pathname === "/api/me/billing/entity-payment-method") return reply(200, WALLET);
      const m = /^\/api\/entities\/[^/]+\/modules(?:\/(.+))?$/.exec(url.pathname);
      if (m && init?.method === "POST") {
        const action = m[1]!;
        posts.push({
          action,
          body: init.body ? JSON.parse(String(init.body)) : null,
          entity: new Headers(init.headers).get("X-Entity-Id"),
        });
        const a = answers[action];
        return a ? reply(a.status, a.body) : reply(200, { ok: true });
      }
      if (m) return reply(200, posts.length > 0 ? after : before);
      return reply(404, { error: "not_found" });
    });
    return posts;
  }

  it("Confirm Subscription Change applies the ticks - one action per module - and lands on the result row", async () => {
    const posts = serveChange(fetchMock, "RU23");
    const e = ENTITIES[0];
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));

    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    act(() => result.current.summary.toggleTick("PAYMENT_REQUEST"));
    const change = result.current.summary.view!.pendingChange!;
    expect(change.codes).toEqual(["PETTY_CASH", "PAYMENT_REQUEST"]);
    // Section 06: the button asks first - the bundle's modal here - and its Confirm applies.
    act(() => result.current.confirmChange(e, change));
    expect(result.current.changePrompt?.modal.kind).toBe("bundle");
    expect(posts).toEqual([]);
    await act(() => result.current.applyChangePrompt());
    expect(result.current.changePrompt).toBeNull();

    // The company's consent for its trial, then the lapsed trial bought back - with the id.
    expect(posts.map((p) => [p.action, p.body])).toEqual([
      ["authorize-billing", {}],
      ["restart-billing", { codes: ["PAYMENT_REQUEST"] }],
    ]);
    expect(posts.every((p) => p.entity === e.entity_id)).toBe(true);
    expect(result.current.result?.entity.entity_id).toBe(e.entity_id);
    expect(result.current.result?.result.kind).toBe("celebrate");
    expect(result.current.result?.result.lines.map((l) => l.text)).toEqual([
      "Petty Cash is confirmed. Billing starts the day its trial ends.",
      "Payment Request is active. Your card has been charged.",
    ]);
    expect(result.current.openEntityId).toBe(e.entity_id);
    expect(push).not.toHaveBeenCalled();

    // Back to Manage Subscriptions leaves for the portal's landing (08-A). This list is on its
    // way out, so it does not read itself again on the way.
    const listCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/api/me/subscriptions?"),
    ).length;
    act(() => result.current.dismissResult());
    expect(push).toHaveBeenCalledWith("/subscription");
    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/me/subscriptions?")).length,
    ).toBe(listCalls);
  });

  it("a removal posts cancel and lands on the page layout, the row closed", async () => {
    const posts = serveChange(fetchMock, "RV44");
    const e = ENTITIES[0];
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    act(() => result.current.confirmChange(e, result.current.summary.view!.pendingChange!));
    expect(result.current.changePrompt?.modal.kind).toBe("remove");
    await act(() => result.current.applyChangePrompt());
    expect(posts.map((p) => [p.action, p.body])).toEqual([["cancel", { code: "PETTY_CASH" }]]);
    expect(result.current.result?.result.kind).toBe("module_cancelled");
    expect(result.current.result?.result.layout).toBe("page");
    expect(result.current.openEntityId).toBeNull();
  });

  it("a trial confirmed with no card at all goes to Stripe's card form instead", async () => {
    const posts = serveChange(fetchMock, "RU22", {
      "payment-method": { status: 200, body: { url: "https://stripe.test/setup" } },
    });
    const left: string[] = [];
    _resetHandoffForTests((url) => left.push(url));
    const e = ENTITIES[0];
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    act(() => result.current.confirmChange(e, result.current.summary.view!.pendingChange!));
    expect(result.current.changePrompt?.modal.kind).toBe("activate");
    await act(() => result.current.applyChangePrompt());
    expect(posts.map((p) => p.action)).toEqual(["payment-method"]);
    expect(left).toEqual(["https://stripe.test/setup"]);
    expect(result.current.result).toBeNull();
    _resetHandoffForTests();
  });

  it("06·B: a suspension reactivated pays the invoice; the bank declining asks to try again", async () => {
    const answers: Record<string, { status: number; body: unknown }> = {
      "retry-payment": {
        status: 200,
        body: {
          ok: false,
          status: "failed",
          message: "That card was declined: insufficient funds",
        },
      },
    };
    const posts = serveChange(fetchMock, "RV61", answers);
    const e = ENTITIES[0];
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    act(() => result.current.confirmChange(e, result.current.summary.view!.pendingChange!));
    expect(result.current.changePrompt?.modal.kind).toBe("reactivate");
    await act(() => result.current.applyChangePrompt());
    expect(posts.map((p) => [p.action, p.body])).toEqual([["retry-payment", {}]]);
    // "Payment could not be processed": the API's sentence, a scheduled retry follows, the
    // ticks stay pending, nothing landed, no toast.
    expect(result.current.declined).toMatchObject({
      message: "That card was declined: insufficient funds",
      autoRetry: true,
    });
    expect(result.current.result).toBeNull();
    expect(result.current.summary.view?.pendingChange?.codes).toEqual(["PETTY_CASH"]);
    expect(document.body.textContent).not.toContain("That card was declined");

    // Try again now: the same change, applied again - this time the bank says yes.
    answers["retry-payment"] = { status: 200, body: { ok: true, status: "paid", message: "" } };
    await act(() => result.current.retryDeclined());
    expect(posts.map((p) => p.action)).toEqual(["retry-payment", "retry-payment"]);
    expect(result.current.declined).toBeNull();
    expect(result.current.result?.result.kind).toBe("celebrate");
  });

  it("06·B: Done on the declined modal keeps the ticks pending; a purchase's 402 asks the same way", async () => {
    const posts = serveChange(fetchMock, "RU23", {
      "restart-billing": {
        status: 402,
        body: {
          error:
            "We couldn't set up the subscription. Please check your payment method and try again.",
        },
      },
    });
    // RU23's trial has a card: consent is given, then the lapsed trial's charge is declined.
    const e = ENTITIES[0];
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    act(() => result.current.summary.toggleTick("PAYMENT_REQUEST"));
    act(() => result.current.confirmChange(e, result.current.summary.view!.pendingChange!));
    await act(() => result.current.applyChangePrompt());
    expect(posts.map((p) => p.action)).toEqual(["authorize-billing", "restart-billing"]);
    expect(result.current.declined).toMatchObject({ autoRetry: false });
    expect(result.current.declined?.message).toMatch(/couldn't set up the subscription/);
    act(() => result.current.dismissDeclined());
    expect(result.current.declined).toBeNull();
    expect(result.current.changePrompt).toBeNull();
    expect(result.current.summary.view?.pendingChange?.codes).toEqual([
      "PETTY_CASH",
      "PAYMENT_REQUEST",
    ]);
  });

  it("06·B: leaving the open row with ticks pending asks first; Discard drops them and goes", async () => {
    serveChange(fetchMock, "RV44");
    const [first, second] = ENTITIES;
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: first.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    // Nothing pending: the row simply closes and opens.
    act(() => result.current.toggleRow(first));
    expect(result.current.openEntityId).toBeNull();
    act(() => result.current.toggleRow(first));
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    expect(result.current.summary.view?.pendingChange).not.toBeNull();

    // Closing the row, opening another, going back, another company's ⋮: all ask first.
    act(() => result.current.closeRow());
    expect(result.current.leavePrompt).not.toBeNull();
    expect(result.current.openEntityId).toBe(first.entity_id);
    act(() => result.current.stay());
    expect(result.current.leavePrompt).toBeNull();
    expect(result.current.summary.view?.pendingChange).not.toBeNull();

    act(() => result.current.back());
    expect(result.current.leavePrompt).not.toBeNull();
    expect(back).not.toHaveBeenCalled();
    act(() => result.current.stay());

    act(() => result.current.cancelSubscription(second));
    expect(result.current.leavePrompt).not.toBeNull();
    expect(result.current.openEntityId).toBe(first.entity_id);
    act(() => result.current.stay());

    act(() => result.current.toggleRow(second));
    expect(result.current.leavePrompt).not.toBeNull();
    act(() => result.current.discardAndLeave());
    expect(result.current.leavePrompt).toBeNull();
    expect(result.current.openEntityId).toBe(second.entity_id);
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    expect(result.current.summary.view?.pendingChange ?? null).toBeNull();
  });

  it("an action the API refuses is said in a toast, and the row is read again", async () => {
    const posts = serveChange(fetchMock, "RV44", {
      cancel: { status: 409, body: { error: "Module Petty Cash isn't active." } },
    });
    const e = ENTITIES[0];
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    act(() => result.current.confirmChange(e, result.current.summary.view!.pendingChange!));
    await act(() => result.current.applyChangePrompt());
    expect(posts.map((p) => p.action)).toEqual(["cancel"]);
    expect(result.current.result).toBeNull();
    expect(document.body.textContent).toContain("Module Petty Cash isn't active.");
  });

  it("05·D: the ⋮'s Cancel subscription on a CLOSED row opens it, unticks every active module and asks", async () => {
    const posts = serveChange(fetchMock, "RV45");
    const e = ENTITIES[0];
    const { result } = renderHook(() => useSubscriptionsList({ today: TODAY }), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.openEntityId).toBeNull();

    await act(() => {
      result.current.cancelSubscription(e);
    });
    // The page model was read for the change, the row is open, the modal asks.
    await waitFor(() => expect(result.current.changePrompt).not.toBeNull());
    expect(result.current.openEntityId).toBe(e.entity_id);
    expect(result.current.changePrompt?.modal.kind).toBe("cancel_subscription");
    expect(result.current.changePrompt?.change.codes).toEqual(["PETTY_CASH"]);
    expect(posts).toEqual([]);
    // The row shows the ticks pending, once its own read is in.
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    expect(result.current.summary.view?.pendingChange?.codes).toEqual(["PETTY_CASH"]);
    expect(result.current.summary.view?.modules[0].chip).toBe("Removing");

    await act(() => result.current.applyChangePrompt());
    expect(posts.map((p) => [p.action, p.body])).toEqual([["cancel", { code: "PETTY_CASH" }]]);
    expect(result.current.result?.result.kind).toBe("module_cancelled");
  });

  it("05·D: Reactivate on the OPEN row ticks every module that is not active and asks", async () => {
    const posts = serveChange(fetchMock, "RW45");
    const e = ENTITIES[0];
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    const reads = fetchMock.mock.calls.filter((c) => /\/modules$/.test(String(c[0]))).length;
    await act(() => {
      result.current.reactivate(e);
    });
    await waitFor(() => expect(result.current.changePrompt).not.toBeNull());
    // The open row's page model served the change: nothing was read again.
    expect(fetchMock.mock.calls.filter((c) => /\/modules$/.test(String(c[0]))).length).toBe(reads);
    expect(result.current.changePrompt?.modal.kind).toBe("bundle");
    expect(result.current.changePrompt?.change.codes).toEqual(["PAYMENT_REQUEST"]);
    expect(result.current.summary.view?.modules[1].chip).toBe("Restoring");
    await act(() => result.current.applyChangePrompt());
    expect(posts.map((p) => [p.action, p.body])).toEqual([["renew", { code: "PAYMENT_REQUEST" }]]);
    expect(result.current.result?.result.kind).toBe("celebrate");
  });

  it("05·D: an item with nothing to change says so and opens the row", async () => {
    serveChange(fetchMock, "RV44");
    const e = ENTITIES[0];
    const { result } = renderHook(() => useSubscriptionsList({ today: TODAY }), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    await act(() => {
      result.current.reactivate(e);
    });
    await waitFor(() => expect(document.body.textContent).toContain("Nothing to reactivate here"));
    expect(result.current.changePrompt).toBeNull();
    expect(result.current.openEntityId).toBe(e.entity_id);
  });

  it("Go back on the modal posts nothing and keeps the ticks pending", async () => {
    const posts = serveChange(fetchMock, "RV44");
    const e = ENTITIES[0];
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    act(() => result.current.confirmChange(e, result.current.summary.view!.pendingChange!));
    expect(result.current.changePrompt).not.toBeNull();
    act(() => result.current.dismissChangePrompt());
    expect(result.current.changePrompt).toBeNull();
    expect(posts).toEqual([]);
    expect(result.current.summary.view?.pendingChange?.codes).toEqual(["PETTY_CASH"]);
    expect(result.current.result).toBeNull();
  });

  it("Start Trial lands on the result row too", async () => {
    const posts = serveChange(fetchMock, "RV14");
    const e = ENTITIES[0];
    const { result } = renderHook(() => useSubscriptionsList({ today: TODAY }), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.askStartTrial(e, "PETTY_CASH"));
    await act(() => result.current.confirmStartTrial());
    expect(posts.map((p) => [p.action, p.body])).toEqual([
      ["start-trial", { codes: ["PETTY_CASH"] }],
    ]);
    expect(result.current.trialPrompt).toBeNull();
    expect(result.current.result?.entity.entity_id).toBe(e.entity_id);
    expect(result.current.result?.result.lines.map((l) => l.text)).toEqual([
      "Petty Cash free trial has started — 30 days, free.",
    ]);
    expect(result.current.result?.result.money).toBe("HK$280 a month.");
    expect(result.current.openEntityId).toBe(e.entity_id);
  });

  it("?result= lands the open row on a 05·C frame outside production", async () => {
    const { result } = renderHook(
      () =>
        useSubscriptionsList({
          fixture: "A",
          focusEntityId: ENTITIES[0].entity_id,
          resultFixture: "RV41",
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.result?.result.kind).toBe("subscription_cancelled"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a row opens in place, one at a time, and ?entity= opens that one", async () => {
    serve(fetchMock, [subscriptionsPage()], INCOMING_TRANSFERS);
    const [first, second] = ENTITIES;
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: first.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    // Opened by the URL, and its summary is fetched (the page model + the card). The stand-in
    // answer here is not a page model: the row reports that with its retry, nothing crashes.
    expect(result.current.openEntityId).toBe(first.entity_id);
    await waitFor(() => expect(result.current.summary.status).toBe("error"));
    expect(result.current.summary.view).toBeNull();
    expect(push).not.toHaveBeenCalled();

    act(() => result.current.toggleRow(second));
    expect(result.current.openEntityId).toBe(second.entity_id);
    act(() => result.current.toggleRow(second));
    expect(result.current.openEntityId).toBeNull();
    act(() => result.current.toggleRow(first));
    act(() => result.current.closeRow());
    expect(result.current.openEntityId).toBeNull();
    expect(result.current.summary.status).toBe("idle");
  });

  it("?fixture= serves a frame without the API outside production", async () => {
    const { result } = renderHook(() => useSubscriptionsList({ fixture: "B" }), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.hasEntities).toBe(false);
  });
});
