/**
 * The module settings page of one company: one page model and nineteen actions.
 *
 * `GET  /api/entities/{id}/modules`            the page model
 * `POST /api/entities/{id}/modules/{action}`    one of ModuleAction, JSON body per action
 *
 * Company-scoped: every call sends `X-Entity-Id` (the token may be unscoped when the page is
 * reached from the portal). The nineteen action names are Flask's (`entity/routes/settings.py`
 * 1419-2431); their bodies and answers are ported one by one in Part 2 step 4, and the types
 * below widen from `unknown` as each lands. minty-billing-api's `billing/tests/test_contract.py`
 * pins the same list.
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

/** One module's card, as the page model lists it. Widened as step 4 ports the partials. */
export type ModuleCard = {
  function_code: "PETTY_CASH" | "PAYMENT_REQUEST";
  name: string;
  is_enabled: boolean;
  phase: string | null;
  [extra: string]: unknown;
};

export type ModulePage = {
  entity_id: string;
  cards: ModuleCard[];
  can_manage_modules: boolean;
  payer: { user_id: string; name: string } | null;
  summary?: unknown;
  panel?: unknown;
  next_payment?: unknown;
  consent_takeover?: unknown;
  [extra: string]: unknown;
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
