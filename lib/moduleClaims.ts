/**
 * Which modules the company in the token has - billing-frontend's `lib/moduleClaims.ts`
 * (`getModuleClaims`), ported. Flask mints `petty_cash_enabled` / `billing_enabled` into the
 * module token (`_generate_module_token`); the settings pills and the nav drawer show a
 * module's entries only when it is on.
 *
 * Both default to TRUE - no token, a malformed one, a missing claim: an old token must never
 * silently hide navigation. Flask writes an explicit FALSE when the map row says so, so
 * "missing" reliably means "not gated". A page that has the company's fresh state (the module
 * page model's `has_access`) prefers that over the claims, which can be up to 30 minutes stale.
 */

import { decodeJwtPayload, getAuth } from "@/lib/auth";

export type ModuleClaims = { pettyCash: boolean; billing: boolean };

const ALL_ON: ModuleClaims = { pettyCash: true, billing: true };

export function getModuleClaims(): ModuleClaims {
  try {
    const token = getAuth()?.token;
    if (!token) return ALL_ON;
    const payload = decodeJwtPayload(token);
    if (!payload) return ALL_ON;
    return {
      pettyCash:
        typeof payload.petty_cash_enabled === "boolean" ? payload.petty_cash_enabled : true,
      billing: typeof payload.billing_enabled === "boolean" ? payload.billing_enabled : true,
    };
  } catch {
    return ALL_ON;
  }
}
