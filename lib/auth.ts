/**
 * The module token, kept in a cookie - this app's instance of `@minty/shared/auth` (owner
 * 2026-10-21: one shared module), under the `minty` prefix so this app and its siblings on
 * localhost never read each other's token.
 *
 * Minty (Flask) mints a 30-minute HS256 JWT when a person opens this app
 * (`_generate_module_token`) and sends the browser to `/landing?token=…`, which stores it here.
 * The cookie is what proxy.ts gates on and what lib/apiClient.ts sends as the bearer. This app
 * has no refresh endpoint: a lapsed token goes back through Flask's login-gated re-handoff
 * (lib/handoff.ts).
 *
 * The cookie lives exactly as long as the token (its `exp` claim), so an expired session is
 * caught by proxy.ts before a page renders, rather than by the first API call after. The JWT
 * reads themselves (`decodeJwtPayload`, `isTokenExpired(token)`, `moduleClaims(token)`) are
 * imported from the package where they are needed.
 */

import { createCookieAuth, decodeJwtPayload, type AuthInfo } from "@minty/shared/auth";

export type { AuthInfo };

const auth = createCookieAuth({ prefix: "minty" });

/** Cookie name checked by proxy.ts for the auth gate. */
export const AUTH_COOKIE_NAME = auth.cookieNames.token;
/** The company the token is for - read on the server for the tab title (lib/companyTitle.ts). */
export const ENTITY_ID_COOKIE_NAME = auth.cookieNames.entityId;
export const ENTITY_NAME_COOKIE_NAME = auth.cookieNames.entityName;

export function setAuth(token: string, entityId: string, entityName: string): void {
  auth.setAuth({ token, entityId, entityName });
}

export const getAuth = auth.getAuth;
export const clearAuth = auth.clearAuth;

/**
 * Whether the stored token was minted INSIDE a company - its `entity_id` claim, or the company
 * the landing stored beside it (Flask sets the two together). The module settings page's token
 * is; the one Minty's entity list hands the payer portal is not.
 */
export function isEntityScoped(): boolean {
  const info = getAuth();
  if (!info) return false;
  const claim = decodeJwtPayload(info.token)?.entity_id;
  return info.entityId !== "" || (typeof claim === "string" && claim !== "");
}
