/**
 * Applying a confirmed change (Figma 05·B → 05·C): the open row's ticks, turned into the API's
 * actions on the company. One call per module changed, in an order that keeps a change whole:
 * the calls that cannot need a card (cancel, renew, the company's consent) go first, the ones
 * that may find no card to charge, or a charge the card refused, last.
 *
 * What each tick is, from the card's state (`lib/subscriptionSummary.ts` `tickOf`):
 *   cancel          an ACTIVE module unticked, or a confirmed trial (NX) - `cancel`
 *   resume          a cancellation pending, ticked - `renew`
 *   confirm_trial   a running trial, ticked - `authorize-billing` (consent is per company:
 *                   every trial the company runs converts); with no card at all, or a 402
 *                   "Choose a billing account …" (the company is on none), the billing account
 *                   is asked for first (`needsCard`) - the consent is asked again after
 *   reactivate      a suspended module, ticked - `retry-payment` (the outstanding invoice)
 *   subscribe       an expired trial, ticked - `restart-billing` (THIS CHARGES); a 402 "Choose
 *                   a card …" means no card is nominated, so the billing account is asked for
 *
 * Before any of it, for a change that bills (`billsAnything`), Manage Subscriptions has already
 * put the company on the billing account the payer picked (`POST /billing/accounts/move`), so
 * every call below charges - or records consent for - that account's card.
 *
 * NOTHING HERE HANDS THE BROWSER TO STRIPE (the user, 2026-10-01: "payment method should only go
 * through billing account first"). When there is no card to charge, the answer is `needsCard` -
 * a sentence - and Manage Subscriptions asks "Billing Accounts" again with it, where a card can
 * only be added by opening a billing account in place (`AccountSheet`).
 *
 * The answer is that (`needsCard`), or that the bank declined the charge (`declined`, with the
 * API's sentence - Figma 06·B's "Payment could not be processed" asks to try again), or why the
 * change stopped otherwise (`refused`), or that everything was applied and the page model can be
 * read again. A 402 is a decline unless the API says no card is nominated at all ("Choose a
 * card …").
 */

import { ApiError } from "@/lib/apiClient";

import {
  authorizeBilling,
  cancelModule,
  renewModule,
  restartBilling,
  retryPayment,
  type ModuleCard,
  type ModuleCode,
  type ModulePage,
} from "@/features/subscription/api/moduleSettings";
import { NO_CARD_FOR_TRIAL } from "@/features/subscription/lib/billingAccounts";
import { tickOf, type TickSeam } from "@/features/subscription/lib/subscriptionSummary";

export type AppliedChange = {
  /**
   * There is no card to charge: the sentence to ask "Billing Accounts" again with. A card is
   * only ever added through a billing account - never on a Stripe-hosted page.
   */
  needsCard: string | null;
  /** The bank declined the charge: the API's sentence, and whether a scheduled retry follows. */
  declined: { message: string; autoRetry: boolean } | null;
  /** The API's sentence when the change could not complete for another reason. */
  refused: string | null;
};

const NONE: AppliedChange = { needsCard: null, declined: null, refused: null };

/** The API's 402 for a company on no billing account: "Choose a card before …" (a charge) or
 *  "Choose a billing account for this company." (consent) - never a decline. */
function noCardNominated(err: unknown): boolean {
  return (
    err instanceof ApiError &&
    err.status === 402 &&
    /choose a (card|billing account)/i.test(err.message)
  );
}

function declinedBy(err: unknown): boolean {
  return err instanceof ApiError && err.status === 402 && !noCardNominated(err);
}

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

/**
 * Whether the change starts or continues billing anything - every seam but `cancel`. Manage
 * Subscriptions asks which billing account pays before applying one that does; a change that
 * only cancels bills nothing and is applied as confirmed.
 */
export function billsAnything(before: ModulePage, codes: ModuleCode[]): boolean {
  return Object.keys(seamsOf(before, codes)).some((seam) => seam !== "cancel");
}

export async function applyChange(
  entityId: string,
  before: ModulePage,
  codes: ModuleCode[],
  /**
   * `cardChosen`: the company was just put on a billing account that has a card (Manage
   * Subscriptions' account picker), so `before`'s "no card at all" is out of date - a trial is
   * confirmed on that card instead of asking for an account again.
   */
  { cardChosen = false }: { cardChosen?: boolean } = {},
): Promise<AppliedChange> {
  const by = seamsOf(before, codes);

  for (const card of by.cancel ?? []) await cancelModule(entityId, card.code);
  for (const card of by.resume ?? []) {
    try {
      await renewModule(entityId, card.code);
    } catch (err) {
      // Resuming can collect money up front (an extension already invoiced): a decline.
      if (declinedBy(err))
        return { ...NONE, declined: { message: (err as ApiError).message, autoRetry: false } };
      throw err;
    }
  }

  const trials = by.confirm_trial ?? [];
  if (trials.length > 0) {
    // No card at all: the consent would sit on nothing, and the trial would still expire.
    if (!cardChosen && trials.some((c) => c.needs_card && !c.needs_consent_only)) {
      return { ...NONE, needsCard: NO_CARD_FOR_TRIAL };
    }
    try {
      await authorizeBilling(entityId);
    } catch (err) {
      // The company is on no billing account (the API no longer falls back to the payer's
      // default card): ask "Billing Accounts" again rather than fail.
      if (noCardNominated(err)) return { ...NONE, needsCard: (err as ApiError).message };
      throw err;
    }
  }

  if ((by.reactivate ?? []).length > 0) {
    const paid = await retryPayment(entityId);
    if (!paid.ok) {
      // The processor said no: the scheduled retries keep trying, and so can the person.
      if (paid.status === "failed")
        return { ...NONE, declined: { message: paid.message, autoRetry: true } };
      if (paid.status === "no_card") return { ...NONE, needsCard: paid.message };
      return { ...NONE, refused: paid.message };
    }
  }

  const expired = by.subscribe ?? [];
  if (expired.length > 0) {
    try {
      await restartBilling(
        entityId,
        expired.map((c) => c.code),
      );
    } catch (err) {
      if (noCardNominated(err)) return { ...NONE, needsCard: (err as ApiError).message };
      if (declinedBy(err))
        return { ...NONE, declined: { message: (err as ApiError).message, autoRetry: false } };
      throw err;
    }
  }

  return NONE;
}
