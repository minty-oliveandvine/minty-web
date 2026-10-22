// The cookie-backed token (lib/auth.ts, this app's instance of @minty/shared/auth since the
// shared-code refactor, 2026-10-21): the three cookies' names and lifetime, and the package's
// JWT reads as this app relies on them. isEntityScoped has its own file
// (features/subscription/__tests__/authScope.test.ts).

import { afterEach, describe, expect, it, vi } from "vitest";

import { decodeJwtPayload, isTokenExpired, secondsUntilExpiry } from "@minty/shared/auth";

import {
  AUTH_COOKIE_NAME,
  ENTITY_ID_COOKIE_NAME,
  ENTITY_NAME_COOKIE_NAME,
  clearAuth,
  getAuth,
  setAuth,
} from "@/lib/auth";

const b64url = (s: string) => Buffer.from(s).toString("base64url");
const jwt = (claims: unknown) => `${b64url('{"alg":"HS256"}')}.${b64url(JSON.stringify(claims))}.sig`;
const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Every string written to document.cookie while `fn` runs. */
function writes(fn: () => void): string[] {
  const spy = vi.spyOn(Document.prototype, "cookie", "set");
  fn();
  return spy.mock.calls.map(([v]) => String(v));
}

afterEach(() => clearAuth());

describe("the cookies", () => {
  it("are named minty_token / minty_entity_id / minty_entity_name", () => {
    expect(AUTH_COOKIE_NAME).toBe("minty_token");
    expect(ENTITY_ID_COOKIE_NAME).toBe("minty_entity_id");
    expect(ENTITY_NAME_COOKIE_NAME).toBe("minty_entity_name");
  });

  it("setAuth writes all three, URI-encoded, living exactly as long as the token's exp", () => {
    const token = jwt({ exp: nowSeconds() + 600 });
    const written = writes(() => setAuth(token, "e/1", "Olive & Vine; Ltd"));
    expect(written).toHaveLength(3);
    // jsdom serves http://, so no ;Secure (that arm is https-only and not reachable here).
    const age = /max-age=(\d+);/.exec(written[0])![1];
    expect(Number(age)).toBeGreaterThanOrEqual(599);
    expect(Number(age)).toBeLessThanOrEqual(600);
    const opts = `path=/;max-age=${age};SameSite=Lax`;
    expect(written).toEqual([
      `minty_token=${encodeURIComponent(token)};${opts}`,
      `minty_entity_id=e%2F1;${opts}`,
      `minty_entity_name=Olive%20%26%20Vine%3B%20Ltd;${opts}`,
    ]);
  });

  it("a token with no readable exp gets Flask's 30 minutes", () => {
    const written = writes(() => setAuth("not-a-jwt", "", ""));
    expect(written[0]).toBe("minty_token=not-a-jwt;path=/;max-age=1800;SameSite=Lax");
    expect(written[1]).toBe("minty_entity_id=;path=/;max-age=1800;SameSite=Lax");
  });

  it("getAuth decodes what setAuth encoded", () => {
    setAuth("tok=en", "e/1", "Olive & Vine; Ltd");
    expect(getAuth()).toEqual({ token: "tok=en", entityId: "e/1", entityName: "Olive & Vine; Ltd" });
  });

  it("getAuth is null with no token cookie - even an EMPTY token, with a company beside it", () => {
    expect(getAuth()).toBeNull();
    setAuth("", "e1", "Co");
    expect(getAuth()).toBeNull();
  });

  it("getAuth answers \"\" for a missing company cookie", () => {
    document.cookie = "minty_token=t1;path=/";
    expect(getAuth()).toEqual({ token: "t1", entityId: "", entityName: "" });
  });

  it("clearAuth expires the three with max-age=0 (no SameSite on the way out)", () => {
    setAuth("t1", "e1", "Co");
    expect(writes(() => clearAuth())).toEqual([
      "minty_token=;path=/;max-age=0",
      "minty_entity_id=;path=/;max-age=0",
      "minty_entity_name=;path=/;max-age=0",
    ]);
    expect(getAuth()).toBeNull();
  });
});

describe("decodeJwtPayload", () => {
  it("reads an unpadded base64url payload, - and _ included", () => {
    // "??>" encodes to "Pz8-" and "???" to "Pz8_": the url-safe characters must be mapped back.
    const payload = { s: "??>???", n: 1 };
    expect(decodeJwtPayload(jwt(payload))).toEqual(payload);
    expect(b64url(JSON.stringify(payload))).toMatch(/[-_]/);
  });

  it("is null for anything but three parts with an OBJECT payload - never throws", () => {
    expect(decodeJwtPayload("a.b")).toBeNull();
    expect(decodeJwtPayload("a.b.c.d")).toBeNull();
    expect(decodeJwtPayload("")).toBeNull();
    expect(decodeJwtPayload("h.%%%.s")).toBeNull();
    expect(decodeJwtPayload(`h.${b64url("not json")}.s`)).toBeNull();
    expect(decodeJwtPayload(jwt([1, 2]))).toBeNull();
    expect(decodeJwtPayload(jwt(null))).toBeNull();
    expect(decodeJwtPayload(jwt(5))).toBeNull();
    expect(decodeJwtPayload(jwt("text"))).toBeNull();
  });

  it("does not check the signature - any third part will do", () => {
    expect(decodeJwtPayload(`h.${b64url('{"a":1}')}.`)).toEqual({ a: 1 });
  });

  it("reads the payload as UTF-8, so a name in Chinese survives", () => {
    // owner 2026-10-21: one shared module (@minty/shared/auth) - atob alone read it as Latin-1 mojibake
    expect(decodeJwtPayload(jwt({ name: "美心" }))).toEqual({ name: "美心" });
  });
});

describe("secondsUntilExpiry", () => {
  it("is the whole seconds to exp, floored at 1 for a lapsed token", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000_500); // 1_000_000.5 s
    expect(secondsUntilExpiry(jwt({ exp: 1_000_100 }))).toBe(99); // 99.5 floored
    expect(secondsUntilExpiry(jwt({ exp: 1_000_000 }))).toBe(1);
    expect(secondsUntilExpiry(jwt({ exp: 1 }))).toBe(1);
  });

  it("is 1800 for no exp, a non-number exp, or no token at all", () => {
    expect(secondsUntilExpiry(jwt({}))).toBe(1800);
    expect(secondsUntilExpiry(jwt({ exp: "9999999999" }))).toBe(1800);
    expect(secondsUntilExpiry("garbage")).toBe(1800);
  });
});

describe("isTokenExpired(token)", () => {
  // owner 2026-10-21: one shared module (@minty/shared/auth) - it read the cookie itself
  // (isTokenExpired()); the caller passes the token now
  const stored = () => isTokenExpired(getAuth()?.token);

  it("is true with no token", () => {
    expect(stored()).toBe(true);
  });

  it("is false for a token with no exp - it cannot tell, so it does not guess", () => {
    setAuth(jwt({ user_id: "u1" }), "", "");
    expect(stored()).toBe(false);
    setAuth("not-a-jwt", "", "");
    expect(stored()).toBe(false);
  });

  it("allows 5 seconds of clock skew past exp", () => {
    // The cookie lives max(1, …) seconds, so a just-lapsed token is still in the jar to judge.
    setAuth(jwt({ exp: nowSeconds() - 3 }), "", "");
    expect(stored()).toBe(false);
    setAuth(jwt({ exp: nowSeconds() - 30 }), "", "");
    expect(stored()).toBe(true);
    setAuth(jwt({ exp: nowSeconds() + 60 }), "", "");
    expect(stored()).toBe(false);
  });
});
