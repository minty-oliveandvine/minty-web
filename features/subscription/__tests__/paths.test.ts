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

  it("names the pages a module card's CTA leads to, under the module page", () => {
    const r = moduleRoutes("abc-123");
    expect(r.manage).toBe("/subscription/subscriptions?entity=abc-123");
    expect(r.activate("PETTY_CASH")).toBe(
      "/subscription/entities/abc-123/modules/activate/PETTY_CASH",
    );
    expect(r.resume("PETTY_CASH")).toBe("/subscription/entities/abc-123/modules/resume/PETTY_CASH");
    expect(r.reactivate("PAYMENT_REQUEST")).toBe(
      "/subscription/entities/abc-123/modules/reactivate/PAYMENT_REQUEST",
    );
    expect(r.paymentMethod).toBe("/subscription/entities/abc-123/modules/payment-method");
  });
});
