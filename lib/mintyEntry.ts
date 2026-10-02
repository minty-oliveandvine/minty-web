/**
 * The way back into Minty for the company this browser holds a token for.
 *
 * Minty's `/entity/<id>/enter` (`entity.module_reenter`) takes the cookie's token, validates it,
 * re-establishes the Flask session and forwards to `next` - so the person lands where they were
 * going, signed in, instead of on a login screen. minty-payment-request-web goes in the same way.
 *
 * With no company or no token there is nothing to enter, so the entity list is the fallback -
 * this app's own (`HUB_PATHS.entities`): a URL that always works rather than one built around
 * an empty id.
 */

import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { HUB_PATHS } from "@/lib/hubPaths";

export function mintyEntryUrl(path?: string, entityId?: string): string {
  const auth = getAuth();
  const company = entityId || auth?.entityId;
  if (company && auth?.token) {
    const base = `${env.PETTY_CASH_URL}/entity/${encodeURIComponent(company)}/enter?token=${encodeURIComponent(auth.token)}`;
    return path ? `${base}&next=${encodeURIComponent(path)}` : base;
  }
  return HUB_PATHS.entities;
}

/**
 * Into ANY company from the entity list: `/entity/<id>/enter` re-establishes the Flask session
 * from the token (it checks the token, not a membership - an unscoped one is fine) and hands
 * on to that company's module selector, which checks the membership, records the visit on
 * the list's clock and picks the module.
 */
export function mintyEnterCompanyUrl(entityId: string): string {
  return mintyEntryUrl(`/entity/${entityId}/modules`, entityId);
}

/**
 * The company's modules (Minty's `entity.module_selector`), which is a router, not a page: one
 * module enabled sends the person straight into it - Petty Cash's dashboard, or the payments
 * app - and two offer the module selection. Minty decides, from `entity_function_map`, so this
 * app does not count modules of its own.
 */
export function mintyModulesUrl(entityId: string): string {
  return entityId ? mintyEntryUrl(`/entity/${entityId}/modules`) : mintyEntryUrl();
}
