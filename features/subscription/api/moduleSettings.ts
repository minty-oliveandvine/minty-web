/**
 * The module settings page of one company: one page model and nineteen actions.
 *
 * `GET  /api/entities/{id}/modules`            the page model
 * `POST /api/entities/{id}/modules/{action}`    one of ModuleAction, JSON body per action
 *
 * Company-scoped: every call sends `X-Entity-Id` (the token may be unscoped when the page is
 * reached from the portal). The nineteen action names are Flask's (`entity/routes/settings.py`
 * 1419-2431); minty-billing-api's `billing/tests/test_contract.py` pins the same list.
 *
 * The card is Flask's card dict verbatim (`blueprints/subscription/services/cards.py`, the
 * step-3 API emits the same keys); the page model adds `viewer` (the person looking, for the
 * header's initials) and keeps `summary` / `panel` / `consent_takeover` opaque until the screens
 * that read them (the Manage Subscription flow) are built. Bodies and answers of the actions
 * the page calls are typed here; the rest are typed when their screen lands.
 */

import { apiFetch } from "@/lib/apiClient";

export const MODULE_ACTIONS = [
  "checkout",
  "authorize-billing",
  "payment-methods",
  "payment-methods/setup-intent",
  "payment-methods/confirm",
  "payment-methods/default",
  "restart-quote",
  "restart-billing",
  "confirm-billing",
  "checkout-complete",
  "start-trial",
  "resume-preview",
  "subscribe-preview",
  "cancel-preview",
  "retry-payment",
  "cancel",
  "payment-method",
  "renew",
  "manage-billing",
] as const;

export type ModuleAction = (typeof MODULE_ACTIONS)[number];

export type ModuleCode = "PETTY_CASH" | "PAYMENT_REQUEST";

/** Flask's `subscription_status` on a card: the phase the page reasons about, or none. */
export type ModuleSubscriptionStatus = "trialing" | "active" | "past_due" | null;

/** One module's card, as the page model lists it (Flask's `get_module_cards` dict). */
export type ModuleCard = {
  code: ModuleCode;
  name: string;
  description: string;
  learn_more: string | null;
  is_subscribed: boolean;
  trial_eligible: boolean;
  trial_closing: boolean;
  trial_expired: boolean;
  lapsed_long: boolean;
  has_access: boolean;
  subscription_status: ModuleSubscriptionStatus;
  can_cancel: boolean;
  formatted_amount: string;
  currency_code: string;
  billing_interval: string;
  cancel_at_period_end: boolean;
  pending_cancel: boolean;
  trial_cancelled: boolean;
  formatted_period_end: string | null;
  period_end_short: string | null;
  period_end_long: string | null;
  /** ISO datetime; the day the trial or paid period ends. */
  period_end: string | null;
  extension_formatted: string | null;
  /** ISO date; when access actually stops (cancellation, past-due grace). */
  access_end_date: string | null;
  access_end_long: string | null;
  needs_card: boolean;
  needs_consent_only: boolean;
};

export type ModulePage = {
  entity_id: string;
  cards: ModuleCard[];
  /** Admin AND the payer (or no payer yet) - whether the CTAs render at all. */
  can_manage_modules: boolean;
  /** Who pays for this company when it is not the viewer; named in the notice. */
  payer: { user_id: string; name: string; email: string } | null;
  /** The person looking, for the header. */
  viewer: { name: string; initials: string };
  next_payment_date: string | null;
  summary?: unknown;
  panel?: unknown;
  consent_takeover?: unknown;
};

function base(entityId: string): string {
  return `/api/entities/${encodeURIComponent(entityId)}/modules`;
}

export function getModulePage(entityId: string): Promise<ModulePage> {
  return apiFetch<ModulePage>(base(entityId), { entityId });
}

export function postModuleAction<T = unknown>(
  entityId: string,
  action: ModuleAction,
  body: Record<string, unknown> = {},
): Promise<T> {
  return apiFetch<T>(`${base(entityId)}/${action}`, { method: "POST", entityId, json: body });
}

/** `start-trial`: opens the free trial of one module; the answer names what is enabled now. */
export function startTrial(
  entityId: string,
  code: ModuleCode,
): Promise<{ modules: Record<string, boolean> }> {
  return postModuleAction(entityId, "start-trial", { codes: [code] });
}

/**
 * `checkout-complete`: the return from Stripe Checkout (`?session_id=` on the page URL). Flask
 * answered with a redirect; the API answers JSON and the page refetches. `purpose` is
 * `payment_method` when the session only saved a card.
 */
export function completeCheckout(
  entityId: string,
  sessionId: string,
  purpose?: string,
): Promise<{ ok: true }> {
  return postModuleAction(entityId, "checkout-complete", {
    session_id: sessionId,
    ...(purpose ? { purpose } : {}),
  });
}
