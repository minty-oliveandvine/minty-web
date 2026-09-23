// The way back into Minty: /entity/<id>/enter re-establishes the Flask session and forwards to
// `next`, so the person lands signed in. With no company there is nothing to enter.

import { afterEach, describe, expect, it } from "vitest";

import { clearAuth, setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { mintyEntryUrl, mintyModulesUrl } from "@/lib/mintyEntry";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";

describe("mintyEntryUrl", () => {
  afterEach(() => clearAuth());

  it("enters the company the token names, with and without a path", () => {
    setAuth(TOKEN, "e1", "Olive & Vine Limited");
    const base = `${env.MINTY_URL}/entity/e1/enter?token=${encodeURIComponent(TOKEN)}`;
    expect(mintyEntryUrl()).toBe(base);
    expect(mintyEntryUrl("/entity/e1/reports")).toBe(
      `${base}&next=${encodeURIComponent("/entity/e1/reports")}`,
    );
  });

  it("falls back to the entity list when there is no company to enter", () => {
    setAuth(TOKEN, "", "");
    expect(mintyEntryUrl("/entity/e1/reports")).toBe(`${env.MINTY_URL}/entity`);
    clearAuth();
    expect(mintyEntryUrl()).toBe(`${env.MINTY_URL}/entity`);
  });

  it("mintyModulesUrl asks Minty to route: the module selection, or the only module on", () => {
    setAuth(TOKEN, "e1", "Olive & Vine Limited");
    expect(mintyModulesUrl("e1")).toContain(encodeURIComponent("/entity/e1/modules"));
    // The caller passes the cookie's own id, so "no id" means no company at all: the list,
    // never a URL built around an empty one.
    clearAuth();
    expect(mintyModulesUrl("")).toBe(`${env.MINTY_URL}/entity`);
  });
});
