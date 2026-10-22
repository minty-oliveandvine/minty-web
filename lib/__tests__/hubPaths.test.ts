// Where the hub mounts things (lib/hubPaths.ts): a company's address, its settings tabs, and the
// pages proxy.ts lets through without a token.

import { describe, expect, it } from "vitest";

import { companyPath } from "@minty/shared/companyRef";

import {
  COMPANY_SETTINGS_PATTERN,
  HUB_HOME,
  HUB_PATHS,
  OPEN_PATHS,
  companySettingsPath,
  isOpenPath,
} from "@/lib/hubPaths";

const ID = "360812E1-9f94-46a3-aa31-347e21afde8e";

describe("hub paths", () => {
  it("mounts the four areas, and the list is home", () => {
    expect(HUB_PATHS).toEqual({
      entities: "/entities",
      company: "/entity",
      profile: "/profile",
      subscription: "/subscription",
    });
    expect(HUB_HOME).toBe("/entities");
  });

  it("companyPath (@minty/shared/companyRef) is /entity/<8-char lowercased id>/<slug>/<segments>", () => {
    expect(companyPath(ID, "Olive & Vine")).toBe("/entity/360812e1/olive-and-vine");
    expect(companyPath(ID, "Olive & Vine", "/settings/users")).toBe(
      "/entity/360812e1/olive-and-vine/settings/users",
    );
    expect(companyPath(ID, "Olive & Vine", "settings", "users")).toBe(
      "/entity/360812e1/olive-and-vine/settings/users",
    );
    // owner 2026-10-21: one shared module (@minty/shared/companyRef) - segments are joined with
    // "/" (it glued the sub on as it stood: "/entity/360812e1/cox"); every caller here passed a
    // leading slash, so no address changed
    expect(companyPath(ID, "Co", "x")).toBe("/entity/360812e1/co/x");
  });

  it('an empty or all-punctuation name reads as "company"; other scripts are kept, encoded', () => {
    expect(companyPath(ID, "")).toBe("/entity/360812e1/company");
    expect(companyPath(ID, "!!!")).toBe("/entity/360812e1/company");
    expect(companyPath("abc", "美心")).toBe(`/entity/abc/${encodeURIComponent("美心")}`);
  });

  it("companySettingsPath defaults to the Module tab", () => {
    expect(companySettingsPath(ID, "Co")).toBe("/entity/360812e1/co/settings/modules");
    expect(companySettingsPath(ID, "Co", "integration")).toBe(
      "/entity/360812e1/co/settings/integration",
    );
  });

  it("COMPANY_SETTINGS_PATTERN matches one tab under a company, a trailing slash allowed", () => {
    expect(COMPANY_SETTINGS_PATTERN.test("/entity/360812e1/co/settings/users")).toBe(true);
    expect(COMPANY_SETTINGS_PATTERN.test("/entity/360812e1/co/settings/users/")).toBe(true);
    expect(COMPANY_SETTINGS_PATTERN.test("/entity/360812e1/co/settings")).toBe(false);
    expect(COMPANY_SETTINGS_PATTERN.test("/entity/360812e1/co/settings/users/x")).toBe(false);
    expect(COMPANY_SETTINGS_PATTERN.test("/entities/360812e1/co/settings/users")).toBe(false);
  });

  it("the open pages are the landing, sign-in, maintenance and the legal documents", () => {
    expect([...OPEN_PATHS]).toEqual([
      "/landing",
      "/login",
      "/signup",
      "/maintenance",
      "/terms",
      "/privacy",
    ]);
  });

  it("isOpenPath takes the page and anything below it, never a mere prefix", () => {
    expect(isOpenPath("/terms")).toBe(true);
    expect(isOpenPath("/terms/beta-1")).toBe(true);
    expect(isOpenPath("/login/")).toBe(true);
    expect(isOpenPath("/termsx")).toBe(false);
    expect(isOpenPath("/landing-page")).toBe(false);
    expect(isOpenPath("/")).toBe(false);
    expect(isOpenPath("/entities")).toBe(false);
  });
});
