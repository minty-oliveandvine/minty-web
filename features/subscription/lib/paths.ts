/**
 * Where the feature is mounted, and every link inside it.
 *
 * ONE constant. The shell mounts the feature at /subscription (app/subscription/**), and this is
 * the only place inside the feature that spells it - components build links with `subscriptionPath`
 * so extraction into an app that mounts it at `/` is a one-line change here (README.md).
 */

export const SUBSCRIPTION_BASE_PATH = "/subscription";

export function subscriptionPath(sub = ""): string {
  if (!sub || sub === "/") return SUBSCRIPTION_BASE_PATH;
  return `${SUBSCRIPTION_BASE_PATH}${sub.startsWith("/") ? sub : `/${sub}`}`;
}

/** The portal's pages (billing-frontend's /profile/{subscriptions,billing,invoices}, re-homed). */
export const PORTAL = {
  index: subscriptionPath(),
  subscriptions: subscriptionPath("/subscriptions"),
  subscriber: subscriptionPath("/subscriptions/subscriber"),
  incoming: subscriptionPath("/subscriptions/incoming"),
  billing: subscriptionPath("/billing"),
  invoices: subscriptionPath("/invoices"),
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
  add: (accountId?: string | null) =>
    withParams(subscriptionPath("/billing/add"), { account: accountId }),
  edit: (paymentMethod: string, accountId?: string | null) =>
    withParams(subscriptionPath("/billing/edit"), { card: paymentMethod, account: accountId }),
  added: (paymentMethod: string, accountId?: string | null) =>
    withParams(PORTAL.billing, { account: accountId, added: paymentMethod }),
  details: (accountId: string) =>
    withParams(subscriptionPath("/billing/details"), { account: accountId }),
} as const;

/** The module settings page of one company (Flask's /entity/settings/module/<org_id>, re-homed). */
export function modulesPath(entityId: string): string {
  return subscriptionPath(`/entities/${encodeURIComponent(entityId)}/modules`);
}

/** The list with a company's row open and one module ticked, ready to confirm. */
function tickPath(entityId: string, code: string): string {
  return `${PORTAL.subscriptions}?entity=${encodeURIComponent(entityId)}&tick=${encodeURIComponent(code)}`;
}

/**
 * Where a module card's CTA leads. Most of them are not pages at all: a change to one module is
 * what the open row in Manage Subscriptions already says, so they land there with that module
 * ticked. Only the payment-method screen is still a page waiting to be built, and a seam to it
 * lands on `routes/NotBuiltYet.tsx` until it is.
 */
export function moduleRoutes(entityId: string) {
  const b = modulesPath(entityId);
  return {
    /**
     * Manage Subscription - a trialing or active module. The design's target is the payer
     * portal's list (section 04) with this company's row, so this is the list, not a sub-page.
     */
    manage: `${PORTAL.subscriptions}?entity=${encodeURIComponent(entityId)}`,
    /**
     * Where a trial started HERE lands: the same list, with the company's row open on the
     * "Congratulations!" result (Figma RV11). `started` names the module, because the list has
     * no before-and-after of its own to read the news from.
     */
    started: (code: string) =>
      `${PORTAL.subscriptions}?entity=${encodeURIComponent(entityId)}&started=${encodeURIComponent(code)}`,
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
    /** The payment-method screen the "Payment failed" banner links to. */
    paymentMethod: `${b}/payment-method`,
  } as const;
}
