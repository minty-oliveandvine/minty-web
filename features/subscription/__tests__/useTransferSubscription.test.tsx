// The payer's side of a handover over a stubbed fetch: the options read (and refused for a
// company that is not theirs), a pick and its quote, the current payer unpickable, blockers
// disabling the request, Request transfer posting and landing on 07-B, an invitation sent and
// refused, the offer waiting and its withdrawal landing on 07-K then re-reading, Cancel / Back
// to the company's row.

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";

import {
  SUBSCRIBER_OPTIONS,
  SUBSCRIBER_OPTIONS_BLOCKED,
  SUBSCRIBER_OPTIONS_PENDING,
} from "@/features/subscription/__fixtures__/transfers";
import type { SubscriberOptions } from "@/features/subscription/api/payerPortal";
import {
  TRANSFER_LOAD_FAILED,
  useTransferSubscription,
} from "@/features/subscription/hooks/useTransferSubscription";
import { NO_COMPANY } from "@/features/subscription/lib/transfer";

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

describe("useTransferSubscription", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const posts: { path: string; body: unknown }[] = [];

  function serve(
    options: SubscriberOptions | { status: number; error: string },
    answers: Record<string, { status: number; body: unknown }> = {},
  ) {
    posts.length = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "POST") {
        posts.push({ path: url.pathname, body: init.body ? JSON.parse(String(init.body)) : null });
        const a = answers[url.pathname];
        return a ? reply(a.status, a.body) : reply(200, { ok: true, message: "Done." });
      }
      if (url.pathname === "/api/me/subscriptions/subscriber-options") {
        if ("status" in options) return reply(options.status, { error: options.error });
        expect(url.searchParams.get("entity")).toBe("e-company-b");
        return reply(200, options);
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

  it("without a company says so and reads nothing", () => {
    const { result } = renderHook(() => useTransferSubscription({ entityId: null }));
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(NO_COMPANY);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the options; a pick shows its own quote; the current payer cannot be picked", async () => {
    serve(SUBSCRIBER_OPTIONS);
    const { result } = renderHook(() => useTransferSubscription({ entityId: "e-company-b" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.entityName).toBe("Company B Limited");
    expect(result.current.candidates.map((c) => c.name)).toEqual([
      "Harry Kim",
      "Rebecca Park",
      "Jiwon Kim",
      "Daniel Park",
    ]);
    expect(result.current.selected).toBeNull();
    expect(result.current.canRequest).toBe(false);
    expect(result.current.note).toMatch(/paid up until/);

    act(() => result.current.select("u-jiwon"));
    expect(result.current.canRequest).toBe(true);
    act(() => result.current.select("u-harry"));
    expect(result.current.canRequest).toBe(false);
  });

  it("a company that is not the payer's is refused in the API's words", async () => {
    serve({ status: 404, error: "That company isn't on your billing account." });
    const { result } = renderHook(() => useTransferSubscription({ entityId: "e-company-b" }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("That company isn't on your billing account.");
  });

  it("a network failure gets the house sentence", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const { result } = renderHook(() => useTransferSubscription({ entityId: "e-company-b" }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe(TRANSFER_LOAD_FAILED);
  });

  it("blockers are shown and disable the request", async () => {
    serve(SUBSCRIBER_OPTIONS_BLOCKED);
    const { result } = renderHook(() => useTransferSubscription({ entityId: "e-company-b" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.blockers).toHaveLength(1);
    act(() => result.current.select("u-jiwon"));
    expect(result.current.canRequest).toBe(false);
  });

  it("Request transfer posts the pick and lands on Transfer requested", async () => {
    serve(SUBSCRIBER_OPTIONS);
    const { result } = renderHook(() => useTransferSubscription({ entityId: "e-company-b" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.select("u-jiwon"));
    await act(() => result.current.request());
    expect(posts).toEqual([
      {
        path: "/api/me/subscriptions/transfer",
        body: { entity: "e-company-b", to_user: "u-jiwon" },
      },
    ]);
    expect(result.current.requested).toEqual({ email: "jiwon.kim@oliveandvine.com" });
  });

  it("a refused request keeps the screen and says why", async () => {
    serve(SUBSCRIBER_OPTIONS, {
      "/api/me/subscriptions/transfer": {
        status: 422,
        body: { error: "That person needs a saved payment method before they can take this over." },
      },
    });
    const { result } = renderHook(() => useTransferSubscription({ entityId: "e-company-b" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.select("u-daniel"));
    await act(() => result.current.request());
    expect(result.current.requested).toBeNull();
    expect(result.current.sendError).toMatch(/needs a saved payment method/);
  });

  it("an invitation posts the address; a refusal keeps it in the box", async () => {
    serve(SUBSCRIBER_OPTIONS, {
      "/api/me/subscriptions/invite-admin": {
        status: 200,
        body: { ok: true, message: "Invitation sent to new@oliveandvine.com." },
      },
    });
    const { result } = renderHook(() => useTransferSubscription({ entityId: "e-company-b" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.setInvite("new@oliveandvine.com"));
    await act(() => result.current.sendInvite());
    expect(posts.at(-1)).toEqual({
      path: "/api/me/subscriptions/invite-admin",
      body: { entity: "e-company-b", email: "new@oliveandvine.com" },
    });
    expect(result.current.invited).toBe("Invitation sent to new@oliveandvine.com.");
    expect(result.current.invite).toBe("");

    serve(SUBSCRIBER_OPTIONS, {
      "/api/me/subscriptions/invite-admin": {
        status: 422,
        body: { error: "That person is already a member of this company." },
      },
    });
    act(() => result.current.setInvite("harry.kim@oliveandvine.com"));
    await act(() => result.current.sendInvite());
    expect(result.current.inviteError).toBe("That person is already a member of this company.");
    expect(result.current.invite).toBe("harry.kim@oliveandvine.com");
  });

  it("an offer waiting: who, since when; Withdraw posts, tells, and Done reads again", async () => {
    serve(SUBSCRIBER_OPTIONS_PENDING);
    const { result } = renderHook(() => useTransferSubscription({ entityId: "e-company-b" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.pending?.name).toBe("Jiwon Kim");
    expect(result.current.canRequest).toBe(false);
    await act(() => result.current.withdraw());
    expect(posts).toEqual([
      { path: "/api/me/subscriptions/transfer/cancel", body: { transfer: "t-9" } },
    ]);
    expect(result.current.withdrawn).toBe(true);

    const reads = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("subscriber-options"),
    ).length;
    serve(SUBSCRIBER_OPTIONS);
    act(() => result.current.dismissWithdrawn());
    expect(result.current.withdrawn).toBe(false);
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(
      fetchMock.mock.calls.filter((c) => String(c[0]).includes("subscriber-options")).length,
    ).toBe(reads + 1);
    expect(result.current.pending).toBeNull();
  });

  it("Cancel / Back land on the company's row in the list", async () => {
    serve(SUBSCRIBER_OPTIONS);
    const { result } = renderHook(() => useTransferSubscription({ entityId: "e-company-b" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    act(() => result.current.backToRow());
    expect(push).toHaveBeenCalledWith("/subscription/subscriptions?entity=e-company-b");
  });

  it("?fixture= serves a frame without the API outside production", async () => {
    const { result } = renderHook(() =>
      useTransferSubscription({ entityId: "e-company-b", fixture: "C" }),
    );
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.pending?.name).toBe("Jiwon Kim");
  });
});
