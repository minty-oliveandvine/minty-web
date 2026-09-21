/**
 * The module token, kept in a cookie.
 *
 * Minty (Flask) mints a 30-minute HS256 JWT when a person opens this app
 * (`_generate_module_token`) and sends the browser to `/landing?token=…`, which stores it here.
 * The cookie is what proxy.ts gates on and what lib/apiClient.ts sends as the bearer.
 * Lifted from billing-frontend/lib/auth.ts with the cookie renamed (`minty_token`, so the two
 * apps never read each other's) and the refresh removed: this app has no refresh endpoint -
 * a lapsed token goes back through Flask's login-gated re-handoff (lib/handoff.ts).
 *
 * The cookie lives exactly as long as the token (its `exp` claim), so an expired session is
 * caught by proxy.ts before a page renders, rather than by the first API call after.
 */

const TOKEN_KEY = "minty_token";
const ENTITY_ID_KEY = "minty_entity_id";
const ENTITY_NAME_KEY = "minty_entity_name";

/** Cookie name checked by proxy.ts for the auth gate. */
export const AUTH_COOKIE_NAME = TOKEN_KEY;

/** What a token is allowed to live when its `exp` cannot be read - Flask's token lifetime. */
const FALLBACK_MAX_AGE_SECONDS = 60 * 30;

export type AuthInfo = {
  token: string;
  entityId: string;
  entityName: string;
};

function cookieOptions(maxAgeSeconds: number): string {
  const isSecure = typeof window !== "undefined" && window.location.protocol === "https:";
  return `path=/;max-age=${maxAgeSeconds};SameSite=Lax${isSecure ? ";Secure" : ""}`;
}

function readJar(): Record<string, string> {
  if (typeof document === "undefined") return {};
  return Object.fromEntries(
    document.cookie
      .split("; ")
      .filter(Boolean)
      .map((c) => {
        const idx = c.indexOf("=");
        return [c.slice(0, idx), decodeURIComponent(c.slice(idx + 1))];
      }),
  );
}

/**
 * Neutral JWT-payload decode: base64url the middle segment and JSON-parse it. Never throws;
 * null for anything that is not a three-part token with an object payload. No signature check
 * here - the browser cannot hold the key, and the API verifies every request anyway.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    const payload = JSON.parse(atob(base64)) as unknown;
    if (payload == null || typeof payload !== "object" || Array.isArray(payload)) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Seconds until the token's `exp`, floored at 1 - or the fallback when there is no `exp`. */
export function secondsUntilExpiry(token: string): number {
  const exp = decodeJwtPayload(token)?.exp;
  if (typeof exp !== "number") return FALLBACK_MAX_AGE_SECONDS;
  return Math.max(1, Math.floor(exp - Date.now() / 1000));
}

export function setAuth(token: string, entityId: string, entityName: string) {
  const opts = cookieOptions(secondsUntilExpiry(token));
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)};${opts}`;
  document.cookie = `${ENTITY_ID_KEY}=${encodeURIComponent(entityId)};${opts}`;
  document.cookie = `${ENTITY_NAME_KEY}=${encodeURIComponent(entityName)};${opts}`;
}

export function getAuth(): AuthInfo | null {
  const jar = readJar();
  const token = jar[TOKEN_KEY];
  if (!token) return null;
  return {
    token,
    entityId: jar[ENTITY_ID_KEY] ?? "",
    entityName: jar[ENTITY_NAME_KEY] ?? "",
  };
}

export function clearAuth() {
  const expire = "path=/;max-age=0";
  document.cookie = `${TOKEN_KEY}=;${expire}`;
  document.cookie = `${ENTITY_ID_KEY}=;${expire}`;
  document.cookie = `${ENTITY_NAME_KEY}=;${expire}`;
}

/** Whether the stored token is already past its `exp` (5 s of clock-skew tolerance). */
export function isTokenExpired(): boolean {
  const auth = getAuth();
  if (!auth) return true;
  const exp = decodeJwtPayload(auth.token)?.exp;
  if (typeof exp !== "number") return false;
  return exp - Date.now() / 1000 < -5;
}
