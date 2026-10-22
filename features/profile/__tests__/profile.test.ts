// My Profile's adapter (features/profile/api/profile.ts - createProfileApi from @minty/shared/portal
// over this app's Flask client since the shared-code refactor, 2026-10-21): Flask's GET / PATCH
// /api/me/profile, naming the company only as `?entity=` and only when there is one.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import { profileApi } from "@/features/profile/api/profile";

const fetchMock = vi.fn<typeof fetch>();
const PROFILE = { user: { name: "Olive Vine", initials: "OV" } };
const answer = () =>
  new Response(JSON.stringify(PROFILE), { status: 200, headers: { "Content-Type": "application/json" } });

/** Every call's URL, method and parsed body. */
const calls = () =>
  fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: init?.method ?? "GET",
    body: init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined,
    entityHeader: new Headers(init?.headers).get("X-Entity-Id"),
  }));

describe("the profile adapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async () => answer());
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "e1", "Co");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads with ?entity= for a company, and with no query for none, empty or null", async () => {
    expect(await profileApi.load("e 1")).toEqual(PROFILE);
    await profileApi.load();
    await profileApi.load("");
    await profileApi.load(null);
    expect(calls().map((c) => c.url)).toEqual([
      `${env.PETTY_CASH_URL}/api/me/profile?entity=e+1`,
      `${env.PETTY_CASH_URL}/api/me/profile`,
      `${env.PETTY_CASH_URL}/api/me/profile`,
      `${env.PETTY_CASH_URL}/api/me/profile`,
    ]);
    // the cookie's company is NOT sent on its own, and never as a header
    expect(calls().every((c) => c.entityHeader === null)).toBe(true);
  });

  it("saves with PATCH, the changes as the JSON body, the company as ?entity=", async () => {
    await profileApi.save({ first_name: "Olive", email: "o@v.test" }, "e1");
    await profileApi.save({ last_name: "Vine" });
    expect(calls()).toEqual([
      {
        url: `${env.PETTY_CASH_URL}/api/me/profile?entity=e1`,
        method: "PATCH",
        body: { first_name: "Olive", email: "o@v.test" },
        entityHeader: null,
      },
      { url: `${env.PETTY_CASH_URL}/api/me/profile`, method: "PATCH", body: { last_name: "Vine" }, entityHeader: null },
    ]);
  });

  it("profileApi.load(entityId, signal) and save(changes, entityId) are the same two calls", async () => {
    const signal = new AbortController().signal;
    await profileApi.load("e2", signal);
    await profileApi.save({ first_name: "N" }, "e3");
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(signal);
    expect(calls().map((c) => `${c.method} ${c.url}`)).toEqual([
      `GET ${env.PETTY_CASH_URL}/api/me/profile?entity=e2`,
      `PATCH ${env.PETTY_CASH_URL}/api/me/profile?entity=e3`,
    ]);
  });
});
