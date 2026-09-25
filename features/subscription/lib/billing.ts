/**
 * What the billing screens SHOW, derived from what the API SAYS - Figma section 08 ("Billing —
 * details and payment methods"), both of its pages:
 *
 * - the overview (08-A): one billing account's next bill, how many companies are paying and how
 *   many are on a trial about to end, and a line per company that needs the payer to know
 *   something;
 * - the billing page (08-B and its states): one billing account - who the bill goes to, its
 *   cards with the card it charges pinned first, and its invoices.
 *
 * THE READS: the billing accounts (`/api/me/billing/accounts` - each account's name, cards,
 * address and companies, and the payer's one next billing date; `lib/billingAccounts.ts` reads
 * them), the payer's companies (`/api/me/subscriptions` - every module's state, for the
 * overview) and the invoices (`/api/me/invoices?account=`). Everything here is pure: the hooks
 * fetch, this decides what is on the screen.
 *
 * What the design draws and the API cannot answer is left out rather than guessed - see
 * `docs/features/subscriptions.md` §15 (the estimated amount of the next bill).
 */

import type {
  InvoiceRow,
  PayerPaymentMethods,
  PayerSubscriptions,
  PortalEntity,
  PortalModule,
  SavedPaymentMethod,
} from "@/features/subscription/api/payerPortal";

import { utcDay } from "@/features/subscription/lib/subscriptionSummary";

/**
 * What both pages read the account from: the payer, the billing anchor and every company.
 * `fetchAllPayerSubscriptions` walks the pages and answers exactly this much, so neither page
 * depends on where the paging stopped.
 */
export type PayerAccount = Pick<
  PayerSubscriptions,
  "payer" | "billing" | "entities" | "transfer_outcomes"
>;

export const BILLING_TITLE = "Manage billing details and Payment Methods";
export const OVERVIEW_TITLE = "Subscription & Billing";
export const NEXT_BILLING = "Next billing";
export const BILL_TO = "Bill to";
export const NEXT_BILL_DATE = "Next Bill Date";
export const AMOUNT = "Amount";
export const ESTIMATED = "(estimated)";
export const DUE_IMMEDIATELY = "Due Immediately";
export const PAYMENT_FAILED = "Payment Failed";
export const PAYMENT_METHODS = "Payment Methods";
export const ADD_PAYMENT_METHOD = "+ Add payment method";
export const UPDATE_CARD = "Update card";
export const INVOICE_HISTORY = "Invoice History";
export const NO_CARD = "No card saved";
export const NO_CARD_BODY =
  "Trials keep running without one. A subscription cannot start, and nothing is charged, until a card is here.";
export const ADD_A_PAYMENT_METHOD = "Add a payment method";
export const NO_INVOICES = "Nothing has been billed yet.";
export const LOADING_INVOICES = "Loading the invoices…";
export const BILLING_LOAD_FAILED = "I couldn't load your billing details. Mind trying again?";
export const CARD_ACTION_FAILED = "That didn't go through. Mind trying again?";
/** 08-R: the default card cannot be removed while it is the one being charged. */
export const REMOVE_DEFAULT_TITLE = "Remove default card?";
export const REMOVE_DEFAULT_TAIL =
  " is currently your default payment method. Another card will need to be selected as the default payment method before this card can be removed.";
export const REMOVE_TITLE = "Remove this card?";
export const REMOVE_BODY =
  "It will be taken off your billing accounts. You can add it again later.";
/** 08-N / 08-S: what the page says when a card comes back from the Stripe form. */
export const CARD_ADDED = "New Card added";
export const CARD_ADDED_TAIL = "Successfully";
export const CARD_ADDED_DEFAULT = "This card is set as the default payment method.";
export const CARD_ADDED_NOT_DEFAULT = "This card is not your default payment method.";
export const SET_AS_DEFAULT = "Set as default";
export const ADD_CARD_TITLE = "Add Card Details";
export const ADD_CARD_HEADING = "Add a payment method";
export const EDIT_CARD_TITLE = "Edit Card Details";
export const EDIT_CARD_HEADING = "Edit card details";
export const EDIT_CARD_NOTE =
  "Only the name on the card and its expiry date can be changed. To use a different number, add a new card.";
export const EDIT_CARD_FOOT =
  "Changes take effect immediately. We re-verify the card with your bank before it is used again.";
export const STRIPE_NOTE =
  "Card details are held by our payment provider, Stripe — they are never stored by Minty.";
/**
 * The mandate, word for word as onboarding, Minty and billing-frontend print it. NOT fine print:
 * Stripe's own authorisation line is suppressed inside the card form (it names the Stripe
 * ACCOUNT, not Minty), so this sentence IS the disclosure and the two go together or not at all.
 */
export const CARD_MANDATE =
  "By providing your payment method, you authorise Minty to charge applicable subscription fees in accordance with the Subscription Terms.";
export const ACTIVE_SUBSCRIPTIONS = "Active subscriptions";
export const TRIAL_ENDING = "Trial ending";
export const SUBSCRIPTION_OVERVIEW = "Subscription Overview";
export const SUBSCRIPTION_UPDATES = "Subscription updates";
export const MANAGE_SUBSCRIPTION = "Manage Subscription";
export const GO_TO_BILLING = "Go to payment details and invoices";
export const BACK_TO_ENTITIES = "Back to the entity dashboard";
export const NOTHING_TO_UPDATE = "Nothing needs your attention right now.";
/** 08-A's card, named for what it is now that the eyebrow ("Payment Method") is gone. */
export const BILLING_ACCOUNT = "Billing account";
export const MANAGE_BILLING_DETAILS = "Manage Billing Details and Payment Methods";
export const NEXT_BILLING_DATE = "Next Billing Date";
export const CHANGE_BILLING_ACCOUNT = "Change billing account";
export const CHANGE_BILLING_DETAILS = "Change billing details";

/** 08-B's card rows: the chip each one wears, worst first in meaning, not in order. */
export type CardChip = "default" | "saved" | "expired";

export type CardRow = {
  card: SavedPaymentMethod;
  /** "Visa ending in 4121" - the design's line, built from the API's parts. */
  title: string;
  /** "Apr 2029" - a card expires in a month, not on a day (see §15's readings). */
  expiry: string | null;
  chip: CardChip;
  /** The card the billing account CHARGES - every company on it; it cannot be removed. */
  isDefault: boolean;
};

export function cardTitle(card: SavedPaymentMethod): string {
  if (!card.last4) return card.label;
  return `${card.brand_label || "Card"} ending in ${card.last4}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "4 / 2029" → "Apr 2029"; a wallet with no expiry keeps the API's own label, or nothing. */
export function cardExpiry(card: SavedPaymentMethod): string | null {
  if (card.exp_month && card.exp_year) {
    const month = MONTHS[Math.min(Math.max(card.exp_month, 1), 12) - 1];
    return `${month} ${card.exp_year}`;
  }
  return card.expiry;
}

/**
 * The saved cards as the page lists them: the default FIRST and pinned there (08-J's note - "the
 * default card stays pinned to the top and is the only one charged"), then the API's own order.
 * An expired card is named as expired rather than left to fail quietly at renewal.
 */
export function cardRows(wallet: PayerPaymentMethods | null): CardRow[] {
  const methods = wallet?.methods ?? [];
  const defaultId = wallet?.default_id ?? null;
  // `default_id` DECIDES when the wallet names one: a card's own `is_default` is a copy of the
  // same fact, and the two disagree for a moment after a promotion until the rows are re-read.
  const isDefaultCard = (m: SavedPaymentMethod) =>
    defaultId ? m.id === defaultId : Boolean(m.is_default);
  const ordered = [...methods].sort(
    (a, b) => Number(!isDefaultCard(a)) - Number(!isDefaultCard(b)),
  );
  return ordered.map((card) => {
    const isDefault = isDefaultCard(card);
    return {
      card,
      title: cardTitle(card),
      expiry: cardExpiry(card),
      chip: card.expired ? "expired" : isDefault ? "default" : "saved",
      isDefault,
    };
  });
}

/** 08-B lists the default card and one other; the rest wait behind "Show more (6)" (08-J). */
export const CARDS_SHOWN = 2;

export function visibleCards(rows: CardRow[], expanded: boolean): CardRow[] {
  return expanded ? rows : rows.slice(0, CARDS_SHOWN);
}

export function showMoreLabel(rows: CardRow[]): string | null {
  const hidden = rows.length - CARDS_SHOWN;
  return hidden > 0 ? `Show more (${hidden})` : null;
}

/** 08-W / 08-X: what the "Update card" menu offers for this row. */
export type CardMenuItem = "set_default" | "edit" | "delete";

export function cardMenu(row: CardRow): CardMenuItem[] {
  return row.isDefault ? ["edit", "delete"] : ["set_default", "edit", "delete"];
}

/** 08-I: the banner over the list when the card being charged has already expired. */
export function expiredNotice(rows: CardRow[]): string | null {
  const card = rows.find((r) => r.isDefault && r.card.expired) ?? null;
  if (!card) return null;
  const when = card.expiry ? ` on ${card.expiry}` : "";
  return `Your card expired${when}. Update your payment method here.`;
}

export type NextBilling = {
  /** Who Minty bills: the billing account's name (the payer, for an account never named). */
  billTo: string;
  email: string | null;
  /** The account's address, line by line (its charged card's billing address). */
  addressLines: string[];
  /**
   * The payer's NEXT billing date, formatted by the API - one date, every account renews on the
   * same anchor. Never the anchor itself: that is the FIRST charge, a date in the past from the
   * second month on (the bug this page shipped with until `next_billing` existed).
   */
  date: string | null;
  /**
   * What the account's next renewal will charge, ESTIMATED - "HKD 1,500", the currency by its
   * code and cents only when there are some (the design's "Amount … (estimated)"). The API prices
   * it with the renewal runner itself. Null with no account to price (the payer-level fallback)
   * or nothing to bill.
   */
  amount: string | null;
  /** True when the account is in dunning or a company on it is past due: amber (08-K). */
  failed: boolean;
  /** The companies whose payment failed, by name - the block names them rather than a count. */
  failedNames: string[];
};

function pastDue(entity: PortalEntity): boolean {
  return entity.modules.some((m) => m.status === "past_due");
}

/**
 * The payer-level fallback: what 08-A shows when the billing accounts could not be read - the
 * payer, and the date from the companies' read. `billingAccounts.accountBilling` is the answer
 * whenever there is an account to name.
 */
export function nextBilling(list: PayerAccount | null): NextBilling {
  const failedNames = (list?.entities ?? []).filter(pastDue).map((e) => e.entity_name);
  return {
    billTo: list?.payer?.name || list?.payer?.email || "",
    email: list?.payer?.email || null,
    addressLines: [],
    date: list?.billing?.next_billing ?? null,
    amount: null,
    failed: failedNames.length > 0,
    failedNames,
  };
}

/** The invoice table's rows (08-B). The API formats the money and the date; this only picks. */
export type InvoiceLine = {
  id: string;
  reference: string;
  amount: string;
  paid: string | null;
  /** Stripe's hosted invoice page - a capability URL, opened with rel="noopener noreferrer". */
  pdf: string | null;
};

export function invoiceLines(invoices: InvoiceRow[]): InvoiceLine[] {
  return invoices.map((inv) => ({
    id: inv.id,
    reference: inv.reference,
    amount: inv.amount,
    paid: inv.date,
    pdf: inv.hosted_invoice_url,
  }));
}

/** How many invoices a page of 08-B's table holds - the payer picks (the user's call). */
export const INVOICE_PAGE_SIZES = [10, 50, 100] as const;
export type InvoicePageSize = (typeof INVOICE_PAGE_SIZES)[number];

export function isInvoicePageSize(value: number): value is InvoicePageSize {
  return (INVOICE_PAGE_SIZES as readonly number[]).includes(value);
}

/** "11–13 of 13" - where this page sits in the account's invoices. */
export function invoiceRange(page: number, perPage: number, total: number): string {
  if (total <= 0) return "0 of 0";
  const first = (page - 1) * perPage + 1;
  return `${first}–${Math.min(page * perPage, total)} of ${total}`;
}

/** The invoice table's money column names the currency once, in its header (08-B: "Amount (HK$)"). */
export function amountHeader(invoices: InvoiceRow[]): string {
  const symbol = invoices.find((i) => i.amount)?.amount?.replace(/[\d.,\s]+$/, "") ?? "";
  return symbol ? `Amount (${symbol})` : "Amount";
}

// --- 08-A, the overview ------------------------------------------------------------

export type OverviewUpdate = {
  entityId: string;
  entityName: string;
  /** "Petty Cash trial ends in" / "Payment failed" - the module's name is drawn in bold. */
  module: string | null;
  text: string;
  /** "3 days" - drawn in orange beside the sentence; null for a failure. */
  emphasis: string | null;
  tone: "trial" | "failed";
};

export type Overview = {
  /** Companies with at least one module being paid for. */
  active: number;
  /** Companies with a trial ending within `TRIAL_ENDING_DAYS` (the design's "Trial ending"). */
  trialEnding: number;
  updates: OverviewUpdate[];
};

/**
 * How far off a trial's end may be and still count as "Trial ending" - and earn a line under
 * the figures. Thirty days, a trial's whole length (the user's call, 2026-09-25): in practice
 * every trial going on. It was a week, which read "0" to a payer with seven trials running.
 */
export const TRIAL_ENDING_DAYS = 30;

/** How many update lines 08-A shows until *Show more* opens the rest (the user's call). */
export const UPDATES_SHOWN = 5;

/** "Show more (7)" - or nothing, when every line already fits. The same words as 08-J's cards. */
export function moreUpdatesLabel(updates: OverviewUpdate[]): string | null {
  const hidden = updates.length - UPDATES_SHOWN;
  return hidden > 0 ? `Show more (${hidden})` : null;
}

/** The lines on show: the first `UPDATES_SHOWN`, or every one once opened. */
export function visibleUpdates(updates: OverviewUpdate[], expanded: boolean): OverviewUpdate[] {
  return expanded ? updates : updates.slice(0, UPDATES_SHOWN);
}

function daysUntil(iso: string | null, today: Date): number | null {
  const day = utcDay(iso);
  if (!day) return null;
  const from = utcDay(today.toISOString());
  if (!from) return null;
  return Math.round((day.getTime() - from.getTime()) / 86_400_000);
}

function trialing(entity: PortalEntity): PortalModule[] {
  return entity.modules.filter((m) => m.status === "trialing");
}

/**
 * The overview's two figures and the lines under them, from the list alone.
 *
 * "Active subscriptions" counts COMPANIES, not modules (the design says "entities"), and a
 * company counts once however many modules it pays for. A trial is not an active subscription -
 * nothing is being charged yet - which is why a payer with two trials and nothing else reads
 * "0 entities" beside "2 entities", exactly as frame 08-A draws it. "Trial ending" counts the
 * companies with a trial ending within `TRIAL_ENDING_DAYS`.
 *
 * THE LINES SAY WHICH: the same trials - the soonest first - under every payment that failed.
 * Figure and lines share the one window, so "Trial ending 6" never sits over "Nothing needs your
 * attention right now". The first `UPDATES_SHOWN` are shown; *Show more* opens the rest.
 */
export function overview(list: PayerAccount | null, today: Date): Overview {
  const entities = list?.entities ?? [];
  let active = 0;
  let trialEnding = 0;
  const failed: OverviewUpdate[] = [];
  const trials: { update: OverviewUpdate; left: number }[] = [];

  for (const entity of entities) {
    if (entity.modules.some((m) => m.status === "active" || m.status === "cancelled")) active += 1;

    const ending = trialing(entity).flatMap((trial) => {
      const left = daysUntil(trial.date_iso, today);
      return left !== null && left <= TRIAL_ENDING_DAYS ? [{ trial, left }] : [];
    });
    if (ending.length > 0) trialEnding += 1;

    for (const { trial, left } of ending) {
      trials.push({
        left,
        update: {
          entityId: entity.entity_id,
          entityName: entity.entity_name,
          module: trial.name,
          text: left <= 0 ? "trial ends today" : "trial ends in",
          emphasis: left <= 0 ? null : `${left} ${left === 1 ? "day" : "days"}`,
          tone: "trial",
        },
      });
    }

    if (pastDue(entity)) {
      failed.push({
        entityId: entity.entity_id,
        entityName: entity.entity_name,
        module: null,
        text: "Payment failed",
        emphasis: null,
        tone: "failed",
      });
    }
  }

  // A failure is the line somebody has to act on, so it sits above the trials counting down;
  // the trials run soonest first (a stable sort keeps a company's modules together on a tie).
  trials.sort((a, b) => a.left - b.left);
  return { active, trialEnding, updates: [...failed, ...trials.map((t) => t.update)] };
}

/** "0 entities" / "1 entity" - the design's unit line under each figure. */
export function entityCount(n: number): string {
  return n === 1 ? "1 entity" : `${n} entities`;
}
