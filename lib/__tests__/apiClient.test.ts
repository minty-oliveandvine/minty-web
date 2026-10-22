// lib/apiClient.ts at the wire, below the feature's view of it (features/subscription/__tests__/
// apiClient.test.ts) and the Flask half (mintyFetch.test.ts): how a query is spelled, how a body
// is read, which sentence an error carries, and what a 401 rejects with. The rules are
// @minty/shared/apiClient's since the shared-code refactor (2026-10-21); this app configures them.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, HOUSE_FALLBACK, apiFetch, apiFetchBlob, mintyFetch } from "@/lib/apiClient";
import { getAuth, setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const API = env.SUBSCRIPTION_API_URL;

const fetchMock = vi.fn<typeof fetch>();
const navigate = vi.fn<(url: string) => void>();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** The first call's URL and headers. */
function sent(): { url: string; headers: Headers; init: RequestInit | undefined } {
  const [url, init] = fetchMock.mock.calls[0];
  return { url: String(url), headers: new Headers(init?.headers), init };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  _resetHandoffForTests(navigate);
  setAuth(TOKEN, "", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  _resetHandoffForTests();
});

describe("ApiError", () => {
  it("is an Error named ApiError, carrying status, message and body (null when not given)", () => {
    const bare = new ApiError(418, "short and stout");
    expect(bare).toBeInstanceOf(Error);
    expect(bare.name).toBe("ApiError");
    expect(bare.status).toBe(418);
    expect(bare.message).toBe("short and stout");
    expect(bare.body).toBeNull();
    expect(new ApiError(400, "x", { error: "x" }).body).toEqual({ error: "x" });
  });

  it("the house fallback is this exact sentence", () => {
    expect(HOUSE_FALLBACK).toBe("Something went wrong on my end. Mind trying again?");
  });
});

describe("withQuery (through apiFetch)", () => {
  beforeEach(() => {
    fetchMock.mockImplementation(async () => json(200, {}));
  });

  it("drops undefined AND an empty string", async () => {
    // owner 2026-10-21: one shared module (@minty/shared/apiClient) - "" was kept as `b=`
    await apiFetch("/api/x", { query: { a: undefined, b: "", c: "1" } });
    expect(sent().url).toBe(`${API}/api/x?c=1`);
  });

  it("drops null, but stringifies false and 0", async () => {
    // owner 2026-10-21: one shared module (@minty/shared/apiClient) - null was sent as the word "null"
    await apiFetch("/api/x", { query: { n: null, f: false, z: 0 } });
    expect(sent().url).toBe(`${API}/api/x?f=false&z=0`);
  });

  it("joins with & onto a path that already has a query", async () => {
    await apiFetch("/api/x?keep=1", { query: { page: 2 } });
    expect(sent().url).toBe(`${API}/api/x?keep=1&page=2`);
  });

  it("adds no ? at all when every value is undefined, or the query is empty", async () => {
    await apiFetch("/api/x", { query: { a: undefined } });
    await apiFetch("/api/y", { query: {} });
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${API}/api/x`);
    expect(String(fetchMock.mock.calls[1][0])).toBe(`${API}/api/y`);
  });

  it("form-encodes the values (a space is +)", async () => {
    await apiFetch("/api/x", { query: { q: "a b&c" } });
    expect(sent().url).toBe(`${API}/api/x?q=a+b%26c`);
  });
});

describe("the request (through apiFetch)", () => {
  it("asks for JSON, with the bearer, and sends no Content-Type without a body", async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await apiFetch("/api/x");
    const { headers, init } = sent();
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
    expect(headers.has("Content-Type")).toBe(false);
    expect(init?.body).toBeUndefined();
  });

  it("with no token makes no request at all: a 401 and the re-handoff", async () => {
    // owner 2026-10-21: one shared module (@minty/shared/apiClient) - it sent the request without Authorization and waited for the 401
    setAuth("", "", "");
    const err = (await apiFetch("/api/x").catch((e: unknown) => e)) as ApiError;
    expect(fetchMock).not.toHaveBeenCalled();
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("keeps a caller's own headers but overrides Accept", async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await apiFetch("/api/x", { headers: { Accept: "text/plain", "X-Trace": "t1" } });
    const { headers } = sent();
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.get("X-Trace")).toBe("t1");
  });

  it("serialises `json: null` as the body `null`, with a Content-Type", async () => {
    fetchMock.mockResolvedValueOnce(json(200, {}));
    await apiFetch("/api/x", { method: "POST", json: null });
    const { headers, init } = sent();
    expect(init?.body).toBe("null");
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("X-Entity-Id only when entityId is given, and not for an empty one", async () => {
    fetchMock.mockImplementation(async () => json(200, {}));
    await apiFetch("/api/x", { entityId: "e1" });
    await apiFetch("/api/x", { entityId: "" });
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("X-Entity-Id")).toBe("e1");
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).has("X-Entity-Id")).toBe(false);
  });

  it("apiFetchBlob names the company too when asked, and accepts any type", async () => {
    fetchMock.mockResolvedValueOnce(new Response("%PDF", { status: 200 }));
    await apiFetchBlob("/api/f", { entityId: "e9" });
    expect(sent().headers.get("X-Entity-Id")).toBe("e9");
    // owner 2026-10-21: one shared module (@minty/shared/apiClient) - it was "application/pdf, application/json"
    expect(sent().headers.get("Accept")).toBe("*/*");
  });
});

describe("readBody (through apiFetch)", () => {
  it("answers null for an empty success", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    expect(await apiFetch("/api/x")).toBeNull();
  });

  it("answers the TEXT of a success that is not JSON, rather than failing", async () => {
    fetchMock.mockResolvedValueOnce(new Response("plain words", { status: 200 }));
    expect(await apiFetch("/api/x")).toBe("plain words");
  });
});

describe("errorSentence (through apiFetch)", () => {
  async function failure(res: Response): Promise<ApiError> {
    fetchMock.mockResolvedValueOnce(res);
    return (await apiFetch("/api/x").catch((e: unknown) => e)) as ApiError;
  }

  it("a non-string `error` falls back to the house sentence, keeping the body", async () => {
    const err = await failure(json(400, { error: 123 }));
    expect(err.message).toBe(HOUSE_FALLBACK);
    expect(err.body).toEqual({ error: 123 });
  });

  it("an EMPTY `error` string is the fallback", async () => {
    // owner 2026-10-21: one shared module (@minty/shared/apiClient) - the message was ""
    const err = await failure(json(400, { error: "" }));
    expect(err.status).toBe(400);
    expect(err.message).toBe(HOUSE_FALLBACK);
  });

  it("reads `error`, then `detail` (Django's shape), then `message`", async () => {
    // owner 2026-10-21: one shared module (@minty/shared/apiClient) - only `error` was read
    expect((await failure(json(422, { detail: "That code has expired." }))).message).toBe(
      "That code has expired.",
    );
    expect((await failure(json(400, { message: "Try another email address." }))).message).toBe(
      "Try another email address.",
    );
  });

  it("refuses a machine code, a single word or markup - the fallback instead", async () => {
    // owner 2026-10-21: one shared module (@minty/shared/apiClient) - any string in `error` was shown as it stood
    expect((await failure(json(409, { error: "invalid_state" }))).message).toBe(HOUSE_FALLBACK);
    expect((await failure(json(422, { detail: "Nope." }))).message).toBe(HOUSE_FALLBACK);
    expect((await failure(json(400, { error: "<b>Bad</b> request here" }))).message).toBe(
      HOUSE_FALLBACK,
    );
  });

  it("a text body is kept as the error's body, with the fallback sentence", async () => {
    const err = await failure(new Response("Bad Gateway", { status: 502 }));
    expect(err.message).toBe(HOUSE_FALLBACK);
    expect(err.body).toBe("Bad Gateway");
  });

  it("an empty failure body is null", async () => {
    const err = await failure(new Response(null, { status: 500 }));
    expect(err.body).toBeNull();
    expect(err.message).toBe(HOUSE_FALLBACK);
  });
});

describe("a 401", () => {
  it("rejects with SESSION_ENDED's sentence and NO body, whatever the response said", async () => {
    fetchMock.mockResolvedValueOnce(json(401, { error: "Token expired." }));
    const err = (await apiFetch("/api/x").catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.message).toBe("Your session has ended. Signing you back in…");
    expect(err.body).toBeNull();
  });

  it("the billing API's re-handoff keeps the company the CALL named", async () => {
    setAuth(TOKEN, "cookie-co", "Cookie Co");
    window.history.replaceState({}, "", "/subscription");
    fetchMock.mockResolvedValueOnce(json(401, {}));
    await apiFetch("/api/x", { entityId: "call-co" }).catch(() => undefined);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(new URL(navigate.mock.calls[0][0]).searchParams.get("entity_id")).toBe("call-co");
    expect(getAuth()).toBeNull();
  });

  it("the billing API's re-handoff names no company when the call named none", async () => {
    setAuth(TOKEN, "cookie-co", "Cookie Co");
    fetchMock.mockResolvedValueOnce(json(401, {}));
    await apiFetch("/api/x").catch(() => undefined);
    expect(new URL(navigate.mock.calls[0][0]).searchParams.has("entity_id")).toBe(false);
  });

  it("Flask's re-handoff names no company when the cookie's is empty", async () => {
    fetchMock.mockResolvedValueOnce(json(401, {}));
    await mintyFetch("/api/me/profile").catch(() => undefined);
    expect(new URL(navigate.mock.calls[0][0]).searchParams.has("entity_id")).toBe(false);
  });

  it("`reject` leaves the cookie in place", async () => {
    fetchMock.mockResolvedValueOnce(json(401, {}));
    await mintyFetch("/api/me/profile", { onUnauthorized: "reject" }).catch(() => undefined);
    expect(getAuth()?.token).toBe(TOKEN);
  });
});
