// The Module tab's pre-phase-2 addresses move to the company's settings (proxy.ts).

import { describe, expect, it } from "vitest";

import { movedModulePage } from "@/proxy";

describe("movedModulePage", () => {
  it("moves the short-id address to the company's settings", () => {
    expect(movedModulePage("/subscription/entities/360812e1/olive-and-vine/modules")).toBe(
      "/entities/360812e1/olive-and-vine/settings/modules",
    );
  });

  it("moves the full-id address with a placeholder name the page corrects", () => {
    expect(movedModulePage("/subscription/entities/360812e1-9f94-46a3-aa31-347e21afde8e/modules")).toBe(
      "/entities/360812e1-9f94-46a3-aa31-347e21afde8e/company/settings/modules",
    );
  });

  it("leaves every other address alone", () => {
    for (const path of [
      "/subscription",
      "/subscription/subscriptions",
      "/entities",
      "/entities/360812e1/olive-and-vine/settings/modules",
      "/subscription/entities/a/b/c/modules",
    ]) {
      expect(movedModulePage(path)).toBeNull();
    }
  });
});
