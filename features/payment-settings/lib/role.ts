/**
 * Who may change Payment Settings, from the token the page holds - minted for the company the
 * address names (`components/ui/CompanyFromAddress` hands over for it first). minty-payment-request-web's
 * `lib/useUserRole.ts`, cut to the two flags this tab reads:
 *
 * - `isElevated`: accountant, admin or super_admin, and not view-only - an allowlist, the same
 *   set minty-payment-request-api enforces on the writes (`check_edit_bill_settings`);
 * - `isViewOnly`: a system super admin who is not a member of this company - the token's
 *   `is_view_only` claim (accounts-api's `module_token` always mints it). A token without the
 *   claim is read the most restrictive way: a system super admin is view-only.
 */

import { decodeJwtPayload, getAuth } from "@/lib/auth";

const ELEVATED_ROLES = new Set(["accountant", "admin", "super_admin"]);
/** Flask/accounts-api mint "superadmin"; "superuser" is the legacy spelling. */
const SYSTEM_SUPER_ADMIN_ROLES = new Set(["superadmin", "superuser"]);

export type SettingsRole = { isElevated: boolean; isViewOnly: boolean };

export function readSettingsRole(): SettingsRole {
  const payload = decodeJwtPayload(getAuth()?.token ?? "");
  if (!payload) return { isElevated: false, isViewOnly: false };
  const role = typeof payload.role === "string" ? payload.role : "";
  const systemRole = typeof payload.system_role === "string" ? payload.system_role : "";
  const isViewOnly =
    typeof payload.is_view_only === "boolean"
      ? payload.is_view_only
      : SYSTEM_SUPER_ADMIN_ROLES.has(systemRole.trim().toLowerCase());
  const normalized = role.trim().toLowerCase().replace(/ /g, "_").replace(/-/g, "_");
  return { isElevated: ELEVATED_ROLES.has(normalized) && !isViewOnly, isViewOnly };
}
