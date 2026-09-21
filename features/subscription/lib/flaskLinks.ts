/**
 * The settings chrome around the module page links to pages that are still Flask's (Part 2
 * leaves everything but subscription in Minty until Part 3). This is the one place those URLs
 * are spelled - the tab strip and the back link read them, nothing else knows about Flask.
 *
 * Flask's own `settings_module.html` hides the Petty Cash and Payment Settings tabs when that
 * module is off; the page model's cards carry `has_access` for the same decision.
 */

import { env } from "@/lib/env";

export type SettingsTab = {
  label: string;
  /** External URL; absent on the current page's tab. */
  href?: string;
  current?: boolean;
};

export type ModuleAccess = { pettyCash: boolean; billing: boolean };

/** `from` as the page received it - `bills` when the payments app sent the person here. */
export type PageOrigin = "bills" | null;

/** Where the page came from, to send it back there: the payments app, or Minty's dashboard. */
export function backLink(entityId: string, from: PageOrigin): { href: string; label: string } {
  if (from === "bills") return { href: env.PAYMENTS_WEB_URL, label: "Payments" };
  return { href: `${env.MINTY_URL}/entity/${encodeURIComponent(entityId)}`, label: "Dashboard" };
}

export function settingsTabs(
  entityId: string,
  access: ModuleAccess,
  from: PageOrigin,
): SettingsTab[] {
  const id = encodeURIComponent(entityId);
  const minty = env.MINTY_URL;
  const tabs: SettingsTab[] = [
    { label: "Users", href: `${minty}/entity/settings/users/${id}` },
    { label: "Entity & Integration", href: `${minty}/entity/${id}/settings/xero` },
  ];
  if (access.pettyCash) {
    tabs.push({ label: "Petty Cash Settings", href: `${minty}/entity/settings/entity/${id}` });
  }
  if (access.billing) {
    // Flask mints the payments app's token on the way (Minty's /entity/settings/payments).
    const qs = from === "bills" ? "?from=bills" : "";
    tabs.push({ label: "Payment Settings", href: `${minty}/entity/settings/payments/${id}${qs}` });
  }
  tabs.push({ label: "Module", current: true });
  return tabs;
}
