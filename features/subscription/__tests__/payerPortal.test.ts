// The payer's companies, all of them (features/subscription/api/payerPortal.ts): the list
// scrolls rather than pages, so fetchAllPayerSubscriptions walks the API's pages at its ceiling
// (@minty/shared/portal's fetchAllSubscriptions since the shared-code refactor, 2026-10-21).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_PER_PAGE } from "@minty/shared/portal";

import { ApiError } from "@/lib/apiClient";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import {
  fetchAllPayerSubscriptions,
  fetchPayerSubscriptions,
} from "@/features/subscription/api/payerPortal";

const fetchMock = vi.fn<typeof fetch>();
const API = `${env.SUBSCRIPTION_API_URL}/api/me/subscriptions`;

/** One page of the answer; only the fields the walk reads are meaningful. */
function page(n: number, pages: number, ids: string[], extra: Record<string, unknown> = {}) {
  return {
    payer: { page: n },
    billing: { page: n },
    entities: ids.map((entity_id) => ({ entity_id })),
    total: 0,
    page: n,
    pages,
    per_page: MAX_PER_PAGE,
    sort: "name",
    direction: "asc",
    query: "",
    ...extra,
  };
}

function serve(...bodies: unknown[]) {
  for (const body of bodies) {
    fetchMock.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
  }
}

const urls = () => fetchMock.mock.calls.map(([u]) => String(u));

describe("fetchAllPayerSubscriptions", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("asks page 1 at 100 a page, then each page up to `pages`, one after another, in order", async () => {
    const outcomes = [{ id: "t1" }];
    serve(
      page(1, 3, ["a", "b"], { transfer_outcomes: outcomes }),
      page(2, 3, ["c"], { transfer_outcomes: [{ id: "t2" }] }),
      page(3, 3, ["d"]),
    );
    const all = await fetchAllPayerSubscriptions();
    expect(MAX_PER_PAGE).toBe(100);
    expect(urls()).toEqual([
      `${API}?page=1&per_page=100`,
      `${API}?page=2&per_page=100`,
      `${API}?page=3&per_page=100`,
    ]);
    // payer, billing and the outcomes come from the FIRST page only; the companies from all
    expect(all).toEqual({
      payer: { page: 1 },
      billing: { page: 1 },
      entities: [{ entity_id: "a" }, { entity_id: "b" }, { entity_id: "c" }, { entity_id: "d" }],
      transfer_outcomes: outcomes,
    });
  });

  it("one page is one call; no outcomes on it is an empty list", async () => {
    serve(page(1, 1, ["a"]));
    const all = await fetchAllPayerSubscriptions();
    expect(urls()).toHaveLength(1);
    expect(all.transfer_outcomes).toEqual([]);
  });

  it("`pages: 0` (nobody to pay for) is still one call", async () => {
    serve(page(1, 0, []));
    expect((await fetchAllPayerSubscriptions()).entities).toEqual([]);
    expect(urls()).toHaveLength(1);
  });

  it("passes the signal to every page", async () => {
    const signal = new AbortController().signal;
    serve(page(1, 2, ["a"]), page(2, 2, ["b"]));
    await fetchAllPayerSubscriptions(signal);
    expect(fetchMock.mock.calls.map(([, init]) => init?.signal)).toEqual([signal, signal]);
  });

  it("a page that is not the expected shape fails the whole walk with this app's 502 ApiError", async () => {
    serve(page(1, 2, ["a"]), { entities: null });
    const err = await fetchAllPayerSubscriptions().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 502,
      message: "That came back in a shape I didn't expect. Mind trying again?",
    });
  });
});

describe("fetchPayerSubscriptions's query", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("names q, sort, direction, page, per_page in that order; a blank search is no q", async () => {
    serve(page(1, 1, []), page(1, 1, []), page(1, 1, []));
    await fetchPayerSubscriptions({
      query: "  ",
      sort: "entity",
      direction: "desc",
      page: 2,
      perPage: 5,
    });
    await fetchPayerSubscriptions({ query: " Olive & Vine " });
    await fetchPayerSubscriptions();
    expect(urls()).toEqual([
      `${API}?sort=entity&direction=desc&page=2&per_page=5`,
      `${API}?q=Olive+%26+Vine`,
      API,
    ]);
  });
});
