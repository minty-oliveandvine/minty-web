/**
 * Where the feature is mounted - a company's Petty Cash Settings tab,
 * `/entity/<shortid>/<name>/settings/petty-cash` (the shell spells the company's pages,
 * `lib/hubPaths.ts`) - and where its links go: the Integration tab, where Xero is connected, and
 * the company's Petty Cash dashboard in the Petty Cash app (after the first mapping save).
 */

import { companySettingsPath } from "@/lib/hubPaths";
import { pettyCashWebUrl } from "@/lib/mintyEntry";

export function pettyCashSettingsPath(entityId: string, entityName: string): string {
  return companySettingsPath(entityId, entityName, "petty-cash");
}

/** "Xero isn't connected. Connect it in Integration…" - this app's Integration tab. */
export function connectXeroPath(entityId: string, entityName: string): string {
  return companySettingsPath(entityId, entityName, "integration");
}

/** The company's Petty Cash dashboard: the Petty Cash app, through accounts-api's hand-off. */
export function pettyCashDashboardUrl(entityId: string): string {
  return pettyCashWebUrl(entityId);
}

/** Leaves the hub for another app - a full-page navigation (one function, so tests can see it). */
export function leaveFor(url: string): void {
  window.location.assign(url);
}
