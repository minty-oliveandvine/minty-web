// The token's module claims (moduleClaims from @minty/shared/auth since the shared-code refactor,
// 2026-10-21 - it was lib/moduleClaims.ts's getModuleClaims), read from the stored token: what the
// settings pills and the drawer show before the page model has answered.

import { describe, expect, it } from "vitest";

import { moduleClaims } from "@minty/shared/auth";

import { getAuth, setAuth } from "@/lib/auth";

/** What this app's callers ask: the claims of the token in the cookie. */
const getModuleClaims = () => moduleClaims(getAuth()?.token);

function jwt(claims: Record<string, unknown>): string {
  const b64 = (s: string) => Buffer.from(s).toString("base64url");
  return `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify(claims))}.sig`;
}

describe("the stored token's module claims", () => {
  it("reads Flask's two claims", () => {
    setAuth(jwt({ user_id: "u1", petty_cash_enabled: true, billing_enabled: false }), "e1", "Co");
    expect(getModuleClaims()).toEqual({ pettyCash: true, billing: false });
  });

  it("defaults to on - no token, a malformed one, or a token without the claims", () => {
    expect(getModuleClaims()).toEqual({ pettyCash: true, billing: true });
    setAuth("not-a-jwt", "e1", "Co");
    expect(getModuleClaims()).toEqual({ pettyCash: true, billing: true });
    setAuth(jwt({ user_id: "u1" }), "e1", "Co");
    expect(getModuleClaims()).toEqual({ pettyCash: true, billing: true });
  });
});

describe("module claims with a claim that is not a boolean", () => {
  it('treats anything but a real boolean as on - the string "false", 0 and null included', () => {
    setAuth(jwt({ petty_cash_enabled: "false", billing_enabled: 0 }), "e1", "Co");
    expect(getModuleClaims()).toEqual({ pettyCash: true, billing: true });
    setAuth(jwt({ petty_cash_enabled: null, billing_enabled: "no" }), "e1", "Co");
    expect(getModuleClaims()).toEqual({ pettyCash: true, billing: true });
  });

  it("an array payload is malformed: all on", () => {
    setAuth(`h.${Buffer.from("[false]").toString("base64url")}.s`, "e1", "Co");
    expect(getModuleClaims()).toEqual({ pettyCash: true, billing: true });
  });

  it("each claim is read on its own", () => {
    setAuth(jwt({ petty_cash_enabled: false }), "e1", "Co");
    expect(getModuleClaims()).toEqual({ pettyCash: false, billing: true });
  });
});
