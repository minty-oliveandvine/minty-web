/**
 * A company's settings chrome - the tab row and the way back - spelled once for every settings
 * page (Figma 353:999, owner 2026-11-10). All six tabs are this app's own pages: Petty Cash
 * Settings and Payment Settings moved into the hub from their apps that day, so no tab leaves the
 * app and the leave guard covers every one.
 *
 * A module's settings tab hides when that module is off (`billing` is Payment Request's claim).
 * Users hides below shop manager (owner, 2026-11-12): accounts-api refuses them the list
 * (USER_VIEW_ALL), so the tab would only open on a refusal.
 */

import { decodeJwtPayload, getAuth } from "@/lib/auth";
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
 * (`@minty/shared/backLink`, `HUB_BACK`). The href is the fallback for a new tab: Petty
 * Cash's dashboard, on the Petty Cash app (the hand-off picks it when given no page).
 */
export function settingsBackLink(entityId: string): { href: string; label: string } {
  return { href: pettyCashWebUrl(entityId), label: "Back" };
}

/** Below shop manager: entity_base and cashier (the API's rank ladder, minty_shared.policy). */
const BELOW_USERS = new Set(["entity_base", "cashier", "client", "user", "no_role", "none"]);
const SYSTEM_SUPER_ADMIN = new Set(["superadmin", "superuser"]);

/**
 * Whether the person may see the company's users, from the token the page holds (minted for this
 * company). A token naming no role hides nothing - an old token must never take navigation away;
 * Minty staff visiting read the list (the API's superuser read-only views).
 */
export function seesCompanyUsers(): boolean {
  const payload = decodeJwtPayload(getAuth()?.token ?? "");
  if (!payload) return true;
  const systemRole = typeof payload.system_role === "string" ? payload.system_role : "";
  if (SYSTEM_SUPER_ADMIN.has(systemRole.trim().toLowerCase())) return true;
  if (typeof payload.role !== "string") return true;
  const role = payload.role.trim().toLowerCase().replace(/[ -]/g, "_");
  return !BELOW_USERS.has(role);
}

export function settingsTabs(
  company: SettingsCompany,
  access: ModuleClaims,
  current: CompanySettingsTab,
): SettingsTab[] {
  const users = current === "users" || seesCompanyUsers();
  const shown = (page: CompanySettingsTab) =>
    (page !== "users" || users) &&
    (page !== "petty-cash" || access.pettyCash) &&
    (page !== "payment" || access.billing);
  return ORDER.filter(shown).map((page) =>
    page === current
      ? { label: SETTINGS_TAB_LABELS[page], current: true }
      : {
          label: SETTINGS_TAB_LABELS[page],
          href: companySettingsPath(company.id, company.name, page),
        },
  );
}
