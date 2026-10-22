/**
 * The three sibling URLs this app reads - and the only place it reads them.
 *
 * Each is spelled out as a literal `process.env.X` access of a key next.config.ts lists under
 * `env`, so Next inlines it into the client bundle AND proxy.ts at build time; a dynamic
 * `process.env[name]` is never inlined and silently reads undefined in the browser.
 * next.config.ts passes the raw value through; the rule - trim, strip trailing slashes, the
 * local default - is `envUrl` from `@minty/shared/env` (owner 2026-10-21: one shared module).
 *
 * Defaults are the owner's local ports (2026-10-16, Documents\dev.ps1): Subscription API 8001,
 * Petty Cash (Flask, accounts-api) 8000, Payment Request web 3020 - in development and tests only.
 * A production build with one unset THROWS, naming it: CI and every Vercel environment set all
 * three. No environment-name switch (minty-payment-request-web's `mintyEnv.ts` grew one and its
 * apex default became a landmine) - one variable, one URL.
 */

import { envUrl } from "@minty/shared/env";

export const env = {
  /** minty-subscription-api - every API call this app makes. */
  SUBSCRIPTION_API_URL: envUrl(
    "SUBSCRIPTION_API_URL",
    process.env.SUBSCRIPTION_API_URL,
    "http://localhost:8001",
  ),
  /** Petty Cash (the Flask app) - login, the re-handoff, the entity list's and the profile's reads. */
  PETTY_CASH_URL: envUrl("PETTY_CASH_URL", process.env.PETTY_CASH_URL, "http://localhost:8000"),
  /**
   * minty-payment-request-web. Only the side menu's Bills inside a branch preview set reads it
   * (moved onto the set's host); everywhere else Bills goes through Minty's hand-over (2026-10-15).
   */
  PAYMENT_REQUEST_WEB_URL: envUrl(
    "PAYMENT_REQUEST_WEB_URL",
    process.env.PAYMENT_REQUEST_WEB_URL,
    "http://localhost:3020",
  ),
} as const;
