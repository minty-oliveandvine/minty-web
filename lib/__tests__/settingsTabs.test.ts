// A company's settings chrome: which tabs show, where each goes, and the way back. Petty Cash
// and Payment Settings stay in their apps (through Flask's hand-offs); Users, Entity & Integration
// and the Module tab are this app's own pages under /entity/<shortid>/<name>/settings (phase 2).

import { beforeEach, describe, expect, it } from "vitest";

import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { pettyCashWebUrl } from "@/lib/mintyEntry";
import { settingsBackLink, settingsTabs } from "@/lib/settingsTabs";

const COMPANY = { id: "360812e1-9f94-46a3-aa31-347e21afde8e", name: "Olive & Vine" };
const ALL = { pettyCash: true, billing: true };
const FLASK = `${env.PETTY_CASH_URL}/entity/${COMPANY.id}`;

beforeEach(() => setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", COMPANY.id, COMPANY.name));

describe("settingsTabs", () => {
  it("names the five tabs, the current one without a link", () => {
    const tabs = settingsTabs(COMPANY, ALL, "modules");
    expect(tabs.map((t) => t.label)).toEqual([
      "Users",
      "Entity & Integration",
      "Petty Cash Settings",
      "Payment Request Settings",
      "Modules",
    ]);
    expect(tabs[0].href).toBe("/entity/360812e1/olive-and-vine/settings/users");
    expect(tabs[1].href).toBe("/entity/360812e1/olive-and-vine/settings/integration");
    // Petty Cash Settings is the Petty Cash app's page, through Flask's hand-off (Step 5)
    expect(tabs[2].href).toBe(
      pettyCashWebUrl(COMPANY.id, "/entity/360812e1/olive-and-vine/settings/petty-cash"),
    );
    expect(tabs[3].href).toBe(`${FLASK}/settings/payment-request`);
    expect(tabs[4]).toEqual({ label: "Modules", current: true });
  });

  it("links the Module tab to this app's page from another tab", () => {
    const tabs = settingsTabs(COMPANY, ALL, "users");
    expect(tabs[0]).toEqual({ label: "Users", current: true });
    expect(tabs[1]).toEqual({ label: "Entity & Integration", href: "/entity/360812e1/olive-and-vine/settings/integration" });
    expect(tabs[4]).toEqual({
      label: "Modules",
      href: "/entity/360812e1/olive-and-vine/settings/modules",
    });
  });

  it("hides a module's settings tab when that module is off", () => {
    const labels = (tabs: ReturnType<typeof settingsTabs>) => tabs.map((t) => t.label);
    expect(labels(settingsTabs(COMPANY, { pettyCash: false, billing: true }, "modules"))).not.toContain(
      "Petty Cash Settings",
    );
    expect(labels(settingsTabs(COMPANY, { pettyCash: true, billing: false }, "modules"))).not.toContain(
      "Payment Request Settings",
    );
  });

  it("escapes the id in Flask's links", () => {
    const tabs = settingsTabs({ id: "a/b", name: "" }, ALL, "modules");
    expect(tabs[3].href).toBe(`${env.PETTY_CASH_URL}/entity/a%2Fb/settings/payment-request`);
  });
});

describe("settingsBackLink", () => {
  it("is labelled Back, with the Petty Cash app's dashboard as the new-tab fallback", () => {
    expect(settingsBackLink(COMPANY.id)).toEqual({ href: pettyCashWebUrl(COMPANY.id), label: "Back" });
  });
});
