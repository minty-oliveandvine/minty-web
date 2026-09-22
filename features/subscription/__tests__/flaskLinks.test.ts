// The settings chrome links to Flask's pages; these pin where, and which tabs hide when a
// module is off (Flask's settings_module.html does the same).

import { describe, expect, it } from "vitest";

import { env } from "@/lib/env";

import { backLink, settingsTabs } from "@/features/subscription/lib/flaskLinks";

describe("settingsTabs", () => {
  it("names the five tabs, Module being this page", () => {
    const tabs = settingsTabs("e1", { pettyCash: true, billing: true }, null);
    expect(tabs.map((t) => t.label)).toEqual([
      "Users",
      "Entity & Integration",
      "Petty Cash Settings",
      "Payment Settings",
      "Module",
    ]);
    expect(tabs[0].href).toBe(`${env.MINTY_URL}/entity/settings/users/e1`);
    expect(tabs[1].href).toBe(`${env.MINTY_URL}/entity/e1/settings/xero`);
    expect(tabs[2].href).toBe(`${env.MINTY_URL}/entity/settings/entity/e1`);
    expect(tabs[3].href).toBe(`${env.MINTY_URL}/entity/settings/payments/e1`);
    expect(tabs[4]).toEqual({ label: "Module", current: true });
  });

  it("hides a module's settings tab when that module is off", () => {
    const labels = (tabs: ReturnType<typeof settingsTabs>) => tabs.map((t) => t.label);
    expect(labels(settingsTabs("e1", { pettyCash: false, billing: true }, null))).not.toContain(
      "Petty Cash Settings",
    );
    expect(labels(settingsTabs("e1", { pettyCash: true, billing: false }, null))).not.toContain(
      "Payment Settings",
    );
  });

  it("carries from=bills to Payment Settings and escapes the id", () => {
    const tabs = settingsTabs("a/b", { pettyCash: true, billing: true }, "bills");
    expect(tabs[3].href).toBe(`${env.MINTY_URL}/entity/settings/payments/a%2Fb?from=bills`);
    expect(tabs[0].href).toBe(`${env.MINTY_URL}/entity/settings/users/a%2Fb`);
  });
});

describe("backLink", () => {
  it("goes back to the payments app when it sent the person, else to Petty Cash's reports", () => {
    expect(backLink("e1", "bills")).toEqual({ href: env.PAYMENTS_WEB_URL, label: "Payments" });
    expect(backLink("e1", null)).toEqual({
      href: `${env.MINTY_URL}/entity/e1`,
      label: "Reports",
    });
  });
});
