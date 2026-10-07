// The addresses that moved: the Module tab's pre-phase-2 ones, and a company's pages from the
// plural `/entities/…` to the singular `/entity/…` (proxy.ts).

import { describe, expect, it } from "vitest";

import { movedModulePage } from "@/proxy";

describe("movedModulePage", () => {
  it("moves the short-id address to the company's settings", () => {
    expect(movedModulePage("/subscription/entities/360812e1/olive-and-vine/modules")).toBe(
      "/entity/360812e1/olive-and-vine/settings/modules",
    );
  });

  it("moves the full-id address with a placeholder name the page corrects", () => {
    expect(movedModulePage("/subscription/entities/360812e1-9f94-46a3-aa31-347e21afde8e/modules")).toBe(
      "/entity/360812e1-9f94-46a3-aa31-347e21afde8e/company/settings/modules",
    );
  });

  it("moves a company's plural address to the singular one, path and depth kept", () => {
    expect(movedModulePage("/entities/360812e1/olive-and-vine")).toBe("/entity/360812e1/olive-and-vine");
    expect(movedModulePage("/entities/360812e1/olive-and-vine/settings/users")).toBe(
      "/entity/360812e1/olive-and-vine/settings/users",
    );
  });

  it("leaves every other address alone - the list included", () => {
    for (const path of [
      "/subscription",
      "/subscription/subscriptions",
      "/entities",
      "/entities/",
      "/entity/360812e1/olive-and-vine/settings/modules",
      "/subscription/entities/a/b/c/modules",
    ]) {
      expect(movedModulePage(path)).toBeNull();
    }
  });
});
