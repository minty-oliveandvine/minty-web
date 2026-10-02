// The Flask half of lib/apiClient.ts: the hub pages' reads go to PETTY_CASH_URL, never carry
// X-Entity-Id (Flask's CORS would refuse the preflight), and a 401 either re-authenticates
// keeping the company in the cookie or - for decoration - only rejects.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, mintyFetch } from "@/lib/apiClient";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const fetchMock = vi.fn<typeof fetch>();
const navigate = vi.fn<(url: string) => void>();

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("mintyFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    _resetHandoffForTests(navigate);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _resetHandoffForTests();
  });

  it("calls Flask with the bearer and the query, and no X-Entity-Id", async () => {
    setAuth(TOKEN, "e1", "Olive Shop");
    fetchMock.mockResolvedValueOnce(answer(200, { user: { name: "Olive Vine" } }));

    const body = await mintyFetch("/api/me/profile", { query: { entity: "e1" } });

    expect(body).toEqual({ user: { name: "Olive Vine" } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${env.PETTY_CASH_URL}/api/me/profile?entity=e1`);
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headers.has("X-Entity-Id")).toBe(false);
  });

  it("a refusal rejects with the sentence Flask gave", async () => {
    setAuth(TOKEN, "", "");
    fetchMock.mockResolvedValueOnce(answer(422, { error: "That email address is already in use." }));

    await expect(mintyFetch("/api/me/profile", { method: "PATCH", json: {} })).rejects.toMatchObject({
      status: 422,
      message: "That email address is already in use.",
    });
  });

  it("a 401 goes back for a fresh token, keeping the company the cookie names", async () => {
    setAuth(TOKEN, "e1", "Olive Shop");
    window.history.replaceState({}, "", "/profile");
    fetchMock.mockResolvedValueOnce(answer(401, { error: "unauthorized" }));

    await expect(mintyFetch("/api/me/profile")).rejects.toBeInstanceOf(ApiError);
    expect(navigate).toHaveBeenCalledTimes(1);
    const target = new URL(navigate.mock.calls[0][0]);
    expect(target.pathname).toBe("/handoff/minty-web");
    expect(target.searchParams.get("next")).toBe("/profile");
    expect(target.searchParams.get("entity_id")).toBe("e1");
  });

  it("decoration only rejects on a 401 - the page is never moved for it", async () => {
    setAuth(TOKEN, "", "");
    fetchMock.mockResolvedValueOnce(answer(401, { error: "unauthorized" }));

    await expect(mintyFetch("/api/me/profile", { onUnauthorized: "reject" })).rejects.toMatchObject({
      status: 401,
    });
    expect(navigate).not.toHaveBeenCalled();
  });
});
