// The way back into Minty: /entity/<id>/enter re-establishes the Flask session and forwards to
// `next`, so the person lands signed in. With no company there is nothing to enter, and the
// fallback is this app's own entity list.

import { afterEach, describe, expect, it } from "vitest";

import { clearAuth, setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { mintyEnterCompanyUrl, mintyEntryUrl, mintyModulesUrl } from "@/lib/mintyEntry";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";

describe("mintyEntryUrl", () => {
  afterEach(() => clearAuth());

  it("enters the company the token names, with and without a path", () => {
    setAuth(TOKEN, "e1", "Olive & Vine Limited");
    const base = `${env.PETTY_CASH_URL}/entity/e1/enter?token=${encodeURIComponent(TOKEN)}`;
    expect(mintyEntryUrl()).toBe(base);
    expect(mintyEntryUrl("/entity/e1/reports")).toBe(
      `${base}&next=${encodeURIComponent("/entity/e1/reports")}`,
    );
  });

  it("falls back to the entity list when there is no company to enter", () => {
    setAuth(TOKEN, "", "");
    expect(mintyEntryUrl("/entity/e1/reports")).toBe("/entities");
    clearAuth();
    expect(mintyEntryUrl()).toBe("/entities");
  });

  it("enters ANY company from the entity list, whatever the token is scoped to", () => {
    setAuth(TOKEN, "", "");
    expect(mintyEnterCompanyUrl("e7")).toBe(
      `${env.PETTY_CASH_URL}/entity/e7/enter?token=${encodeURIComponent(TOKEN)}` +
        `&next=${encodeURIComponent("/entity/e7/modules")}`,
    );
    setAuth(TOKEN, "e1", "Olive & Vine Limited");
    expect(mintyEnterCompanyUrl("e7")).toContain("/entity/e7/enter?");
    clearAuth();
    expect(mintyEnterCompanyUrl("e7")).toBe("/entities"); // no token, nothing to enter with
  });

  it("mintyModulesUrl asks Minty to route: the module selection, or the only module on", () => {
    setAuth(TOKEN, "e1", "Olive & Vine Limited");
    expect(mintyModulesUrl("e1")).toContain(encodeURIComponent("/entity/e1/modules"));
    // The caller passes the cookie's own id, so "no id" means no company at all: the list,
    // never a URL built around an empty one.
    clearAuth();
    expect(mintyModulesUrl("")).toBe("/entities");
  });
});
