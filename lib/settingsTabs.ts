/**
 * A company's settings chrome - the pill row and the way back - spelled once for every settings
 * page this app draws (the Module tab, Users and Entity & Integration). Petty Cash
 * Settings and Payment Settings stay in their own apps (each app holds only its own settings),
 * so those pills go through Flask, which mints the payments app's token on the way.
 *
 * A module's settings pill hides when that module is off - the same rule as Flask's pill rows and
 * minty-payment-request-web's `SettingsPills`.
 */

import { env } from "@/lib/env";
import { companySettingsPath, type CompanySettingsTab } from "@/lib/hubPaths";
import type { ModuleClaims } from "@/lib/moduleClaims";

export type SettingsTab = {
  label: string;
  /** Absent on the current page's tab. */
  href?: string;
  current?: boolean;
};

export type SettingsCompany = { id: string; name: string };

/**
 * The way back: a plain click returns to the page the person came from, whichever app
 * (components/ui/BackLink.tsx, lib/backLink.ts). The href is the fallback for a new tab: Petty
 * Cash's dashboard (Flask's `/entity/<id>/petty-cash`).
 */
export function settingsBackLink(entityId: string): { href: string; label: string } {
  return {
    href: `${env.PETTY_CASH_URL}/entity/${encodeURIComponent(entityId)}/petty-cash`,
    label: "Back",
  };
}

export function settingsTabs(
  company: SettingsCompany,
  access: ModuleClaims,
  current: CompanySettingsTab,
): SettingsTab[] {
  const id = encodeURIComponent(company.id);
  const flask = env.PETTY_CASH_URL;
  const hub = (tab: CompanySettingsTab) => companySettingsPath(company.id, company.name, tab);
  const tab = (label: string, page: CompanySettingsTab | null, href: string): SettingsTab =>
    page === current ? { label, current: true } : { label, href };

  const tabs: SettingsTab[] = [tab("Users", "users", hub("users")), tab("Entity & Integration", "integration", hub("integration"))];
  if (access.pettyCash) {
    tabs.push(tab("Petty Cash Settings", null, `${flask}/entity/${id}/settings/petty-cash`));
  }
  if (access.billing) {
    tabs.push(tab("Payment Request Settings", null, `${flask}/entity/${id}/settings/payment-request`));
  }
  tabs.push(tab("Modules", "modules", hub("modules")));
  return tabs;
}
