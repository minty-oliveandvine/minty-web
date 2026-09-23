// Every link inside the feature goes through lib/paths.ts, so moving the mount point is one
// constant (features/subscription/README.md, extraction step 3).

import { describe, expect, it } from "vitest";

import {
  PORTAL,
  moduleRoutes,
  SUBSCRIPTION_BASE_PATH,
  modulesPath,
  subscriptionPath,
} from "@/features/subscription/lib/paths";

describe("subscription paths", () => {
  it("mounts under the base path", () => {
    expect(SUBSCRIPTION_BASE_PATH).toBe("/subscription");
    expect(subscriptionPath()).toBe("/subscription");
    expect(subscriptionPath("/")).toBe("/subscription");
    expect(subscriptionPath("billing")).toBe("/subscription/billing");
    expect(subscriptionPath("/billing")).toBe("/subscription/billing");
  });

  it("names the portal pages billing-frontend had under /profile", () => {
    expect(PORTAL).toEqual({
      index: "/subscription",
      subscriptions: "/subscription/subscriptions",
      subscriber: "/subscription/subscriptions/subscriber",
      incoming: "/subscription/subscriptions/incoming",
      billing: "/subscription/billing",
      invoices: "/subscription/invoices",
    });
  });

  it("escapes the company id in the module settings path", () => {
    expect(modulesPath("abc-123")).toBe("/subscription/entities/abc-123/modules");
    expect(modulesPath("a/b")).toBe("/subscription/entities/a%2Fb/modules");
  });

  it("names where a module card's CTA leads", () => {
    const r = moduleRoutes("abc-123");
    expect(r.manage).toBe("/subscription/subscriptions?entity=abc-123");
    // Activate / Resume / Reactivate are one module's pending change, which the open row
    // already says: the list, this company, that module ticked.
    expect(r.activate("PETTY_CASH")).toBe(
      "/subscription/subscriptions?entity=abc-123&tick=PETTY_CASH",
    );
    expect(r.resume("PETTY_CASH")).toBe(r.activate("PETTY_CASH"));
    expect(r.reactivate("PAYMENT_REQUEST")).toBe(
      "/subscription/subscriptions?entity=abc-123&tick=PAYMENT_REQUEST",
    );
    // Still a page of its own, still unbuilt.
    expect(r.paymentMethod).toBe("/subscription/entities/abc-123/modules/payment-method");
  });
});
