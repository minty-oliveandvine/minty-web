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

/** The module settings page of one company (Flask's /entity/settings/module/<org_id>, re-homed). */
export function modulesPath(entityId: string): string {
  return subscriptionPath(`/entities/${encodeURIComponent(entityId)}/modules`);
}

/**
 * The pages a module card's CTA leads to, under the company's module page. Built here so the
 * page can navigate to them before they exist (each is designed in its own step); until then a
 * seam lands on Next's 404, and the tests that pin these URLs stay valid when the pages arrive.
 */
export function moduleRoutes(entityId: string) {
  const b = modulesPath(entityId);
  return {
    /**
     * Manage Subscription - a trialing or active module. The design's target is the payer
     * portal's list (section 04) with this company's row, so this is the list, not a sub-page.
     */
    manage: `${PORTAL.subscriptions}?entity=${encodeURIComponent(entityId)}`,
    /** Activate Subscription - a module whose trial expired. */
    activate: (code: string) => `${b}/activate/${encodeURIComponent(code)}`,
    /** Resume Subscription - a module with a cancellation pending. */
    resume: (code: string) => `${b}/resume/${encodeURIComponent(code)}`,
    /** Reactivate Subscription - a module suspended for a failed payment. */
    reactivate: (code: string) => `${b}/reactivate/${encodeURIComponent(code)}`,
    /** The payment-method screen the "Payment failed" banner links to. */
    paymentMethod: `${b}/payment-method`,
    /** The list's ⋮ menu: cancel every active module / reactivate every module that is not. */
    cancelAll: `${b}/cancel`,
    reactivateAll: `${b}/reactivate`,
  } as const;
}
