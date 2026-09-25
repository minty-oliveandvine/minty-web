// The portal's tab bar: which tab is current on which path.
//
// Worth its own file for one reason. Every portal path starts with `/subscription/`, so the
// landing's own tab - whose href IS `/subscription` - lights up on every page in the portal
// unless it is matched exactly. That bug is invisible in a screenshot of the landing, where the
// tab is correctly current, and only shows as TWO lit tabs one page further in.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PortalTabs } from "@/features/subscription/routes/PortalTabs";

const pathname = vi.fn(() => "/subscription");
vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

function tabsOn(path: string) {
  pathname.mockReturnValue(path);
  const { unmount } = render(<PortalTabs />);
  const nav = screen.getByRole("navigation", { name: "Subscription sections" });
  const current = Array.from(nav.querySelectorAll('[aria-current="page"]')).map(
    (el) => el.textContent,
  );
  const all = Array.from(nav.querySelectorAll("a")).map((el) => el.textContent);
  unmount();
  return { current, all };
}

describe("PortalTabs", () => {
  it("offers the landing, the list, billing and invoices", () => {
    expect(tabsOn("/subscription").all).toEqual([
      "Overview",
      "Manage Subscriptions",
      "Billing",
      "Invoices",
    ]);
  });

  it("marks exactly one tab current, whichever page you are on", () => {
    for (const path of [
      "/subscription",
      "/subscription/subscriptions",
      "/subscription/billing",
      "/subscription/billing/add",
      "/subscription/billing/details",
      "/subscription/invoices",
      "/subscription/subscriptions/incoming",
    ]) {
      expect(tabsOn(path).current, path).toHaveLength(1);
    }
  });

  it("the landing's tab is current ONLY on the landing", () => {
    expect(tabsOn("/subscription").current).toEqual(["Overview"]);
    // The prefix trap: `/subscription/...`.startsWith("/subscription/") is true of everything.
    expect(tabsOn("/subscription/subscriptions").current).toEqual(["Manage Subscriptions"]);
    expect(tabsOn("/subscription/billing/add").current).toEqual(["Billing"]);
    // A billing account's own page is Billing's too: 08-C.
    expect(tabsOn("/subscription/billing/details").current).toEqual(["Billing"]);
  });

  it("a sub-page keeps its section's tab current", () => {
    expect(tabsOn("/subscription/subscriptions/subscriber").current).toEqual([
      "Manage Subscriptions",
    ]);
  });
});
