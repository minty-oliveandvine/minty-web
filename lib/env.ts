/**
 * The three sibling URLs this app reads - and the only place it reads them.
 *
 * Each is spelled out as a literal `process.env.X` access of a key next.config.ts lists under
 * `env`, so Next inlines it into the client bundle AND proxy.ts at build time; a dynamic
 * `process.env[name]` is never inlined and silently reads undefined in the browser.
 * next.config.ts passes the raw value through; the default and the trailing-slash strip live
 * here, once.
 *
 * Defaults are the local stack's ports (Minty/docker/stack/docker-compose.yml): Subscription API
 * 8000, Petty Cash (Flask) 8010, Payment Request web 3020. The deployed app sets all three
 * explicitly. No environment-name switch (minty-payment-request-web's `mintyEnv.ts` grew one
 * and its apex default became a landmine) - one variable, one URL.
 */

function url(raw: string | undefined, fallback: string): string {
  const value = (raw ?? "").trim();
  return (value || fallback).replace(/\/+$/, "");
}

export const env = {
  /** minty-subscription-api - every API call this app makes. */
  SUBSCRIPTION_API_URL: url(process.env.SUBSCRIPTION_API_URL, "http://localhost:8000"),
  /** Petty Cash (the Flask app) - login, the re-handoff, the entity list's and the profile's reads. */
  PETTY_CASH_URL: url(process.env.PETTY_CASH_URL, "http://localhost:8010"),
  /** minty-payment-request-web - the side menu's Bills, the profile's way back. */
  PAYMENT_REQUEST_WEB_URL: url(process.env.PAYMENT_REQUEST_WEB_URL, "http://localhost:3020"),
} as const;
