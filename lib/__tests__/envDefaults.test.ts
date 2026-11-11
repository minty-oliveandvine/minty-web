// The local defaults are the owner's port layout (2026-10-16, Documents\dev.ps1): Flask (accounts-api)
// on 8000, minty-subscription-api on 8001. An app started without .env.local must reach the same
// services the e2e helpers stub and the dev launcher starts.

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllEnvs());

describe("local defaults", () => {
  it("Flask on 8000 and subscription-api on 8001 when nothing is set", async () => {
    vi.resetModules();
    vi.stubEnv("ACCOUNTS_API_URL", "");
    vi.stubEnv("SUBSCRIPTION_API_URL", "");
    const { env } = await import("@/lib/env");
    expect(env.ACCOUNTS_API_URL).toBe("http://localhost:8000");
    expect(env.SUBSCRIPTION_API_URL).toBe("http://localhost:8001");
  });

  it("the Petty Cash API on 8010 and the Payment Request API on 8020 when nothing is set", async () => {
    // The Petty Cash Settings and Payment Settings tabs (in the hub since 2026-11-10).
    vi.resetModules();
    vi.stubEnv("PETTY_CASH_API_URL", "");
    vi.stubEnv("PAYMENT_REQUEST_API_URL", "");
    const { env } = await import("@/lib/env");
    expect(env.PETTY_CASH_API_URL).toBe("http://localhost:8010");
    expect(env.PAYMENT_REQUEST_API_URL).toBe("http://localhost:8020");
  });

  it("strips a trailing slash from the two API addresses", async () => {
    vi.resetModules();
    vi.stubEnv("PETTY_CASH_API_URL", "https://pettycash-api.example/");
    vi.stubEnv("PAYMENT_REQUEST_API_URL", "https://payment-request-api.example//");
    const { env } = await import("@/lib/env");
    expect(env.PETTY_CASH_API_URL).toBe("https://pettycash-api.example");
    expect(env.PAYMENT_REQUEST_API_URL).toBe("https://payment-request-api.example");
  });
});
