/**
 * The three NEXT_PUBLIC_* values this app reads - and the only place it reads them.
 *
 * Each is spelled out as a literal `process.env.NEXT_PUBLIC_…` access so Next can inline it
 * into the client bundle AND proxy.ts at build time; a dynamic `process.env[name]` is
 * never inlined and silently reads undefined in the browser.
 *
 * Defaults are the local stack's ports (Minty/docker/stack/docker-compose.yml, cross-cutting
 * rule 6): billing API 8004, Flask 5001, the payments app 3000. The deployed app sets all
 * three explicitly. No environment-name switch (billing-frontend's `mintyEnv.ts` grew one and
 * its apex default became a landmine) - one variable, one URL.
 */

function url(raw: string | undefined, fallback: string): string {
  const value = (raw ?? "").trim();
  return (value || fallback).replace(/\/+$/, "");
}

export const env = {
  /** minty-billing-api - every API call this app makes. */
  BILLING_API_URL: url(process.env.NEXT_PUBLIC_BILLING_API_URL, "http://localhost:8004"),
  /** The Flask app - login, the re-handoff, the entity list's and the profile's reads, Petty Cash. */
  MINTY_URL: url(process.env.NEXT_PUBLIC_MINTY_URL, "http://localhost:5001"),
  /** The payment-request app (billing-frontend) - the side menu's Bills, the profile's way back. */
  PAYMENTS_WEB_URL: url(process.env.NEXT_PUBLIC_PAYMENTS_WEB_URL, "http://localhost:3000"),
} as const;
