/**
 * What the transfer screens SHOW, derived from what the API SAYS - Figma section 07 ("Transfer
 * — handing the subscription over"), both sides of it:
 *
 * - the payer's side (07-A/B/C/K/L): `/api/me/subscriptions/subscriber-options` - the company,
 *   who is billed today, the admins it could be handed to (each with ITS OWN quote, priced
 *   against the recipient's billing anchor), why it cannot go ahead (`blockers`, the API's
 *   words), and the offer already waiting (`pending_transfer`), if any;
 * - the recipient's side (07-D/E/F/M): `/api/me/subscriptions/transfers` - the offers made to
 *   the signed-in person, each with the company, who asks, a quote for what accepting charges
 *   TODAY, the trials that would be inherited, and blockers.
 *
 * Money from these routes is in MINOR units (the engine's invoices: 8800 = HK$88.00) - unlike
 * the module page's cards - so it is formatted here, once. Pure.
 */

import type {
  IncomingTransfer,
  InheritedTrial,
  PendingTransfer,
  SubscriberCandidate,
  SubscriberOptions,
} from "@/features/subscription/api/payerPortal";
import {
  formatMoney,
  longDate,
  shortDate,
  utcDay,
} from "@/features/subscription/lib/subscriptionSummary";

export const PICK_HEADING = "SELECT NEW SUBSCRIBER FOR THIS ENTITY (Admin Role Only)";
export const INVITE_HEADING = "Invite someone new";
export const INVITE_PLACEHOLDER = "name@company.com";
export const REQUEST_TRANSFER = "Request transfer";
export const WITHDRAW_REQUEST = "Withdraw request";
export const REQUEST_WAITING = "A request is already waiting.";
export const NO_ADMINS =
  "Nobody on this company is an admin. Someone has to be an admin here before the bill can sit with them.";
export const NO_COMPANY = "No company was picked. Open this from a row on Manage Subscriptions.";
export const NO_REQUESTS = "No requests waiting";
export const NO_REQUESTS_BODY =
  "When someone asks you to take over billing for their company, it’ll appear here for you to accept or decline.";
export const CONFIRM_TRANSFER = "Confirm Subscription Transfer";
export const TRANSFER_CHARGE_NOTE =
  "Subscription will be charged to your selected payment method from the date that transfer is completed.";
export const NOTHING_TO_PAY_TODAY = "Nothing to pay today.";

/** Minor units → "HK$88.00" / "HKD 88.00" (the currency code when no symbol is known). */
export function formatMinor(
  amount: number,
  currency: string | null,
  symbol?: string | null,
): string {
  const major = amount / 100;
  const shown = Number.isInteger(major) ? major : Number(major.toFixed(2));
  return formatMoney(symbol || currency || "", shown);
}

/**
 * The day the outgoing payer's money stops covering the company - the same for every
 * candidate (each quote's window starts there), so any quote answers it.
 */
export function paidThrough(options: SubscriberOptions): Date | null {
  for (const c of options.candidates) {
    const day = utcDay(c.quote?.covers_from);
    if (day) return day;
  }
  return null;
}

/** The footer's sentence (07-A/B/E): who is responsible, and until when. */
export function responsibilityNote(entityName: string, paidUntil: Date | null): string {
  const until = paidUntil
    ? ` This subscription has been paid up until ${longDate(paidUntil)}. The new subscriber will begin incurring charges after this date.`
    : "";
  return `Send request to take over the subscription. You are still responsible for ${entityName} until the transfer is successfully completed.${until}`;
}

/** The person an offer is waiting on, from the candidates (the API names them by id). */
export function pendingRecipient(
  options: SubscriberOptions,
): (SubscriberCandidate & { since: Date | null }) | null {
  const pending: PendingTransfer | null | undefined = options.pending_transfer;
  if (!pending) return null;
  const person = options.candidates.find((c) => c.id === pending.to_user_id);
  const since = utcDay(pending.since);
  return person
    ? { ...person, since }
    : { id: pending.to_user_id, name: "", email: "", is_current: false, since };
}

/** "Sent 26 Aug 2026 to Jiwon Kim. Nothing has changed and you are still the subscriber. …" */
export function pendingSentence(recipient: {
  name: string;
  email: string;
  since: Date | null;
}): string {
  const who = recipient.name || recipient.email || "them";
  const when = recipient.since ? ` ${shortDate(recipient.since)}` : "";
  return `Sent${when} to ${who}. Nothing has changed and you are still the subscriber. Withdraw it if you want to ask somebody else.`;
}

/** What one candidate would be charged, for the line under the picker; null without a quote. */
export function candidateCharge(c: SubscriberCandidate, symbol?: string | null): string | null {
  const q = c.quote;
  if (!q) return null;
  const from = utcDay(q.covers_from);
  const to = utcDay(q.covers_to);
  const window = from && to ? ` for ${shortDate(from)} to ${shortDate(to)}` : "";
  const anchor = q.anchor_is_new ? " This also sets their billing date." : "";
  return `They’ll be charged ${formatMinor(q.amount, q.currency, symbol)}${window} — the days after the period you’ve paid for, up to their own billing date.${anchor}`;
}

/** What accepting charges the recipient today (07-D's money), in the design's voice. */
export function acceptCharge(
  row: IncomingTransfer,
  symbol?: string | null,
): { today: string | null; detail: string | null; nothingDueNow: boolean } {
  const quote = row.quote;
  const amount = quote ? quote.amount : row.amount;
  const currency = quote ? quote.currency : row.currency;
  const trials = row.trials ?? [];
  if (amount != null) {
    const from = utcDay(quote?.covers_from);
    const to = utcDay(quote?.covers_to);
    const window = from && to ? ` for ${shortDate(from)} to ${shortDate(to)}` : "";
    const anchor = quote?.anchor_is_new
      ? " It also sets your monthly billing date."
      : " After that it renews on your usual billing date.";
    return {
      today: `You’ll be charged ${formatMinor(amount, currency, symbol)} today${window}.`,
      detail: `That covers the days after the period ${row.from_name || "the current subscriber"} has already paid for — you’re not charged for those.${anchor}`,
      nothingDueNow: false,
    };
  }
  // No figure AND something on trial means there is nothing to charge - not that pricing
  // failed: the free days carry over and the money comes at the conversion date.
  if (trials.length > 0) return { today: NOTHING_TO_PAY_TODAY, detail: null, nothingDueNow: true };
  return {
    today: null,
    detail:
      "We couldn’t price this request just now. Accepting will show you the amount before anything is charged.",
    nothingDueNow: false,
  };
}

/** "Petty Cash's free trial runs until 25 Sept 2026; HK$280 a month after that." per trial date. */
export function inheritedTrialLines(trials: InheritedTrial[], symbol?: string | null): string[] {
  return trials.map((t) => {
    const end = utcDay(t.trial_end);
    const when = end ? ` until ${shortDate(end)}` : "";
    const then =
      t.amount != null ? `; ${formatMinor(t.amount, t.currency, symbol)} a month after that` : "";
    return `${t.label} free trial carries over${when}${then}.`;
  });
}

/** The expiry chip on a request: "Expires 27 Sept 2026". */
export function expiresLabel(row: IncomingTransfer): string | null {
  const day = utcDay(row.expires_at);
  return day ? `Expires ${shortDate(day)}` : null;
}
