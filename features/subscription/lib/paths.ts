/**
 * Where the feature is mounted, and every link inside it.
 *
 * ONE constant. The shell mounts the feature at /subscription (app/subscription/**), and this is
 * the only place inside the feature that spells it - components build links with `subscriptionPath`
 * so extraction into an app that mounts it at `/` is a one-line change here (README.md).
 */

import { companyPath, companySettingsPath } from "@/lib/hubPaths";

export const SUBSCRIPTION_BASE_PATH = "/subscription";

export function subscriptionPath(sub = ""): string {
  if (!sub || sub === "/") return SUBSCRIPTION_BASE_PATH;
  return `${SUBSCRIPTION_BASE_PATH}${sub.startsWith("/") ? sub : `/${sub}`}`;
}

/**
 * The portal's pages (minty-payment-request-web's /profile/{subscriptions,billing}, re-homed). A
 * standalone invoices page (minty-payment-request-web's third tab) was deliberately NOT built here: the
 * billing page's own invoice list (`InvoiceHistoryTable`, §15) already covers it - every
 * invoice, paged, with its PDF and the billing-breakdown CSV - so a second page listing
 * the same rows would be the one link nobody could tell apart from the other.
 */
export const PORTAL = {
  index: subscriptionPath(),
  subscriptions: subscriptionPath("/subscriptions"),
  subscriber: subscriptionPath("/subscriptions/subscriber"),
  incoming: subscriptionPath("/subscriptions/incoming"),
  billing: subscriptionPath("/billing"),
} as const;

/** `path?a=1&b=2`, the empty ones left out - so an absent account keeps the URL bare. */
function withParams(path: string, params: Record<string, string | null | undefined>): string {
  const qs = Object.entries(params)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return qs ? `${path}?${qs}` : path;
}

/**
 * 08-A showing one billing account. The account rides in the URL (`?account=`), never in
 * storage: with none, the page shows the payer's oldest.
 */
export function overviewPath(accountId?: string | null): string {
  return withParams(PORTAL.index, { account: accountId });
}

/**
 * One billing account's pages. 08-B is the account's profile (`?account=`, or `?entity=` for
 * "the account this company is on" - the list's payment-failed banner knows a company, not an
 * account); 08-Y and 08-D add and edit a card ON it and come back to it, adding with `?added=`
 * so the page can say what happened (08-N / 08-S); and 08-C is its name and address. Opening a
 * NEW account is not a page: it is onboarding's sheet, over 08-A or 08-B.
 */
export const BILLING = {
  account: ({ id, entity }: { id?: string | null; entity?: string | null } = {}) =>
    withParams(PORTAL.billing, { account: id, entity }),
  // A card is added ON an account or not at all - so the account is not optional here.
  add: (accountId: string) => withParams(subscriptionPath("/billing/add"), { account: accountId }),
  edit: (paymentMethod: string, accountId?: string | null) =>
    withParams(subscriptionPath("/billing/edit"), { card: paymentMethod, account: accountId }),
  added: (paymentMethod: string, accountId?: string | null) =>
    withParams(PORTAL.billing, { account: accountId, added: paymentMethod }),
  details: (accountId: string) =>
    withParams(subscriptionPath("/billing/details"), { account: accountId }),
} as const;

/** The module settings page of one company (Flask's settings/modules, re-homed): NOT under the
 * feature's mount - since phase 2 it is the Module tab among the company's settings,
 * `/entity/<shortid>/<name>/settings/modules` (lib/hubPaths.ts spells the company's pages). */
/**
 * The company's OWN page - `/entity/<shortid>/<name>`, Choose Module Type. Where the module
 * settings journey came from, so where its result screen goes back to. Note it does not always
 * render: a company with exactly one module on redirects straight into that module's app
 * (`features/entities/routes/ModuleChoiceScreen`).
 */
export function companyHome(entityId: string, entityName: string): string {
  return companyPath(entityId, entityName);
}

export function modulesPath(entityId: string, entityName: string): string {
  return companySettingsPath(entityId, entityName, "modules");
}

/** The list with a company's row open and one module ticked, ready to confirm. */
function tickPath(entityId: string, code: string): string {
  return `${PORTAL.subscriptions}?entity=${encodeURIComponent(entityId)}&tick=${encodeURIComponent(code)}`;
}

/**
 * Where a module card's CTA leads. None of them is a page of its own: a change to one module is
 * what the open row in Manage Subscriptions already says, so they land there with that module
 * ticked. 03-F's "Payment failed" banner goes to the company's billing account
 * (`BILLING.account`), and the open row's _Change_ beside its card opens the "Billing Accounts"
 * sheet in place - neither is a route.
 */
export function moduleRoutes(entityId: string) {
  return {
    /**
     * Manage Subscription - a trialing or active module. The design's target is the payer
     * portal's list (section 04) with this company's row, so this is the list, not a sub-page.
     */
    manage: `${PORTAL.subscriptions}?entity=${encodeURIComponent(entityId)}`,
    // `started` is GONE (2026-10-08). A trial begun on the module settings page used to land on
    // the list's row (Figma RV11, `?started=<code>`); it now lands in place on the page it was
    // begun from, as an activation does. The list still READS `?started=` so an old link still
    // works, but nothing builds one any more.
    /**
     * Activate / Resume / Reactivate all mean the same thing: ONE module's pending change,
     * which the open row already expresses. So they are not pages of their own - they are the
     * list, this company's row, that module ticked, and the person presses *Confirm
     * Subscription Change* having read what it costs. What the tick MEANS is decided there,
     * by `tickOf`'s seam (subscribe / resume / reactivate), so the URL carries no verb.
     */
    activate: (code: string) => tickPath(entityId, code),
    /** Resume Subscription - a module with a cancellation pending. */
    resume: (code: string) => tickPath(entityId, code),
    /** Reactivate Subscription - a module suspended for a failed payment. */
    reactivate: (code: string) => tickPath(entityId, code),
  } as const;
}
