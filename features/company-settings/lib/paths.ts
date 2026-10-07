/**
 * Where the feature is mounted: a company's settings, `/entity/<shortid>/<name>/settings/<tab>`
 * (the shell spells the company's pages - `lib/hubPaths.ts` - and this feature owns two tabs).
 */

import { companySettingsPath } from "@/lib/hubPaths";

export function usersPath(entityId: string, entityName: string): string {
  return companySettingsPath(entityId, entityName, "users");
}

export function integrationPath(entityId: string, entityName: string): string {
  return companySettingsPath(entityId, entityName, "integration");
}
