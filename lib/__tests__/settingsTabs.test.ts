// A company's settings chrome (Figma 353:999, owner 2026-11-10): six tabs, every one this app's own
// page under /entity/<shortid>/<name>/settings - Petty Cash Settings and Payment Settings moved into
// the hub from their apps the same day. A module's tab hides when that module is off.

import { beforeEach, describe, expect, it } from "vitest";

import { setAuth } from "@/lib/auth";
import { pettyCashWebUrl } from "@/lib/mintyEntry";
import { settingsBackLink, settingsTabs } from "@/lib/settingsTabs";

const COMPANY = { id: "360812e1-9f94-46a3-aa31-347e21afde8e", name: "Olive & Vine" };
const ALL = { pettyCash: true, billing: true };
const BASE = "/entity/360812e1/olive-and-vine/settings";

beforeEach(() => setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", COMPANY.id, COMPANY.name));

describe("settingsTabs", () => {
  it("names the six tabs in the design's order, the current one without a link", () => {
    const tabs = settingsTabs(COMPANY, ALL, "modules");
    expect(tabs.map((t) => t.label)).toEqual([
      "Users",
      "General",
      "Integration",
      "Petty Cash Settings",
      "Payment Settings",
      "Module & Subscription",
    ]);
    expect(tabs.slice(0, 5).map((t) => t.href)).toEqual([
      `${BASE}/users`,
      `${BASE}/general`,
      `${BASE}/integration`,
      `${BASE}/petty-cash`,
      `${BASE}/payment`,
    ]);
    expect(tabs[5]).toEqual({ label: "Module & Subscription", current: true });
  });

  it("marks whichever tab is open", () => {
    for (const [page, label] of [
      ["users", "Users"],
      ["general", "General"],
      ["integration", "Integration"],
      ["petty-cash", "Petty Cash Settings"],
      ["payment", "Payment Settings"],
    ] as const) {
      const current = settingsTabs(COMPANY, ALL, page).filter((t) => t.current);
      expect(current).toEqual([{ label, current: true }]);
    }
  });

  it("hides a module's settings tab when that module is off", () => {
    const labels = (tabs: ReturnType<typeof settingsTabs>) => tabs.map((t) => t.label);
    expect(
      labels(settingsTabs(COMPANY, { pettyCash: false, billing: true }, "modules")),
    ).not.toContain("Petty Cash Settings");
    expect(
      labels(settingsTabs(COMPANY, { pettyCash: true, billing: false }, "modules")),
    ).not.toContain("Payment Settings");
  });
});

describe("settingsBackLink", () => {
  it("is labelled Back, with the Petty Cash app's dashboard as the new-tab fallback", () => {
    expect(settingsBackLink(COMPANY.id)).toEqual({
      href: pettyCashWebUrl(COMPANY.id),
      label: "Back",
    });
  });
});
