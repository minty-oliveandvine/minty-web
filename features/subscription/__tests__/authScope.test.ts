// Whether the stored token was minted inside a company: the module settings page's is, the one
// Minty's entity list hands the payer portal is not - and the portal trades the first for the
// second on its way back to 08-A.

import { afterEach, describe, expect, it } from "vitest";

import { clearAuth, isEntityScoped, setAuth } from "@/lib/auth";

const token = (claims: Record<string, unknown>) =>
  `h.${btoa(JSON.stringify(claims)).replace(/=+$/, "")}.s`;

describe("isEntityScoped", () => {
  afterEach(() => clearAuth());

  it("a token that names a company is scoped", () => {
    setAuth(token({ user_id: "u1", entity_id: "e1" }), "e1", "Olive & Vine Limited");
    expect(isEntityScoped()).toBe(true);
  });

  it("the entity list's token names none", () => {
    setAuth(token({ user_id: "u1", entity_id: "" }), "", "");
    expect(isEntityScoped()).toBe(false);
  });

  it("either half naming a company is enough - the claim, or the company stored beside it", () => {
    setAuth(token({ user_id: "u1", entity_id: "e1" }), "", "");
    expect(isEntityScoped()).toBe(true);
    setAuth(token({ user_id: "u1", entity_id: "" }), "e1", "Olive & Vine Limited");
    expect(isEntityScoped()).toBe(true);
  });

  it("no token at all is not scoped", () => {
    expect(isEntityScoped()).toBe(false);
  });
});
