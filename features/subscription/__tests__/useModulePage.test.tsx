// The page's orchestration, with the API stubbed at fetch: what loads, what a CTA posts, what
// a return from Stripe does to the URL, and where each seam sends the browser.

import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import { FIXTURES, TODAY } from "@/features/subscription/__fixtures__/modulePage";
import {
  NOT_WIRED_YET,
  SERVICE_DARK,
  useModulePage,
} from "@/features/subscription/hooks/useModulePage";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const API = `${env.BILLING_API_URL}/api/entities/e1/modules`;

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

/** The toasts the provider rendered, by their message. */
function toasts(): string[] {
  return Array.from(document.querySelectorAll("[data-toast-type]")).map(
    (el) => el.querySelector("p:last-child")?.textContent ?? "",
  );
}

describe("useModulePage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth(TOKEN, "e1", "Olive & Vine Limited");
    window.history.replaceState({}, "", "/subscription/entities/e1/modules");
    push.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the page model for the company and resolves the cards", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, FIXTURES.A));
    const { result } = renderHook(() => useModulePage({ entityId: "e1", today: TODAY }), {
      wrapper,
    });

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(API);
    expect(new Headers(init?.headers).get("X-Entity-Id")).toBe("e1");
    expect(result.current.views.map((v) => v.state)).toEqual(["trialing", "trial_eligible"]);
    expect(result.current.views[0].status.text).toBe("3 days remaining");
    expect(result.current.shared).toBeNull();
    expect(result.current.paymentFailed).toBe(false);
  });

  it("surfaces a failed load with the API's sentence, and reload tries again", async () => {
    fetchMock.mockResolvedValueOnce(reply(404, { error: "That company isn't on your account." }));
    fetchMock.mockResolvedValueOnce(reply(200, FIXTURES.C));
    const { result } = renderHook(() => useModulePage({ entityId: "e1", today: TODAY }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("That company isn't on your account.");

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.shared?.variant).toBe("link");
  });

  it("the API's 501 stub reads as 'not wired yet', not as its body", async () => {
    fetchMock.mockResolvedValueOnce(reply(501, { error: "not_implemented" }));
    const { result } = renderHook(() => useModulePage({ entityId: "e1", today: TODAY }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(NOT_WIRED_YET);

    fetchMock.mockResolvedValueOnce(reply(404, { error: "not_found" }));
    const dark = renderHook(() => useModulePage({ entityId: "e1", today: TODAY }), { wrapper });
    await waitFor(() => expect(dark.result.current.status).toBe("error"));
    expect(dark.result.current.error).toBe(SERVICE_DARK);
  });

  it("a trial is asked about first, then posted, then the page refetches", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, FIXTURES.A));
    fetchMock.mockResolvedValueOnce(reply(200, { modules: { PAYMENT_REQUEST: true } }));
    fetchMock.mockResolvedValueOnce(reply(200, FIXTURES.B));
    const { result } = renderHook(() => useModulePage({ entityId: "e1", today: TODAY }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    // Pressing the card's CTA asks - nothing is posted yet (the dialog names the module).
    act(() => result.current.askStartTrial("PAYMENT_REQUEST"));
    expect(result.current.trialPrompt).toEqual({
      code: "PAYMENT_REQUEST",
      moduleName: "Payment Request",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(() => result.current.confirmStartTrial());
    expect(result.current.trialPrompt).toBeNull();

    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe(`${API}/start-trial`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ codes: ["PAYMENT_REQUEST"] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.views.map((v) => v.state)).toEqual(["trialing", "trialing"]);
    expect(result.current.busyCode).toBeNull();
  });

  it("going back from the dialog posts nothing", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, FIXTURES.A));
    const { result } = renderHook(() => useModulePage({ entityId: "e1", today: TODAY }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.askStartTrial("PAYMENT_REQUEST"));
    act(() => result.current.dismissTrialPrompt());

    expect(result.current.trialPrompt).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a refused trial becomes an error toast and the dialog stays to try again", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, FIXTURES.A));
    fetchMock.mockResolvedValueOnce(
      reply(409, { error: "Module Payment Request has already used its free trial." }),
    );
    const { result } = renderHook(() => useModulePage({ entityId: "e1", today: TODAY }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.askStartTrial("PAYMENT_REQUEST"));
    await act(() => result.current.confirmStartTrial());

    expect(toasts()).toEqual(["Module Payment Request has already used its free trial."]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("ready");
    expect(result.current.trialPrompt).not.toBeNull();
  });

  it("back from Checkout: posts checkout-complete, drops session_id from the URL, then loads", async () => {
    window.history.replaceState(
      {},
      "",
      "/subscription/entities/e1/modules?from=bills&session_id=cs_test_1&purpose=payment_method",
    );
    fetchMock.mockResolvedValueOnce(reply(200, { ok: true }));
    fetchMock.mockResolvedValueOnce(reply(200, FIXTURES.C));
    const { result } = renderHook(
      () =>
        useModulePage({
          entityId: "e1",
          sessionId: "cs_test_1",
          purpose: "payment_method",
          today: TODAY,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${API}/checkout-complete`);
    expect(JSON.parse(String(init?.body))).toEqual({
      session_id: "cs_test_1",
      purpose: "payment_method",
    });
    expect(window.location.search).toBe("?from=bills");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a failed return is shown and forgotten", async () => {
    window.history.replaceState({}, "", "/subscription/entities/e1/modules?checkout_error=Nope");
    fetchMock.mockResolvedValueOnce(reply(200, FIXTURES.A));
    const { result } = renderHook(
      () => useModulePage({ entityId: "e1", checkoutError: "Nope", today: TODAY }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(toasts()).toEqual(["Nope"]);
    expect(window.location.search).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("the seams navigate to the flow's page under the module page", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, FIXTURES.A));
    const { result } = renderHook(() => useModulePage({ entityId: "e1", today: TODAY }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.manage());
    act(() => result.current.activate("PETTY_CASH"));
    act(() => result.current.resume("PETTY_CASH"));
    act(() => result.current.reactivate("PAYMENT_REQUEST"));
    act(() => result.current.updatePaymentMethod());

    expect(push.mock.calls.map((c) => c[0])).toEqual([
      "/subscription/subscriptions?entity=e1",
      "/subscription/entities/e1/modules/activate/PETTY_CASH",
      "/subscription/entities/e1/modules/resume/PETTY_CASH",
      "/subscription/entities/e1/modules/reactivate/PAYMENT_REQUEST",
      "/subscription/entities/e1/modules/payment-method",
    ]);
  });

  it("?fixture= serves a frame without the API outside production, and is ignored in it", async () => {
    const { result } = renderHook(() => useModulePage({ entityId: "e1", fixture: "F" }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.paymentFailed).toBe(true);
    // the fixture's dates count from the fixture's own day, not the wall clock
    expect(result.current.views.every((v) => v.status.text === "Subscription Suspended")).toBe(
      true,
    );

    vi.stubEnv("NODE_ENV", "production");
    fetchMock.mockResolvedValueOnce(reply(200, FIXTURES.A));
    const prod = renderHook(() => useModulePage({ entityId: "e1", fixture: "F", today: TODAY }), {
      wrapper,
    });
    await waitFor(() => expect(prod.result.current.status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prod.result.current.paymentFailed).toBe(false);
    vi.unstubAllEnvs();
  });
});
