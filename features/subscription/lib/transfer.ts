/**
 * What the transfer screens SHOW, derived from what the API SAYS - Figma section 07 ("Transfer
 * — handing the subscription over"), both sides of it:
 *
 * - the payer's side (07-A/B/C/K/L): `/api/me/subscriptions/subscriber-options` - the company,
 *   who is billed today, the admins it could be handed to (each with ITS OWN quote, priced
 *   against the recipient's billing anchor), why it cannot go ahead (`blockers`, the API's
 *   words), and the offer already waiting (`pending_transfer`), if any;
 * - the recipient's side (07-D/E/F/M): `/api/me/subscriptions/transfers` - the offers made to
 *   the signed-in person, each with the company, who asks, and blockers. ACCEPTING CHARGES
 *   NOTHING - the API takes no money for days that have not started and parks the charge until
 *   they do - so neither the `quote` on those rows nor the inherited trials are drawn.
 *
 * Money from these routes is in MINOR units (the engine's invoices: 8800 = HK$88.00) - unlike
 * the module page's cards - so it is formatted here, once. Pure.
 */

import type {
  IncomingTransfer,
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
/**
 * 07-D when the person has no saved card. Not a refusal: a company may be offered to any admin,
 * and the card is only needed at the moment of accepting, which is what this says.
 */
export const NEEDS_CARD =
  "Add a payment method to take this over. Nothing is charged until you confirm.";

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
 * The day the outgoing payer's money stops covering the company.
 *
 * The API answers it on the payload, because it is a fact about the ENTITY. It used to be
 * read off a candidate's quote - and quotes are priced per candidate, only when there is
 * one: a company whose payer is its own only admin has none, and the footer lost "paid up
 * until ..." on exactly the screen that exists to say what the payer is still liable for.
 * The quote scan stays as a fallback so an older API still answers.
 */
export function paidThrough(options: SubscriberOptions): Date | null {
  const own = utcDay(options.paid_through);
  if (own) return own;
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

export const NO_PENDING_CHANGES = "No pending changes";

/** One declined module: its name, and whether its free days are what end rather than a period. */
export type DeclinedModule = { name: string; trialing: boolean };

function list(names: string[]): string {
  return names.length === 1
    ? names[0]
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * What unticking a module on 07-D means, said plainly (the line under the price).
 *
 * A declined module is not merely "not taken on" — it is CANCELLED for the company, and this
 * is the only place that decision is visible before Confirm.
 *
 * A TRIAL AND A PAID MODULE END ON DIFFERENT DAYS, so they get different sentences. A paid
 * one stops when the outgoing payer's money runs out, which is a date this screen knows. A
 * trial runs its free days out and then simply does not convert — an earlier version said
 * both ended "when the current subscription runs out", which was wrong for the trial and is
 * the reason these are split.
 */
export function declinedNote(modules: DeclinedModule[], endsOn: Date | null): string {
  if (modules.length === 0) return NO_PENDING_CHANGES;
  const trials = modules.filter((m) => m.trialing).map((m) => m.name);
  const paid = modules.filter((m) => !m.trialing).map((m) => m.name);
  if (paid.length > 0 && !endsOn) {
    // Callers check `undatedDecline` first and show that instead. Reaching here would mean
    // printing a date-shaped sentence with no date behind it, about a module that is about
    // to be cancelled - so it raises rather than inventing wording for a broken read.
    throw new Error("declinedNote: a paid module was declined with no end date");
  }
  const parts: string[] = [];
  if (trials.length > 0) {
    parts.push(`${list(trials)} ${trials.length === 1 ? "ends" : "end"} when the trial runs out.`);
  }
  if (paid.length > 0) {
    parts.push(`${list(paid)} ${paid.length === 1 ? "ends" : "end"} on ${shortDate(endsOn!)}.`);
  }
  return parts.join(" ");
}

/**
 * The one state this screen must not paper over: a PAID module is being declined and the API
 * has not said when the company is paid up to.
 *
 * That date is where the module would stop, and it comes from the same read that prices the
 * handover - so its absence means the pricing failed, not that the answer is "no date". Said
 * softly it reads as ordinary copy ("...when the current subscription runs out") above a
 * button that cancels a module for real. So it is a refusal instead: the sentence says what
 * is wrong and Confirm is held until it is not.
 *
 * Returns the refusal, or null when there is nothing wrong. A declined TRIAL is unaffected -
 * it ends at its own trial end and never needed this date.
 */
export function undatedDecline(modules: DeclinedModule[], endsOn: Date | null): string | null {
  if (endsOn) return null;
  const paid = modules.filter((m) => !m.trialing).map((m) => m.name);
  if (paid.length === 0) return null;
  return `We can't tell when ${list(paid)} would stop being billed, so this can't go ahead. Refresh and try again.`;
}

/** The expiry chip on a request: "Expires 27 Sept 2026". */
export function expiresLabel(row: IncomingTransfer): string | null {
  const day = utcDay(row.expires_at);
  return day ? `Expires ${shortDate(day)}` : null;
}
