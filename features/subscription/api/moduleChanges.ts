/**
 * Applying a confirmed change (Figma 05·B → 05·C): the open row's ticks, turned into the API's
 * actions on the company. One call per module changed, in an order that keeps a change whole:
 * the calls that can never leave the app (cancel, renew, the company's consent) go first, the
 * ones that may hand the browser to Stripe (a card to collect, a charge the saved card refused)
 * last - so nothing is left half-applied behind a redirect.
 *
 * What each tick is, from the card's state (`lib/subscriptionSummary.ts` `tickOf`):
 *   cancel          an ACTIVE module unticked, or a confirmed trial (NX) - `cancel`
 *   resume          a cancellation pending, ticked - `renew`
 *   confirm_trial   a running trial, ticked - `authorize-billing` (consent is per company:
 *                   every trial the company runs converts); with no card at all, Stripe's
 *                   card form first (`payment-method`) - the consent is asked again after
 *   reactivate      a suspended module, ticked - `retry-payment` (the outstanding invoice)
 *   subscribe       an expired trial, ticked - `restart-billing` (THIS CHARGES); a 402 means
 *                   no card is nominated, so Stripe's card form first
 *
 * The answer says where the browser must go (Stripe), or why the change stopped (a card the
 * processor declined), or that everything was applied and the page model can be read again.
 */

import { ApiError } from "@/lib/apiClient";

import {
  authorizeBilling,
  cancelModule,
  openPaymentMethodCapture,
  renewModule,
  restartBilling,
  retryPayment,
  type ModuleCard,
  type ModuleCode,
  type ModulePage,
} from "@/features/subscription/api/moduleSettings";
import { tickOf, type TickSeam } from "@/features/subscription/lib/subscriptionSummary";

export type AppliedChange = {
  /** Stripe's page to open when a card must be collected or replaced first. */
  redirect: string | null;
  /** The API's sentence when the change could not complete (a declined card). */
  refused: string | null;
};

/** The modules the change touches, grouped by what the tick means for each. */
export function seamsOf(
  before: ModulePage,
  codes: ModuleCode[],
): Partial<Record<TickSeam, ModuleCard[]>> {
  const out: Partial<Record<TickSeam, ModuleCard[]>> = {};
  for (const code of codes) {
    const card = before.cards.find((c) => c.code === code);
    const seam = card ? tickOf(card).seam : null;
    if (!card || !seam) continue;
    (out[seam] ??= []).push(card);
  }
  return out;
}

export async function applyChange(
  entityId: string,
  before: ModulePage,
  codes: ModuleCode[],
): Promise<AppliedChange> {
  const by = seamsOf(before, codes);

  for (const card of by.cancel ?? []) await cancelModule(entityId, card.code);
  for (const card of by.resume ?? []) await renewModule(entityId, card.code);

  const trials = by.confirm_trial ?? [];
  if (trials.length > 0) {
    // No card at all: the consent would sit on nothing, and the trial would still expire.
    if (trials.some((c) => c.needs_card && !c.needs_consent_only)) {
      const { url } = await openPaymentMethodCapture(entityId);
      return { redirect: url, refused: null };
    }
    await authorizeBilling(entityId);
  }

  if ((by.reactivate ?? []).length > 0) {
    const paid = await retryPayment(entityId);
    if (!paid.ok) return { redirect: null, refused: paid.message };
  }

  const expired = by.subscribe ?? [];
  if (expired.length > 0) {
    try {
      const bought = await restartBilling(
        entityId,
        expired.map((c) => c.code),
      );
      if (bought.url) return { redirect: bought.url, refused: null };
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        const { url } = await openPaymentMethodCapture(entityId);
        return { redirect: url, refused: null };
      }
      throw err;
    }
  }

  return { redirect: null, refused: null };
}
