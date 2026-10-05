// The settings chrome links to Flask's pages; these pin where, and which tabs hide when a
// module is off (Flask's settings_module.html does the same).

import { describe, expect, it } from "vitest";

import { env } from "@/lib/env";

import { backLink, settingsTabs } from "@/features/subscription/lib/flaskLinks";

describe("settingsTabs", () => {
  it("names the five tabs, Module being this page", () => {
    const tabs = settingsTabs("e1", { pettyCash: true, billing: true });
    expect(tabs.map((t) => t.label)).toEqual([
      "Users",
      "Entity & Integration",
      "Petty Cash Settings",
      "Payment Settings",
      "Module",
    ]);
    expect(tabs[0].href).toBe(`${env.PETTY_CASH_URL}/entity/settings/users/e1`);
    expect(tabs[1].href).toBe(`${env.PETTY_CASH_URL}/entity/e1/settings/xero`);
    expect(tabs[2].href).toBe(`${env.PETTY_CASH_URL}/entity/settings/entity/e1`);
    expect(tabs[3].href).toBe(`${env.PETTY_CASH_URL}/entity/settings/payments/e1`);
    expect(tabs[4]).toEqual({ label: "Module", current: true });
  });

  it("hides a module's settings tab when that module is off", () => {
    const labels = (tabs: ReturnType<typeof settingsTabs>) => tabs.map((t) => t.label);
    expect(labels(settingsTabs("e1", { pettyCash: false, billing: true }))).not.toContain(
      "Petty Cash Settings",
    );
    expect(labels(settingsTabs("e1", { pettyCash: true, billing: false }))).not.toContain(
      "Payment Settings",
    );
  });

  it("links Payment Settings through Flask, with no origin flag, and escapes the id", () => {
    const tabs = settingsTabs("a/b", { pettyCash: true, billing: true });
    expect(tabs[3].href).toBe(`${env.PETTY_CASH_URL}/entity/settings/payments/a%2Fb`);
    expect(tabs[0].href).toBe(`${env.PETTY_CASH_URL}/entity/settings/users/a%2Fb`);
  });
});

describe("backLink", () => {
  it("is labelled Back, with Petty Cash's dashboard as the new-tab fallback", () => {
    expect(backLink("e1")).toEqual({
      href: `${env.PETTY_CASH_URL}/entity/e1`,
      label: "Back",
    });
  });
});
