// This app's own wrapper around the shared `next` rule: `safeNext` (lib/handoff.ts) falls back to
// the HUB's home, which is minty-web's answer and not the package's. The rule itself - which
// spellings are refused, and why `/\evil.com` was an open redirect - is tested in @minty/shared
// (src/lib/__tests__/safeNext.test.ts), where the one implementation now lives.

import { describe, expect, it } from "vitest";

import { safeNext } from "@/lib/handoff";
import { HUB_HOME } from "@/lib/hubPaths";

describe("handoff's safeNext", () => {
  it("keeps a same-origin path", () => {
    expect(safeNext("/subscription/invoices")).toBe("/subscription/invoices");
  });

  it("falls back to the hub home, not to a bare slash", () => {
    expect(safeNext("//evil.com")).toBe(HUB_HOME);
    expect(safeNext("https://evil.com")).toBe(HUB_HOME);
    expect(safeNext(null)).toBe(HUB_HOME);
  });
});
