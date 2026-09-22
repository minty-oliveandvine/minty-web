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
  /** The monthly price in MAJOR units as the API's decimal string ("280"); `formatted_amount` is its "280.00". */
  amount?: string;
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
  /** The catalogue's money, as `get_subscription_summary` builds it (the keys the summary reads). */
  summary?: ModuleSummary | null;
  /** The "Your subscription" panel model (`build_subscription_panel`); the keys the summary reads. */
  panel?: ModulePanel | null;
  consent_takeover?: unknown;
};

/**
 * What the Subscription Summary (Figma 05·A) reads of the API's `summary`: the currency's
 * symbol as `currency_info` records it (`HK$`, or the code itself when none is recorded), the
 * bundle - its price in MAJOR units as a decimal string ("400"), the codes it covers and its
 * name (`Super Minty`, the API's; the design writes "SuperMinty"). Everything else the API puts
 * beside these stays opaque.
 */
export type ModuleSummary = {
  currency: string;
  currency_code: string | null;
  bundle_amount: string;
  bundle_amount_formatted: string;
  bundle_codes: ModuleCode[];
  bundle_name: string;
  [key: string]: unknown;
};

/** The two things the summary's footer reads of the panel. */
export type ModulePanel = {
  /** {date "6 Oct 2026", amount "HKD 280", overdue, includes_extension}, or null when nothing bills. */
  next_invoice: {
    date: string;
    amount: string;
    overdue: boolean;
    includes_extension: boolean;
  } | null;
  total: string;
  [key: string]: unknown;
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

// ---- the changes the open row confirms (Figma 05·B → 05·C) ---------------------------------

/** `cancel`: one module stops at its access end (a paid one under the prorated rule, a trial at once). */
export function cancelModule(
  entityId: string,
  code: ModuleCode,
): Promise<{ ok: true; access_until: string | null }> {
  return postModuleAction(entityId, "cancel", { code });
}

/** `renew`: a module scheduled to cancel carries on. */
export function renewModule(entityId: string, code: ModuleCode): Promise<{ ok: true }> {
  return postModuleAction(entityId, "renew", { code });
}

/** `retry-payment`: collect a suspended company's outstanding invoice now; `ok` says whether it settled. */
export function retryPayment(
  entityId: string,
): Promise<{ ok: boolean; status: string; message: string }> {
  return postModuleAction(entityId, "retry-payment");
}

/**
 * `restart-billing`: buy back lapsed trials - THIS CHARGES the company's card. `url` when the
 * saved card could not be used and Stripe collects a new one; a 402 when no card is nominated.
 */
export function restartBilling(
  entityId: string,
  codes: ModuleCode[],
): Promise<{ ok?: true; restarted?: ModuleCode[]; url?: string }> {
  return postModuleAction(entityId, "restart-billing", { codes });
}

/**
 * `authorize-billing`: this company's consent to bill, so its trials convert at term end.
 * Nothing is charged; consent is once per company, so every trial it runs converts.
 */
export function authorizeBilling(entityId: string): Promise<{ ok: true }> {
  return postModuleAction(entityId, "authorize-billing");
}

/** `payment-method`: where Stripe collects or updates the payer's card (the browser goes there). */
export function openPaymentMethodCapture(entityId: string): Promise<{ url: string }> {
  return postModuleAction(entityId, "payment-method");
}
