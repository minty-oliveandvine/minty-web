// The two module APIs the hub's Petty Cash Settings and Payment Settings tabs call (owner,
// 2026-11-10): each at its own address with the bearer; Payment Request names the company in
// X-Entity-Id (its door reads it), Petty Cash in the path (its door never reads a header); a
// refusal rejects with the API's sentence - `error`, or the old `detail` the APIs' main line still
// sends - and a 401 goes back for a fresh token for that company.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HOUSE_FALLBACK, paymentRequestFetch, pettyCashFetch } from "@/lib/apiClient";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const fetchMock = vi.fn<typeof fetch>();
const navigate = vi.fn<(url: string) => void>();

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  navigate.mockReset();
  _resetHandoffForTests(navigate);
  setAuth(TOKEN, "e1", "Olive Shop");
});

afterEach(() => {
  vi.unstubAllGlobals();
  _resetHandoffForTests();
});

describe("pettyCashFetch", () => {
  it("calls the Petty Cash API with the bearer and the JSON body, and no X-Entity-Id", async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { ok: true }));

    const body = await pettyCashFetch("/api/petty-cash/v1/companies/e1/sales-methods", {
      method: "POST",
      json: { name: "Card" },
    });

    expect(body).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${env.PETTY_CASH_API_URL}/api/petty-cash/v1/companies/e1/sales-methods`);
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headers.has("X-Entity-Id")).toBe(false);
    expect(init?.body).toBe(JSON.stringify({ name: "Card" }));
  });

  it("a refusal rejects with the API's sentence, `detail` when there is no `error`", async () => {
    fetchMock.mockResolvedValueOnce(answer(409, { detail: "That name is taken." }));
    await expect(
      pettyCashFetch("/api/petty-cash/v1/companies/e1/sales-methods"),
    ).rejects.toMatchObject({
      status: 409,
      message: "That name is taken.",
    });
    fetchMock.mockResolvedValueOnce(answer(422, { detail: [{ msg: "field required" }] }));
    await expect(
      pettyCashFetch("/api/petty-cash/v1/companies/e1/sales-methods"),
    ).rejects.toMatchObject({
      status: 422,
      message: HOUSE_FALLBACK,
    });
  });

  it("a 401 goes back for a fresh token for the company", async () => {
    window.history.replaceState({}, "", "/entity/e1/olive-shop/settings/petty-cash");
    fetchMock.mockResolvedValueOnce(answer(401, { error: "Unauthorized" }));

    await expect(pettyCashFetch("/api/petty-cash/v1/companies/e1/settings")).rejects.toMatchObject({
      status: 401,
    });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate.mock.calls[0][0]).toContain(`${env.ACCOUNTS_API_URL}/`);
    expect(navigate.mock.calls[0][0]).toContain("e1");
  });
});

describe("paymentRequestFetch", () => {
  it("calls the Payment Request API with the bearer and X-Entity-Id", async () => {
    fetchMock.mockResolvedValueOnce(answer(200, []));

    await paymentRequestFetch("/api/entity-bill-accounts/", { entityId: "e1" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${env.PAYMENT_REQUEST_API_URL}/api/entity-bill-accounts/`);
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headers.get("X-Entity-Id")).toBe("e1");
  });

  it("a refusal rejects with the API's sentence", async () => {
    fetchMock.mockResolvedValueOnce(answer(403, { error: "You can't change these settings." }));
    await expect(
      paymentRequestFetch("/api/entity-bill-accounts/x", {
        entityId: "e1",
        method: "PUT",
        json: {},
      }),
    ).rejects.toMatchObject({ status: 403, message: "You can't change these settings." });
  });
});
