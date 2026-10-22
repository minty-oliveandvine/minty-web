// The local defaults are the owner's port layout (2026-10-16, Documents\dev.ps1): Flask (accounts-api)
// on 8000, minty-subscription-api on 8001. An app started without .env.local must reach the same
// services the e2e helpers stub and the dev launcher starts.

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

describe("local defaults", () => {
  it("Flask on 8000 and subscription-api on 8001 when nothing is set", async () => {
    vi.resetModules();
    vi.stubEnv("PETTY_CASH_URL", "");
    vi.stubEnv("SUBSCRIPTION_API_URL", "");
    const { env } = await import("@/lib/env");
    expect(env.PETTY_CASH_URL).toBe("http://localhost:8000");
    expect(env.SUBSCRIPTION_API_URL).toBe("http://localhost:8001");
  });
});

describe("envUrl(name, raw, devFallback)", () => {
  // lib/env.ts's rule is @minty/shared/env's envUrl (the shared-code refactor, 2026-10-21)
  async function load(raw: string | undefined) {
    vi.resetModules();
    if (raw === undefined) {
      vi.stubEnv("PAYMENT_REQUEST_WEB_URL", undefined);
    } else {
      vi.stubEnv("PAYMENT_REQUEST_WEB_URL", raw);
    }
    return (await import("@/lib/env")).env.PAYMENT_REQUEST_WEB_URL;
  }

  it("trims, then strips EVERY trailing slash", async () => {
    expect(await load("  https://pay.example.com///  ")).toBe("https://pay.example.com");
    expect(await load("https://pay.example.com/base/")).toBe("https://pay.example.com/base");
  });

  it("falls back for unset, empty or whitespace-only", async () => {
    expect(await load(undefined)).toBe("http://localhost:3020");
    expect(await load("")).toBe("http://localhost:3020");
    expect(await load("   ")).toBe("http://localhost:3020");
  });

  it("does not validate: anything else stands as written", async () => {
    expect(await load("not a url")).toBe("not a url");
  });

  it("a lone slash is blank, so it falls back", async () => {
    // owner 2026-10-21: one shared module (@minty/shared/env) - it was "" (the strip ran after the check)
    expect(await load("/")).toBe("http://localhost:3020");
  });

  it("throws in a production build when a URL is unset, naming it", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SUBSCRIPTION_API_URL", "https://sub.example.com");
    vi.stubEnv("PETTY_CASH_URL", "https://flask.example.com");
    await expect(load("")).rejects.toThrow(/PAYMENT_REQUEST_WEB_URL is not set/);
  });
});
