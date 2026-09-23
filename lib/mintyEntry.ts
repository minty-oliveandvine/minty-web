/**
 * The way back into Minty for the company this browser holds a token for.
 *
 * Minty's `/entity/<id>/enter` (`entity.module_reenter`) takes the cookie's token, validates it,
 * re-establishes the Flask session and forwards to `next` - so the person lands where they were
 * going, signed in, instead of on a login screen. billing-frontend goes in the same way.
 *
 * With no company or no token there is nothing to enter, so the entity list is the fallback:
 * a URL that always works rather than one built around an empty id.
 */

import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";

export function mintyEntryUrl(path?: string): string {
  const auth = getAuth();
  if (auth?.entityId && auth.token) {
    const base = `${env.MINTY_URL}/entity/${encodeURIComponent(auth.entityId)}/enter?token=${encodeURIComponent(auth.token)}`;
    return path ? `${base}&next=${encodeURIComponent(path)}` : base;
  }
  return `${env.MINTY_URL}/entity`;
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
