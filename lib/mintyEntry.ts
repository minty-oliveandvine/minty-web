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
 * from the token (a member's or a superuser's - an unscoped one is fine) and hands on to that
 * company's module router, which records the visit on the list's clock and picks the module:
 * straight into the only one, or this app's module choice (`/entity/<shortid>/<name>`) for two.
 */
export function mintyEnterCompanyUrl(entityId: string): string {
  return mintyEntryUrl(`/entity/${entityId}/modules`, entityId);
}

/**
 * The company's modules (Minty's `entity.module_selector`), which is a router, not a page: one
 * module enabled sends the person straight into it - Petty Cash's dashboard, or the payments
 * app - and two come back to this app's module choice. Minty decides, from `entity_function_map`.
 */
export function mintyModulesUrl(entityId: string): string {
  return entityId ? mintyEntryUrl(`/entity/${entityId}/modules`) : mintyEntryUrl();
}

/**
 * Into minty-petty-cash-web for one company (Step 5, 2026-10-19), the way Bills reaches the
 * payments app: `/enter` rebuilds the Flask session, then Flask's login-gated
 * `/handoff/petty-cash-web` mints that app's token for THIS company and lands it on `next` - a
 * path on the Petty Cash app (`companyPath(id, name, "/petty-cash/reports")`); with none, Flask
 * picks the company's dashboard. `return_origin` names this page's origin, so inside a branch
 * preview set Flask hands back to the set's Petty Cash app (`lib/handoff.ts` does the same).
 * Flask, never this app, knows the Petty Cash app's address: no `PETTY_CASH_WEB_URL` here.
 */
export function pettyCashWebUrl(entityId: string, next?: string): string {
  const qs = new URLSearchParams({ entity_id: entityId });
  if (next) qs.set("next", next);
  if (typeof window !== "undefined") qs.set("return_origin", window.location.origin);
  return mintyEntryUrl(`/handoff/petty-cash-web?${qs.toString()}`, entityId);
}
