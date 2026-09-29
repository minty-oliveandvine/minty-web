// My Profile's rules: the plan under the company, where the back arrow goes, and what a save
// sends.

import { afterEach, describe, expect, it } from "vitest";

import { clearAuth, setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { HUB_PATHS } from "@/lib/hubPaths";

import { SCOPED, SUPERMINTY } from "@/features/profile/__fixtures__/profile";
import { PROFILE_BASE_PATH } from "@/features/profile/lib/paths";
import {
  backHref,
  changesFrom,
  EMAIL_REQUIRED,
  planLabel,
} from "@/features/profile/lib/profileView";

describe("profileView", () => {
  afterEach(() => clearAuth());

  it("mounts where the shell says it does", () => {
    expect(PROFILE_BASE_PATH).toBe(HUB_PATHS.profile);
  });

  it("names the plan: SuperMinty for both modules, else the one module in its colour, else nothing", () => {
    expect(planLabel(SUPERMINTY.entity)).toMatchObject({ text: "SuperMinty", cat: true });
    expect(planLabel(SCOPED.entity)).toMatchObject({
      text: "Payment Request",
      tone: "text-[#2e6ff2]",
      cat: false,
    });
    // Petty Cash's amber, the one the subscription screens pair with Payment Request's blue
    expect(planLabel({ ...SCOPED.entity!, modules: ["PETTY_CASH"] })).toMatchObject({
      text: "Petty Cash",
      tone: "text-[#ea9713]",
      cat: false,
    });
    expect(planLabel({ ...SCOPED.entity!, modules: [] })).toBeNull();
    expect(planLabel(null)).toBeNull();
  });

  it("the back arrow: the list, the payments app, or the company it was opened from", () => {
    expect(backHref("", null)).toBe("/entities");
    expect(backHref("", "bills")).toBe("/entities"); // no company: nothing to go back into
    expect(backHref("e1", "bills")).toBe(`${env.PAYMENTS_WEB_URL}/`);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "e1", "Olive Shop");
    expect(backHref("e1", null)).toContain(encodeURIComponent("/entity/e1/modules"));
  });

  it("sends only what changed, and refuses an emptied email before anything is sent", () => {
    const saved = { first_name: "John", last_name: "Birmingha", email: "j@x.com" };
    expect(changesFrom({ ...saved }, saved)).toEqual({ changes: {}, error: null });
    expect(changesFrom({ ...saved, first_name: " Jon " }, saved)).toEqual({
      changes: { first_name: " Jon " },
      error: null,
    });
    // trailing spaces alone are no change: the server trims what it stores
    expect(changesFrom({ ...saved, last_name: "Birmingha " }, saved).changes).toEqual({});
    expect(changesFrom({ ...saved, email: "   " }, saved)).toEqual({
      changes: {},
      error: EMAIL_REQUIRED,
    });
  });
});
