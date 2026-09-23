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

/**
 * The billing page's own two screens (Figma 08-Y "Add a card — full page" and 08-D "Edit card
 * details"), which the design draws as pages rather than dialogs. Both come back to the billing
 * page; adding comes back with `?added=<card>` so the page can say what happened (08-N / 08-S).
 */
export const BILLING = {
  add: subscriptionPath("/billing/add"),
  edit: (paymentMethod: string) =>
    `${subscriptionPath("/billing/edit")}?card=${encodeURIComponent(paymentMethod)}`,
  added: (paymentMethod: string) => `${PORTAL.billing}?added=${encodeURIComponent(paymentMethod)}`,
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
