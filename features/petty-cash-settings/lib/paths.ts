/**
 * Where the feature is mounted - a company's Petty Cash Settings tab,
 * `/entity/<shortid>/<name>/settings/petty-cash` (the shell spells the company's pages,
 * `lib/hubPaths.ts`) - and where its link goes: the Integration tab, where Xero is connected. (The
 * first mapping save used to leave for the Petty Cash dashboard; since 2026-11-11 it stays, owner.)
 */

import { companySettingsPath } from "@/lib/hubPaths";

export function pettyCashSettingsPath(entityId: string, entityName: string): string {
  return companySettingsPath(entityId, entityName, "petty-cash");
}

/** "Xero isn't connected. Connect it in Integration…" - this app's Integration tab. */
export function connectXeroPath(entityId: string, entityName: string): string {
  return companySettingsPath(entityId, entityName, "integration");
}
