/**
 * Billing-account sentences the e2e specs also name. No imports on purpose: Playwright loads the
 * specs with Node, which will not strip the types of `@minty/shared`'s TypeScript source under
 * node_modules, so a spec must never import a module that reaches it (`billingAccounts.ts` does).
 */

/** 08-C with no Stripe to draw the address form: no key here, or Stripe.js blocked or down. */
export const ADDRESS_UNAVAILABLE =
  "The address form couldn't load, so the address can't be changed right now. The company name and email still can.";

/** `billing_company` / `billing_email` are VARCHAR(255): the API's own words for going over it. */
export const TOO_LONG = "Keep that under 255 characters.";
