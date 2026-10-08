// The list's orchestration over a stubbed fetch: the pages are walked, the transfers ride
// along, search and sort work on the loaded list, Start Trial asks then posts with the
// company's id, and every seam lands where the design points.

import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { getAuth, setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";

import {
  RESULT_FIXTURES,
  SUMMARY_FIXTURES,
  TODAY,
  WALLET,
} from "@/features/subscription/__fixtures__/modulePage";
import {
  ENTITIES,
  INCOMING_TRANSFERS,
  subscriptionsPage,
} from "@/features/subscription/__fixtures__/subscriptions";
import { ACCOUNTS, ACCOUNTS_OPENED } from "@/features/subscription/__fixtures__/billing";
import type { BillingAccounts, PortalEntity } from "@/features/subscription/api/payerPortal";
import { NO_CARD_FOR_TRIAL } from "@/features/subscription/lib/billingAccounts";
import {
  LIST_NOT_WIRED_YET,
  SEARCH_DEBOUNCE_MS,
  useSubscriptionsList,
  type UseSubscriptionsListResult,
} from "@/features/subscription/hooks/useSubscriptionsList";

/** "Change billing account" - the Billing Accounts sheet puts the company on the one picked. */
const MOVE = "accounts/move";

const push = vi.fn();
const back = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back }),
}));

const API = env.SUBSCRIPTION_API_URL;

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

  it("the API's 501 stub reads as a sentence, a 404 as its own; reload tries again", async () => {
    fetchMock.mockResolvedValueOnce(reply(501, { error: "not_implemented" }));
    const { result } = renderHook(() => useSubscriptionsList({ today: TODAY }), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(LIST_NOT_WIRED_YET);

    fetchMock.mockResolvedValueOnce(reply(404, { error: "That company isn't on your account." }));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.error).toBe("That company isn't on your account."));
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
    act(() => result.current.back());

    expect(push.mock.calls.map((c) => c[0])).toEqual([
      `/subscription/subscriptions?entity=${e.entity_id}&tick=PAYMENT_REQUEST`,
      `/subscription/subscriptions/subscriber?entity=${e.entity_id}`,
      "/subscription/subscriptions/incoming?transfer=t-1",
      // The banner names the first company whose payment failed; the billing page opens the
      // account THAT company is on - the card that needs fixing.
      "/subscription/billing?entity=e-willow-court-limited",
    ]);
    // The panel's Change is not a seam any more: it opens "Billing Accounts" in place.
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
    accounts: BillingAccounts = ACCOUNTS,
  ) {
    const { before, after } = RESULT_FIXTURES[frame];
    const posts: { action: string; body: unknown; entity: string | null }[] = [];
    // The page model answers `after` once a MODULE action is in - the account move is not one.
    const acted = () => posts.some((p) => p.action !== MOVE);
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/me/subscriptions/transfers") return reply(200, { transfers: [] });
      if (url.pathname === "/api/me/subscriptions") return reply(200, subscriptionsPage());
      if (url.pathname === "/api/me/billing/entity-payment-method") return reply(200, WALLET);
      if (url.pathname === "/api/me/billing/accounts") return reply(200, accounts);
      if (url.pathname === `/api/me/billing/${MOVE}` && init?.method === "POST") {
        posts.push({ action: MOVE, body: JSON.parse(String(init.body)), entity: null });
        const a = answers[MOVE];
        return a ? reply(a.status, a.body) : reply(200, { ...accounts, moved: null });
      }
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
      if (m) return reply(200, acted() ? after : before);
      return reply(404, { error: "not_found" });
    });
    return posts;
  }

  /**
   * Hold every MODULE action's answer (the payment) until the release is called: what is on the
   * screen meanwhile is the point. The action is still recorded when it is posted; the account
   * move is not held.
   */
  function holdPayment(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>) {
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const answer = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      const res = await answer(input, init);
      const path = new URL(String(input)).pathname;
      if (init?.method === "POST" && /^\/api\/entities\/[^/]+\/modules\//.test(path)) await held;
      return res;
    });
    return release;
  }

  /**
   * Confirm Subscription Change on a change that bills: its modal asks first, and its Confirm
   * opens the Billing Accounts sheet, answered on the account it preselects. The list fixture's
   * first company is on no account, so that is the first one that can take it: Company A (Visa 4121).
   */
  async function confirmBilled(
    result: { current: UseSubscriptionsListResult },
    entity: (typeof ENTITIES)[number],
  ) {
    await act(async () => {
      result.current.confirmChange(entity, result.current.summary.view!.pendingChange!);
    });
    expect(result.current.changePrompt).not.toBeNull();
    expect(result.current.accountStep).toBeNull();
    await act(() => result.current.applyChangePrompt());
    await waitFor(() => expect(result.current.accountStep).not.toBeNull());
    expect(result.current.changePrompt).toBeNull();
    expect(result.current.accountStep?.picked).toBe("acc-company-a");
    await act(() => result.current.confirmAccount(result.current.accountStep!.picked!));
  }

  it("after a successful change the row is read again - a stale CTA cannot linger", async () => {
    // The bug: `after` was fetched only to say what CHANGED, so the open row kept the BEFORE
    // page model and a reactivated module went on offering "Reactivate Subscription"
    // underneath the result. Every other exit from `apply` reloaded; the successful one did not.
    serveChange(fetchMock, "RU23");
    const e = ENTITIES[0];
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    const was = result.current.summary.view!.modules.find((m) => m.code === "PAYMENT_REQUEST")!;
    expect(was.view.state).not.toBe("active");

    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    act(() => result.current.summary.toggleTick("PAYMENT_REQUEST"));
    await confirmBilled(result, e);

    await waitFor(() => {
      const now = result.current.summary.view?.modules.find((m) => m.code === "PAYMENT_REQUEST");
      expect(now?.view.state).toBe("active");
    });
  });

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
    // The change's modal asks first ("You have unlocked Super Minty"); nothing is read or posted.
    await act(async () => result.current.confirmChange(e, change));
    expect(result.current.changePrompt?.modal.kind).toBe("bundle");
    expect(result.current.accountStep).toBeNull();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/billing/accounts"))).toBe(
      false,
    );
    // It bills: its Confirm opens "Billing Accounts", the first account that can take the
    // company preselected - and the modal gives way to it.
    await act(() => result.current.applyChangePrompt());
    await waitFor(() => expect(result.current.accountStep).not.toBeNull());
    expect(result.current.changePrompt).toBeNull();
    expect(result.current.accountStep).toMatchObject({
      picked: "acc-company-a",
      error: null,
      lead: `Choose the account that pays for ${e.entity_name}.`,
    });
    expect(result.current.accountStep?.targets.map((t) => [t.account.id, t.block])).toEqual([
      ["acc-company-a", null],
      ["acc-vine", null],
      ["acc-legacy", "in_dunning"],
    ]);
    expect(posts).toEqual([]);
    await act(() => result.current.confirmAccount("acc-vine"));
    expect(result.current.accountStep).toBeNull();
    expect(result.current.changePrompt).toBeNull();

    // The company goes on the account picked FIRST; then its consent for its trial, then the
    // lapsed trial bought back - each with the company's id.
    expect(posts.map((p) => [p.action, p.body])).toEqual([
      [MOVE, { entity: e.entity_id, account: "acc-vine" }],
      ["authorize-billing", {}],
      ["restart-billing", { codes: ["PAYMENT_REQUEST"] }],
    ]);
    expect(posts.filter((p) => p.action !== MOVE).every((p) => p.entity === e.entity_id)).toBe(
      true,
    );
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

  it("Back to Manage Subscriptions trades a company's token for an unscoped one", async () => {
    // Arrived from the module settings page, the token names the company. The portal is the
    // payer's: Back goes through Flask's handoff with NO company, which mints an unscoped token
    // and lands on 08-A, rather than carrying the company's scope into the portal.
    serveChange(fetchMock, "RV44");
    const e = ENTITIES[0];
    const claims = btoa(JSON.stringify({ user_id: "u1", entity_id: e.entity_id })).replace(/=+$/, "");
    setAuth(`h.${claims}.s`, e.entity_id, e.entity_name);
    const left: string[] = [];
    _resetHandoffForTests((url) => left.push(url));
    const { result } = renderHook(() => useSubscriptionsList({ today: TODAY }), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.dismissResult());
    expect(left).toEqual([`${env.PETTY_CASH_URL}/handoff/minty-web?next=%2Fsubscription`]);
    expect(push).not.toHaveBeenCalled();
    // The company's token is dropped on the way out; the landing stores the new one.
    expect(getAuth()).toBeNull();
    _resetHandoffForTests();
  });

  it("Billing Accounts stays up, busy, until the payment has answered - then the modal takes its place", async () => {
    // The bug: the sheet closed as soon as the company was on the account, and the payment ran
    // with nothing on the screen until "You have unlocked …" appeared.
    const refusal =
      "A payment on Vine Consulting Limited didn't go through. Settle it before moving a company onto it.";
    const answers: Record<string, { status: number; body: unknown }> = {
      [MOVE]: { status: 409, body: { error: refusal } },
    };
    const posts = serveChange(fetchMock, "RU23", answers);
    const release = holdPayment(fetchMock);
    const e = ENTITIES[0];
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    act(() => result.current.summary.toggleTick("PAYMENT_REQUEST"));
    await act(async () =>
      result.current.confirmChange(e, result.current.summary.view!.pendingChange!),
    );
    await act(() => result.current.applyChangePrompt());
    await waitFor(() => expect(result.current.accountStep).not.toBeNull());
    await act(() => result.current.confirmAccount("acc-vine"));
    expect(result.current.accountStep?.error).toBe(refusal);

    // Another account: the last refusal goes, and the sheet stays up and busy through the move
    // AND the payment - nothing closes it, nothing has landed.
    delete answers[MOVE];
    let confirming!: Promise<void>;
    act(() => {
      confirming = result.current.confirmAccount("acc-company-a");
    });
    await waitFor(() =>
      expect(posts.map((p) => p.action)).toEqual([MOVE, MOVE, "authorize-billing"]),
    );
    expect(result.current.accountStep).toMatchObject({ error: null });
    expect(result.current.changeBusy).toBe(true);
    act(() => result.current.dismissAccountStep());
    expect(result.current.accountStep).not.toBeNull();
    expect(result.current.result).toBeNull();

    // Paid: the sheet gives way to the result.
    release();
    await act(() => confirming);
    expect(result.current.accountStep).toBeNull();
    expect(result.current.changeBusy).toBe(false);
    expect(result.current.changePrompt).toBeNull();
    expect(result.current.result?.result.kind).toBe("celebrate");
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
    // A cancellation bills nothing: asked with its modal first, no Billing Accounts sheet, no
    // account read, no move - and no modal after it either.
    expect(result.current.accountStep).toBeNull();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/billing/accounts"))).toBe(
      false,
    );
    expect(posts.map((p) => [p.action, p.body])).toEqual([["cancel", { code: "PETTY_CASH" }]]);
    expect(result.current.result?.result.kind).toBe("module_cancelled");
    expect(result.current.result?.result.layout).toBe("page");
    expect(result.current.openEntityId).toBeNull();
  });

  it("a trial with no card at all is put on the account picked and confirmed on its card", async () => {
    // RU22's trial has no card: once that meant Stripe's form. Picked onto an account that
    // has one, it is confirmed on that card - the page read before the modal is out of date.
    const posts = serveChange(fetchMock, "RU22");
    const left: string[] = [];
    _resetHandoffForTests((url) => left.push(url));
    const e = ENTITIES[0];
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    await confirmBilled(result, e);
    expect(posts.map((p) => p.action)).toEqual([MOVE, "authorize-billing"]);
    expect(left).toEqual([]);
    expect(result.current.result?.entity.entity_id).toBe(e.entity_id);
    expect(result.current.result?.result.kind).toBe("celebrate");
    _resetHandoffForTests();
  });

  /**
   * No card to charge: "Billing Accounts" is asked AGAIN for the same change, with the sentence
   * as its error - never Stripe's hosted page (the user, 2026-10-01). What every case checks.
   */
  function expectAskedAgain(
    result: { current: UseSubscriptionsListResult },
    left: string[],
    error: string,
    codes: string[],
  ) {
    expect(result.current.accountStep?.error).toBe(error);
    expect(left).toEqual([]);
    expect(push).not.toHaveBeenCalled();
    expect(result.current.result).toBeNull();
    expect(result.current.declined).toBeNull();
    expect(result.current.changePrompt).toBeNull();
    expect(result.current.changeBusy).toBe(false);
    // The ticks are still pending: the summary was not read again in between.
    expect(result.current.summary.view?.pendingChange?.codes).toEqual(codes);
  }

  it("an account with no card it can charge asks Billing Accounts again - never Stripe's page", async () => {
    // The company's own account is always pickable, card or not; with none, the consent would
    // sit on nothing. It used to send the browser to Stripe's card form (`payment-method`); a
    // card is only ever added through a billing account now, so the sheet comes back saying so,
    // the cardless account shut, "New billing account" the way to add one.
    const e = ENTITIES[0];
    const [companyA] = ACCOUNTS.accounts;
    const cardless = {
      ...ACCOUNTS,
      accounts: [
        {
          ...companyA,
          card: null,
          companies: [{ entity_id: e.entity_id, entity_name: e.entity_name, past_due: false }],
        },
      ],
    };
    const posts = serveChange(fetchMock, "RU22", {}, cardless);
    const left: string[] = [];
    _resetHandoffForTests((url) => left.push(url));
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    const accountReads = () =>
      fetchMock.mock.calls.filter(
        (c) => new URL(String(c[0])).pathname === "/api/me/billing/accounts",
      ).length;
    await confirmBilled(result, e);
    // Moved onto it, then nothing posted for the trial: there is no card for the consent.
    expect(posts.map((p) => p.action)).toEqual([MOVE]);
    expectAskedAgain(result, left, NO_CARD_FOR_TRIAL, ["PETTY_CASH"]);
    // Read fresh for the second ask, the cardless account now shut and nothing preselected.
    expect(accountReads()).toBe(2);
    expect(result.current.accountStep?.targets.map((t) => [t.account.id, t.block])).toEqual([
      ["acc-company-a", "no_card"],
    ]);
    expect(result.current.accountStep?.picked).toBeNull();
    _resetHandoffForTests();
  });

  it("authorize-billing's 402 'Choose a billing account' asks Billing Accounts again", async () => {
    // The API no longer falls back to the payer's default card when the company is on no
    // account; its refusal must open the picker, not read as a decline or a toast.
    const said = "Choose a billing account for this company.";
    const posts = serveChange(fetchMock, "RU22", {
      "authorize-billing": { status: 402, body: { error: said } },
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
    await confirmBilled(result, e);
    expect(posts.map((p) => p.action)).toEqual([MOVE, "authorize-billing"]);
    expectAskedAgain(result, left, said, ["PETTY_CASH"]);
    _resetHandoffForTests();
  });

  it("retry-payment's no_card asks Billing Accounts again with the API's sentence", async () => {
    const said = "There is no card on this billing account to charge.";
    const posts = serveChange(fetchMock, "RV61", {
      "retry-payment": { status: 200, body: { ok: false, status: "no_card", message: said } },
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
    await confirmBilled(result, e);
    expect(posts.map((p) => p.action)).toEqual([MOVE, "retry-payment"]);
    expectAskedAgain(result, left, said, ["PETTY_CASH"]);
    // An account that can pay is preselected; the one in dunning stays shut.
    expect(result.current.accountStep?.picked).toBe("acc-company-a");
    expect(result.current.accountStep?.targets.find((t) => t.account.id === "acc-legacy")?.block).toBe(
      "in_dunning",
    );
    _resetHandoffForTests();
  });

  it("restart-billing's 402 'Choose a card' asks Billing Accounts again - a decline is still 06·B", async () => {
    const said = "Choose a card before restarting billing.";
    const posts = serveChange(fetchMock, "RU23", {
      "restart-billing": { status: 402, body: { error: said } },
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
    act(() => result.current.summary.toggleTick("PAYMENT_REQUEST"));
    await confirmBilled(result, e);
    expect(posts.map((p) => p.action)).toEqual([MOVE, "authorize-billing", "restart-billing"]);
    expectAskedAgain(result, left, said, ["PETTY_CASH", "PAYMENT_REQUEST"]);
    // Asked again, the account picked carries the change on - nothing else to press first.
    await act(() => result.current.confirmAccount("acc-vine"));
    expect(posts.map((p) => p.action).slice(3)).toEqual([MOVE, "authorize-billing", "restart-billing"]);
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
    await confirmBilled(result, e);
    expect(posts.map((p) => [p.action, p.body])).toEqual([
      [MOVE, { entity: e.entity_id, account: "acc-company-a" }],
      ["retry-payment", {}],
    ]);
    // "Payment could not be processed": the API's sentence, a scheduled retry follows, the
    // ticks stay pending, nothing landed, no toast - and it names the card of the account
    // picked, not whichever one the summary showed before.
    expect(result.current.declined).toMatchObject({
      message: "That card was declined: insufficient funds",
      autoRetry: true,
    });
    expect(result.current.declined?.prompt.card).toBe("Visa 4121");
    // The sheet gave way to it.
    expect(result.current.accountStep).toBeNull();
    expect(result.current.result).toBeNull();
    // Not paid: the reactivation's own modal does not show.
    expect(result.current.summary.view?.pendingChange?.codes).toEqual(["PETTY_CASH"]);
    expect(document.body.textContent).not.toContain("That card was declined");

    // Try again now: the same change, applied again - the account is already set, so it is not
    // asked or moved again - and this time the bank says yes. 06·B stays up, busy, while it is
    // tried; it does not vanish and leave the page saying nothing.
    answers["retry-payment"] = { status: 200, body: { ok: true, status: "paid", message: "" } };
    const release = holdPayment(fetchMock);
    let retrying!: Promise<void>;
    act(() => {
      retrying = result.current.retryDeclined();
    });
    await waitFor(() =>
      expect(posts.map((p) => p.action)).toEqual([MOVE, "retry-payment", "retry-payment"]),
    );
    expect(result.current.declined).not.toBeNull();
    expect(result.current.changeBusy).toBe(true);
    act(() => result.current.dismissDeclined());
    expect(result.current.declined).not.toBeNull();
    release();
    await act(() => retrying);
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
    await confirmBilled(result, e);
    expect(posts.map((p) => p.action)).toEqual([MOVE, "authorize-billing", "restart-billing"]);
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

  /** The list, plus one company's page model - what an arrival with `?tick=` reads. */
  function serveRow(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, page: unknown) {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/me/subscriptions/transfers") return reply(200, { transfers: [] });
      if (url.pathname === "/api/me/subscriptions") return reply(200, subscriptionsPage());
      if (url.pathname === "/api/me/billing/entity-payment-method") return reply(200, WALLET);
      if (/^\/api\/entities\/[^/]+\/modules$/.test(url.pathname)) return reply(200, page);
      return reply(404, { error: "not_found" });
    });
  }

  it("arriving from Activate Subscription opens the row with that module ticked", async () => {
    // M31: Petty Cash's trial expired - ticking it is the `subscribe` seam.
    serveRow(fetchMock, SUMMARY_FIXTURES.M31);
    const e = ENTITIES[0];
    const { result } = renderHook(
      () =>
        useSubscriptionsList({ focusEntityId: e.entity_id, tickCode: "PETTY_CASH", today: TODAY }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.openEntityId).toBe(e.entity_id);

    // The tick waits for the row's own read: before it, there is nothing to tick against.
    await waitFor(() => expect(result.current.summary.view?.pendingChange).toBeTruthy());
    expect(result.current.summary.view?.pendingChange).toMatchObject({
      code: "PETTY_CASH",
      seam: "subscribe",
    });
    expect(result.current.summary.view?.modules[0]).toMatchObject({
      tick: "ticked",
      chip: "Adding",
    });
    // Arriving posts nothing and asks nothing - the person confirms.
    expect(result.current.changePrompt).toBeNull();
    expect(fetchMock.mock.calls.every((c) => (c[1]?.method ?? "GET") === "GET")).toBe(true);
  });

  // A trial establishes no SUBSCRIBER, so Activate Subscription takes Confirm Subscription
  // Change's slot - and asks in the SAME section-06 modal (the user, 2026-10-08).
  /** `serveRow` plus the billing accounts the picker reads. */
  function serveRowAndAccounts(page: unknown) {
    serveRow(fetchMock, page);
    const inner = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      if (new URL(String(input)).pathname === "/api/me/billing/accounts")
        return reply(200, ACCOUNTS);
      return inner(input, init);
    });
  }

  it("Activate Subscription asks in the change modal, then Billing Accounts", async () => {
    serveRowAndAccounts(SUMMARY_FIXTURES.M31);
    const e = { ...ENTITIES[0], subscriber: null, has_subscriber: false };
    const { result } = renderHook(
      () =>
        useSubscriptionsList({ focusEntityId: e.entity_id, tickCode: "PETTY_CASH", today: TODAY }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.view?.pendingChange).toBeTruthy());
    const change = result.current.summary.view!.pendingChange!;

    act(() => result.current.activateChange(e, change));

    // The modal first - nothing is read about accounts and nothing is posted yet.
    await waitFor(() => expect(result.current.changePrompt).toBeTruthy());
    expect(result.current.changePrompt?.activate).toBe(true);
    expect(result.current.accountStep).toBeNull();

    // Its Confirm opens Billing Accounts, asked for the ACTIVATION.
    await act(async () => {
      await result.current.applyChangePrompt();
    });
    await waitFor(() => expect(result.current.accountStep).toBeTruthy());
    expect(result.current.changePrompt).toBeNull();
    expect(fetchMock.mock.calls.every((c) => (c[1]?.method ?? "GET") === "GET")).toBe(true);
  });

  /** Serve the row, the accounts, and a per-action answer for the POSTs. */
  function serveActivate(answers: Record<string, { status: number; body: unknown }> = {}) {
    const posts: { action: string; body: unknown }[] = [];
    serveRowAndAccounts(SUMMARY_FIXTURES.M31);
    const inner = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      const action = url.pathname.split("/").pop() ?? "";
      if (init?.method === "POST") {
        posts.push({ action, body: JSON.parse(String(init.body ?? "{}")) });
        const said = answers[action];
        return reply(said?.status ?? 200, said?.body ?? { ok: true });
      }
      return inner(input, init);
    });
    return posts;
  }

  /** Press Activate on a ticked row, confirm its modal, and pick the account. */
  async function activateThroughSheet(
    result: { current: ReturnType<typeof useSubscriptionsList> },
    e: PortalEntity,
  ) {
    const change = result.current.summary.view!.pendingChange!;
    act(() => result.current.activateChange(e, change));
    await waitFor(() => expect(result.current.changePrompt).toBeTruthy());
    await act(async () => {
      await result.current.applyChangePrompt();
    });
    await waitFor(() => expect(result.current.accountStep).toBeTruthy());
    await act(async () => {
      await result.current.confirmAccount("acc-company-a");
    });
  }

  it("activating applies the ticks in the same pass, on the account just picked", async () => {
    // The user, 2026-10-08: the modal said "you've chosen X", so X happens. M31's Petty Cash
    // trial has expired, so the tick is the `subscribe` seam - which CHARGES.
    const posts = serveActivate();
    const e = { ...ENTITIES[0], subscriber: null, has_subscriber: false };
    const { result } = renderHook(
      () =>
        useSubscriptionsList({ focusEntityId: e.entity_id, tickCode: "PETTY_CASH", today: TODAY }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.view?.pendingChange).toBeTruthy());

    await activateThroughSheet(result, e);

    expect(posts.map((p) => p.action)).toEqual(["activate-subscription", "restart-billing"]);
    // NO `codes` on the activation: naming them is its own way to buy a lapsed module back,
    // and restart-billing below already owns that path. One charging path, charged once.
    expect(posts[0].body).toEqual({ account: "acc-company-a" });
    expect(posts[1].body).toEqual({ codes: ["PETTY_CASH"] });
    await waitFor(() => expect(result.current.result).toBeTruthy());
  });

  it("a refused activation applies nothing", async () => {
    // The guard on the fall-through: nothing below the activation runs when it fails, so the
    // apply pass can never charge a company that never got a subscriber.
    const said = "Choose a billing account for this company.";
    const posts = serveActivate({
      "activate-subscription": { status: 402, body: { error: said } },
    });
    const e = { ...ENTITIES[0], subscriber: null, has_subscriber: false };
    const { result } = renderHook(
      () =>
        useSubscriptionsList({ focusEntityId: e.entity_id, tickCode: "PETTY_CASH", today: TODAY }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.view?.pendingChange).toBeTruthy());

    await activateThroughSheet(result, e);

    expect(posts.map((p) => p.action)).toEqual(["activate-subscription"]);
    expect(result.current.accountStep?.error).toBe(said);
    expect(result.current.result).toBeNull();
    // The ticks are untouched, so pressing again is the same act.
    expect(result.current.summary.view?.pendingChange).toBeTruthy();
  });

  it("a decline on the apply pass keeps the subscriber and the ticks; Try again never re-activates", async () => {
    const posts = serveActivate({
      "restart-billing": { status: 402, body: { error: "Your card was declined." } },
    });
    const e = { ...ENTITIES[0], subscriber: null, has_subscriber: false };
    const { result } = renderHook(
      () =>
        useSubscriptionsList({ focusEntityId: e.entity_id, tickCode: "PETTY_CASH", today: TODAY }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.view?.pendingChange).toBeTruthy());

    await activateThroughSheet(result, e);

    await waitFor(() => expect(result.current.declined).toBeTruthy());
    expect(result.current.result).toBeNull();
    expect(result.current.summary.view?.pendingChange).toBeTruthy();

    // 06.B's Try again re-runs ONLY the charge: activation lives in confirmAccount, not apply,
    // so the company is not activated a second time.
    await act(async () => {
      await result.current.retryDeclined();
    });
    expect(posts.map((p) => p.action)).toEqual([
      "activate-subscription",
      "restart-billing",
      "restart-billing",
    ]);
  });

  it("Activate Subscription still opens the sheet when the change has no modal to show", async () => {
    // `buildChangeModal` answers null when no ticked code carries a seam, and it is a DIFFERENT
    // computation from the `pendingChange` the button is gated on - so the two can disagree. A
    // change simply shows no modal then; activation must not become a dead button.
    serveRowAndAccounts(SUMMARY_FIXTURES.M31);
    const e = { ...ENTITIES[0], subscriber: null, has_subscriber: false };
    const { result } = renderHook(
      () =>
        useSubscriptionsList({ focusEntityId: e.entity_id, tickCode: "PETTY_CASH", today: TODAY }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.view?.pendingChange).toBeTruthy());
    const change = result.current.summary.view!.pendingChange!;

    // A code the page has no card for: no seam, so no modal.
    act(() => result.current.activateChange(e, { ...change, codes: [] }));

    await waitFor(() => expect(result.current.accountStep).toBeTruthy());
    expect(result.current.changePrompt).toBeNull();
  });

  it("a tick it cannot give is simply not given", async () => {
    // Payment Request was never started on M31: its control is Start Free Trial, not a box.
    serveRow(fetchMock, SUMMARY_FIXTURES.M31);
    const e = ENTITIES[0];
    const { result } = renderHook(
      () =>
        useSubscriptionsList({
          focusEntityId: e.entity_id,
          tickCode: "PAYMENT_REQUEST",
          today: TODAY,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));

    expect(result.current.openEntityId).toBe(e.entity_id);
    expect(result.current.summary.view?.pendingChange).toBeNull();
    expect(result.current.summary.view?.modules[1].changed).toBe(false);
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
    // The item asks as the button would: the modal for exactly that change, then - it bills -
    // "Billing Accounts".
    await waitFor(() => expect(result.current.changePrompt).not.toBeNull());
    expect(result.current.changePrompt?.modal.kind).toBe("bundle");
    expect(result.current.changePrompt?.change.codes).toEqual(["PAYMENT_REQUEST"]);
    await act(() => result.current.applyChangePrompt());
    await waitFor(() => expect(result.current.accountStep).not.toBeNull());
    expect(result.current.changePrompt).toBeNull();
    // The open row's page model served the change: nothing was read again.
    expect(fetchMock.mock.calls.filter((c) => /\/modules$/.test(String(c[0]))).length).toBe(reads);
    expect(result.current.summary.view?.modules[1].chip).toBe("Restoring");
    await act(() => result.current.confirmAccount(result.current.accountStep!.picked!));
    expect(posts.map((p) => [p.action, p.body])).toEqual([
      [MOVE, { entity: e.entity_id, account: "acc-company-a" }],
      ["renew", { code: "PAYMENT_REQUEST" }],
    ]);
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

  it("an account the API refuses stays in the sheet in its words; closing it applies nothing", async () => {
    const refusal = "A payment on Vine Consulting Limited didn't go through. Settle it before moving a company onto it.";
    const posts = serveChange(fetchMock, "RU23", {
      [MOVE]: { status: 409, body: { error: refusal } },
    });
    const e = ENTITIES[0];
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    act(() => result.current.summary.toggleTick("PAYMENT_REQUEST"));
    await act(async () =>
      result.current.confirmChange(e, result.current.summary.view!.pendingChange!),
    );
    await act(() => result.current.applyChangePrompt());
    await waitFor(() => expect(result.current.accountStep).not.toBeNull());
    await act(() => result.current.confirmAccount("acc-vine"));

    // Refused: the sentence in the sheet, the account still picked, NOTHING applied.
    expect(result.current.accountStep).toMatchObject({ picked: "acc-vine", error: refusal });
    expect(posts.map((p) => p.action)).toEqual([MOVE]);
    expect(result.current.changeBusy).toBe(false);

    // Closed: nothing is applied, no modal shows, the ticks stay pending for another try.
    act(() => result.current.dismissAccountStep());
    expect(result.current.accountStep).toBeNull();
    expect(result.current.changePrompt).toBeNull();
    expect(result.current.summary.view?.pendingChange?.codes).toEqual([
      "PETTY_CASH",
      "PAYMENT_REQUEST",
    ]);
    expect(posts.map((p) => p.action)).toEqual([MOVE]);
  });

  it("an account opened in the sheet takes the company, then the change is applied", async () => {
    const posts = serveChange(fetchMock, "RU23", {}, ACCOUNTS);
    const e = ENTITIES[0];
    const { result } = renderHook(
      () => useSubscriptionsList({ today: TODAY, focusEntityId: e.entity_id }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.summary.status).toBe("ready"));
    act(() => result.current.summary.toggleTick("PETTY_CASH"));
    act(() => result.current.summary.toggleTick("PAYMENT_REQUEST"));
    await act(async () =>
      result.current.confirmChange(e, result.current.summary.view!.pendingChange!),
    );
    await act(() => result.current.applyChangePrompt());
    await waitFor(() => expect(result.current.accountStep).not.toBeNull());

    // What the sheet reports once the new account is saved and Done is pressed (01-J).
    await act(async () => {
      result.current.accountOpened({
        accountId: "acc-acme",
        accounts: ACCOUNTS_OPENED,
        moved: null,
        moveFailed: null,
        card: null,
        isDefault: true,
      });
    });

    await waitFor(() => expect(result.current.result).not.toBeNull());
    expect(posts.map((p) => [p.action, p.body])).toEqual([
      [MOVE, { entity: e.entity_id, account: "acc-acme" }],
      ["authorize-billing", {}],
      ["restart-billing", { codes: ["PAYMENT_REQUEST"] }],
    ]);
    expect(result.current.accountStep).toBeNull();
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
