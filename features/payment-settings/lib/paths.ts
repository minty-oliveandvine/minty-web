/**
 * Where the feature is mounted: a company's Payment Settings tab,
 * `/entity/<shortid>/<name>/settings/payment` (the shell spells the company's pages -
 * `lib/hubPaths.ts`). Integration is where Xero is connected - the way on from a Xero-less card.
 */

import { companySettingsPath } from "@/lib/hubPaths";

export function paymentSettingsPath(entityId: string, entityName: string): string {
  return companySettingsPath(entityId, entityName, "payment");
}

export function integrationPath(entityId: string, entityName: string): string {
  return companySettingsPath(entityId, entityName, "integration");
}
