// The one way the feature talks to the API (lib/apiClient.ts), pinned from the feature's side:
// the bearer comes from the cookie, X-Entity-Id is opt-in, a 401 goes back through the
// re-handoff exactly once, and every other failure surfaces the API's `error` sentence with
// its status - which is what the screens branch on. The same for the one route that answers a
// file (an invoice's PDF, `apiFetchBlob`), whose failures are JSON like every other.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, HOUSE_FALLBACK, apiFetch, apiFetchBlob } from "@/lib/apiClient";
import { getAuth, setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";

import { INVOICE_PDF } from "@/features/subscription/__fixtures__/billing";
import { getModulePage, postModuleAction } from "@/features/subscription/api/moduleSettings";
import { fetchInvoicePdf, fetchPayerSubscriptions } from "@/features/subscription/api/payerPortal";

function jwt(claims: Record<string, unknown>): string {
  const b64 = (s: string) => Buffer.from(s).toString("base64url");
  return `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify(claims))}.sig`;
}

const TOKEN = jwt({ user_id: "u1", exp: Math.floor(Date.now() / 1000) + 1800 });

function reply(status: number, body: unknown): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiFetch", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const navigated: string[] = [];

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth(TOKEN, "e1", "Payer Trading Co");
    navigated.length = 0;
    _resetHandoffForTests((url) => navigated.push(url));
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _resetHandoffForTests();
  });

  it("sends the cookie token as the bearer and no X-Entity-Id by default", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { entities: [], total: 0 }));
    await fetchPayerSubscriptions({ query: " acme ", page: 2 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${env.SUBSCRIPTION_API_URL}/api/me/subscriptions?q=acme&page=2`);
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headers.has("X-Entity-Id")).toBe(false);
  });

  it("names the company with X-Entity-Id on a company-scoped call", async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, {
        entity_id: "e1",
        cards: [],
        can_manage_modules: true,
        payer: null,
        viewer: { name: "Olive Vine", initials: "OV" },
        next_payment_date: null,
      }),
    );
    await getModulePage("e1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${env.SUBSCRIPTION_API_URL}/api/entities/e1/modules`);
    expect(new Headers(init?.headers).get("X-Entity-Id")).toBe("e1");
  });

  it("posts an action as JSON", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { ok: true }));
    await postModuleAction("e1", "start-trial", { codes: ["PETTY_CASH"] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${env.SUBSCRIPTION_API_URL}/api/entities/e1/modules/start-trial`);
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({ codes: ["PETTY_CASH"] });
  });

  it("surfaces the API's error sentence with its status", async () => {
    fetchMock.mockResolvedValueOnce(reply(402, { error: "Your card was declined." }));
    const err: unknown = await apiFetch("/api/me/billing/payment-methods/confirm", {
      method: "POST",
      json: {},
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(402);
    expect((err as ApiError).message).toBe("Your card was declined.");
  });

  it("falls back to the house sentence when the body has none", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>gateway</html>", { status: 502 }));
    const err = (await apiFetch("/api/me/invoices").catch((e: unknown) => e)) as ApiError;
    expect(err.status).toBe(502);
    expect(err.message).toBe(HOUSE_FALLBACK);
  });

  it("on 401 clears the cookie and goes back through Flask's re-handoff, once", async () => {
    window.history.replaceState({}, "", "/subscription/billing?page=2");
    fetchMock.mockResolvedValue(reply(401, { error: "Unauthorized" }));

    await expect(apiFetch("/api/me/invoices")).rejects.toMatchObject({ status: 401 });
    await expect(apiFetch("/api/me/subscriptions")).rejects.toMatchObject({ status: 401 });

    expect(getAuth()).toBeNull();
    expect(navigated).toHaveLength(1);
    const target = new URL(navigated[0]);
    expect(target.origin + target.pathname).toBe(`${env.PETTY_CASH_URL}/handoff/minty-web`);
    expect(target.searchParams.get("next")).toBe("/subscription/billing?page=2");
  });

  describe("a file (apiFetchBlob)", () => {
    const pdf = (type = "application/pdf") =>
      new Response(INVOICE_PDF, { status: 200, headers: { "Content-Type": type } });

    it("returns the file itself, asked for as a PDF with the bearer", async () => {
      fetchMock.mockResolvedValueOnce(pdf());
      const file = await apiFetchBlob("/api/me/invoices/in_1/pdf");

      // Its type is the response's; `Response.blob()`'s Blob is not jsdom's, so no instanceof.
      expect(file.type).toBe("application/pdf");
      expect(await file.text()).toBe(INVOICE_PDF);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toBe(`${env.SUBSCRIPTION_API_URL}/api/me/invoices/in_1/pdf`);
      const headers = new Headers(init?.headers);
      expect(headers.get("Accept")).toBe("application/pdf, application/json");
      expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
      expect(headers.has("X-Entity-Id")).toBe(false);
    });

    it("a refusal is JSON here too: the API's sentence, with its status", async () => {
      fetchMock.mockResolvedValueOnce(reply(409, { error: "There's no PDF for that invoice." }));
      const err = (await apiFetchBlob("/api/me/invoices/in_1/pdf").catch(
        (e: unknown) => e,
      )) as ApiError;
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(409);
      expect(err.message).toBe("There's no PDF for that invoice.");
    });

    it("on 401 goes back through Flask's re-handoff, once", async () => {
      window.history.replaceState({}, "", "/subscription/billing?account=acc-1");
      fetchMock.mockResolvedValue(reply(401, { error: "Unauthorized" }));

      for (const id of ["in_1", "in_2"]) {
        await expect(apiFetchBlob(`/api/me/invoices/${id}/pdf`)).rejects.toMatchObject({
          status: 401,
        });
      }

      expect(getAuth()).toBeNull();
      expect(navigated).toHaveLength(1);
      expect(new URL(navigated[0]).searchParams.get("next")).toBe(
        "/subscription/billing?account=acc-1",
      );
    });

    it("fetchInvoicePdf asks for THAT invoice, and refuses an answer that is not a PDF", async () => {
      fetchMock.mockResolvedValueOnce(pdf("application/pdf; charset=binary"));
      expect((await fetchInvoicePdf("in 1/x")).size).toBe(INVOICE_PDF.length);
      expect(String(fetchMock.mock.calls[0][0])).toBe(
        `${env.SUBSCRIPTION_API_URL}/api/me/invoices/in%201%2Fx/pdf`,
      );

      // A 200 that is not the document - a proxy's page, say - is never handed on to be saved.
      fetchMock.mockResolvedValueOnce(pdf("text/html"));
      await expect(fetchInvoicePdf("in_1")).rejects.toMatchObject({
        status: 502,
        message: "That came back in a shape I didn't expect. Mind trying again?",
      });
    });
  });
});
