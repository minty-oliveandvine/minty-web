// Every link inside the feature goes through lib/paths.ts, so moving the mount point is one
// constant (features/subscription/README.md, extraction step 3).

import { describe, expect, it } from "vitest";

import { companySettingsPath, HUB_PATHS } from "@/lib/hubPaths";

import {
  BILLING,
  PORTAL,
  moduleRoutes,
  overviewPath,
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

  it("names the portal pages minty-payment-request-web had under /profile - no standalone invoices page", () => {
    expect(PORTAL).toEqual({
      index: "/subscription",
      subscriptions: "/subscription/subscriptions",
      subscriber: "/subscription/subscriptions/subscriber",
      incoming: "/subscription/subscriptions/incoming",
      billing: "/subscription/billing",
    });
  });

  it("names one billing account's pages, the URL bare when no account is named", () => {
    // 08-A: which account it shows rides in the URL, never in storage.
    expect(overviewPath()).toBe("/subscription");
    expect(overviewPath("acc-1")).toBe("/subscription?account=acc-1");
    // 08-B: an account, or "the account this company is on".
    expect(BILLING.account()).toBe("/subscription/billing");
    expect(BILLING.account({ id: "acc-1" })).toBe("/subscription/billing?account=acc-1");
    expect(BILLING.account({ entity: "e-1" })).toBe("/subscription/billing?entity=e-1");
    // A card is added ON an account: there is no account-less 08-Y to link to.
    expect(BILLING.add("acc-1")).toBe("/subscription/billing/add?account=acc-1");
    expect(BILLING.edit("pm_1", "acc-1")).toBe(
      "/subscription/billing/edit?card=pm_1&account=acc-1",
    );
    expect(BILLING.added("pm_1", "acc-1")).toBe("/subscription/billing?account=acc-1&added=pm_1");
    expect(BILLING.details("acc/1")).toBe("/subscription/billing/details?account=acc%2F1");
    // A new account is onboarding's sheet over 08-A / 08-B, not a page of its own.
    expect(Object.keys(BILLING)).toEqual(["account", "add", "edit", "added", "details"]);
  });

  it("addresses the module settings page by the company's short id and name, escaped", () => {
    expect(modulesPath("360812e1-9f94-46a3-aa31-347e21afde8e", "Harbour & Vine Ltd")).toBe(
      "/subscription/entities/360812e1/harbour-and-vine-ltd/modules",
    );
    expect(modulesPath("a/b", "")).toBe("/subscription/entities/a%2Fb/company/modules");
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
    // The open row's Change is a sheet, not a route: nothing else is named here.
    expect(Object.keys(r).sort()).toEqual(["activate", "manage", "reactivate", "resume", "started"]);
  });
});

describe("the shell's spelling of this feature's paths", () => {
  // lib/hubPaths.ts spells the mount point and a company's settings page for the shared chrome,
  // which may not import the feature - so the two spellings are pinned together here.
  it("agrees with the feature's own", () => {
    expect(HUB_PATHS.subscription).toBe(SUBSCRIPTION_BASE_PATH);
    expect(companySettingsPath("e 1", "Olive Shop")).toBe(modulesPath("e 1", "Olive Shop"));
  });
});
