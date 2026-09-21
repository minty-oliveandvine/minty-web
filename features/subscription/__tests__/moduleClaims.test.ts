// The token's module claims (lib/moduleClaims.ts, billing-frontend's getModuleClaims ported):
// what the settings pills and the drawer show before the page model has answered.

import { describe, expect, it } from "vitest";

import { setAuth } from "@/lib/auth";
import { getModuleClaims } from "@/lib/moduleClaims";

function jwt(claims: Record<string, unknown>): string {
  const b64 = (s: string) => Buffer.from(s).toString("base64url");
  return `${b64(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64(JSON.stringify(claims))}.sig`;
}

describe("getModuleClaims", () => {
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
