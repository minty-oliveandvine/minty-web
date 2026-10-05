// The `next` rule (lib/safeNext.ts): only a path on this origin survives. The off-site
// spellings below each landed on https://evil.com/ under the old startsWith check.

import { describe, expect, it } from "vitest";

import { safeNext } from "@/lib/handoff";
import { HUB_HOME } from "@/lib/hubPaths";
import { safeNextPath } from "@/lib/safeNext";

describe("safeNextPath", () => {
  it.each([
    "/entities",
    "/subscription/entities/abc/modules?from=bills",
    "/profile#section",
  ])("keeps the same-origin path %s", (path) => {
    expect(safeNextPath(path, "/fallback")).toBe(path);
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["backslash", "/\\evil.com"],
    ["tab", "/\t/evil.com"],
    ["newline", "/\n/evil.com"],
    ["carriage return", "/\r/evil.com"],
    ["absolute URL", "https://evil.com"],
    ["javascript:", "javascript:alert(1)"],
    ["relative", "evil.com"],
    ["empty", ""],
  ])("refuses %s", (_label, raw) => {
    expect(safeNextPath(raw, "/fallback")).toBe("/fallback");
  });

  it("refuses null and undefined", () => {
    expect(safeNextPath(null, "/fallback")).toBe("/fallback");
    expect(safeNextPath(undefined, "/fallback")).toBe("/fallback");
  });

  it("handoff's safeNext falls back to the hub home", () => {
    expect(safeNext("/\\evil.com")).toBe(HUB_HOME);
  });
});
