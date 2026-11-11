/**
 * A company's settings chrome - the tab row and the way back - spelled once for every settings
 * page (Figma 353:999, owner 2026-11-10). All six tabs are this app's own pages: Petty Cash
 * Settings and Payment Settings moved into the hub from their apps that day, so no tab leaves the
 * app and the leave guard covers every one.
 *
 * A module's settings tab hides when that module is off (`billing` is Payment Request's claim).
 */

import { companySettingsPath, type CompanySettingsTab } from "@/lib/hubPaths";
import { pettyCashWebUrl } from "@/lib/mintyEntry";
import type { ModuleClaims } from "@/lib/moduleClaims";

export type SettingsTab = {
  label: string;
  /** Absent on the current page's tab. */
  href?: string;
  current?: boolean;
};

export type SettingsCompany = { id: string; name: string };

/** The tabs - and their pages' tab titles ("Users - <company>"). */
export const SETTINGS_TAB_LABELS: Record<CompanySettingsTab, string> = {
  users: "Users",
  general: "General",
  integration: "Integration",
  "petty-cash": "Petty Cash Settings",
  payment: "Payment Settings",
  modules: "Module & Subscription",
};

/** The design's order. */
const ORDER: CompanySettingsTab[] = [
  "users",
  "general",
  "integration",
  "petty-cash",
  "payment",
  "modules",
];

/**
 * The way back: a plain click returns to the page the person came from, whichever app
 * (components/ui/BackLink.tsx, lib/backLink.ts). The href is the fallback for a new tab: Petty
 * Cash's dashboard, on the Petty Cash app (the hand-off picks it when given no page).
 */
export function settingsBackLink(entityId: string): { href: string; label: string } {
  return { href: pettyCashWebUrl(entityId), label: "Back" };
}

export function settingsTabs(
  company: SettingsCompany,
  access: ModuleClaims,
  current: CompanySettingsTab,
): SettingsTab[] {
  const shown = (page: CompanySettingsTab) =>
    (page !== "petty-cash" || access.pettyCash) && (page !== "payment" || access.billing);
  return ORDER.filter(shown).map((page) =>
    page === current
      ? { label: SETTINGS_TAB_LABELS[page], current: true }
      : {
          label: SETTINGS_TAB_LABELS[page],
          href: companySettingsPath(company.id, company.name, page),
        },
  );
}
