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

/**
 * The way back: a plain click returns to the page the person came from, whichever app
 * (components/ui/BackLink.tsx, lib/backLink.ts - the `?from=bills` flag went 2026-10-05). The
 * href is the fallback for a new tab: Petty Cash's dashboard (Flask's `/entity/<id>`).
 */
export function backLink(entityId: string): { href: string; label: string } {
  return { href: `${env.PETTY_CASH_URL}/entity/${encodeURIComponent(entityId)}`, label: "Back" };
}

export function settingsTabs(entityId: string, access: ModuleAccess): SettingsTab[] {
  const id = encodeURIComponent(entityId);
  const minty = env.PETTY_CASH_URL;
  const tabs: SettingsTab[] = [
    { label: "Users", href: `${minty}/entity/${id}/settings/users` },
    { label: "Entity & Integration", href: `${minty}/entity/${id}/settings/integration` },
  ];
  if (access.pettyCash) {
    tabs.push({ label: "Petty Cash Settings", href: `${minty}/entity/${id}/settings/petty-cash` });
  }
  if (access.billing) {
    // Flask mints the payments app's token on the way (Minty's /entity/<id>/settings/payment-request).
    tabs.push({ label: "Payment Settings", href: `${minty}/entity/${id}/settings/payment-request` });
  }
  tabs.push({ label: "Module", current: true });
  return tabs;
}
