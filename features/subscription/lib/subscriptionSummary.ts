/**
 * What the open row SHOWS, derived from what the API SAYS about the company - and from what the
 * person has ticked since.
 *
 * Figma section 05·A ("Subscription Summary — all 36 module-status combinations") draws the
 * Manage Subscriptions list with one row open: the company's two module cards, a checkbox under
 * each, a summary panel and two footer sentences. Section 05·B ("Subscription to be updated as
 * — every tick / untick") is its partner: every checkbox works in both directions, a change is
 * PENDING until "Confirm Subscription Change" is pressed, and can be undone without leaving.
 * This module turns the company's page model (`GET /api/entities/{id}/modules`: the cards,
 * `summary`, `panel`), its nominated card and the pending ticks into that view. Pure, and the
 * one place the design's rules are written down:
 *
 * - a card is TICKED when the module is ACTIVE (and not winding down), or when a trial is
 *   confirmed (card + consent in place - `needs_card` false); only a ticked card carries the
 *   teal fill, border and glow. A module never started gets a Start Free Trial button instead.
 * - each module has exactly one change from a given state: a card that is not ACTIVE can be
 *   ticked, an ACTIVE card unticked. A ticked card turns teal exactly like an active one, and
 *   the changed card carries a chip - Adding (a trial confirmed, an expired trial subscribed),
 *   Restoring (a cancellation resumed, a suspension reactivated), Removing (an active module
 *   cancelled); a confirmed trial unticked carries none (the NX-frames).
 * - "Billable" = ACTIVE or CANCELLATION_PENDING. The bundle (`summary.bundle_name`, its price)
 *   applies only when BOTH are billable; a trial is not billable, so the price is HK$0 while a
 *   trial is the only thing alive, and the amount box is greyed when nothing is charged.
 * - when something changes at the period end - a cancellation pending, a trial that will
 *   convert, or a pending tick - the panel splits into "Current Subscription / Until <period
 *   end>" and "Future Subscription / From <the day after>"; otherwise it reads "No pending
 *   changes". The future is what the ticks say; the current is what the API says today.
 * - the payment method shows when a card is nominated for the company; the footer names the
 *   day the company was created and the next renewal date the panel knows.
 *
 * Money is printed the module page's way: the summary's symbol, whole amounts without cents
 * (`HK$400`; a symbol that is letters gets a space, `HKD 400`, as the API's `format_trimmed`).
 *
 * `forecast()` is the panel's arithmetic on its own - what bills now, what bills after the
 * change day, and when that is - so the result screens (`lib/changeResult.ts`, Figma 05·C) say
 * the same numbers the panel did.
 *
 * `pageFromList()` is the company as the LIST already knows it (`/api/me/subscriptions`: a
 * status and a date per module), shaped as a page model: the row opens with its cards drawn
 * from that while the real page model is fetched and the panel says "Calculating…" (Figma
 * 05·B-C). A trial's card and consent are not known there, so it is drawn unconfirmed until
 * the page model answers.
 */

import type {
  EntityPaymentMethod,
  PortalEntity,
  PortalModule,
  SavedPaymentMethod,
} from "@/features/subscription/api/payerPortal";
import type {
  ModuleCard,
  ModuleCode,
  ModulePage,
} from "@/features/subscription/api/moduleSettings";
import { resolveModuleState, type ModuleView } from "@/features/subscription/lib/moduleState";

/** The plan names' colours: the design paints each module's name in its own colour. */
export type PlanTone = "petty" | "payment" | "bundle" | "none";

export type PlanLine = { name: string; tone: PlanTone; tag: string | null };

/** What sits under a module card. */
export type TickState = "ticked" | "unticked" | "start_trial";

/** What a change to a module IS - the action it becomes when confirmed (`api/moduleChanges.ts`). */
export type TickSeam = "confirm_trial" | "subscribe" | "cancel" | "resume" | "reactivate";

/** The chip on a changed card (05·B). */
export type Chip = "Adding" | "Removing" | "Restoring";

/** The ticks the person has changed and not yet confirmed: the tick they want per module. */
export type PendingTicks = Partial<Record<ModuleCode, boolean>>;

export type SummaryModule = {
  code: ModuleCode;
  name: string;
  view: ModuleView;
  /** The tick as shown - the pending one when the person changed it. */
  tick: TickState;
  /** What the change to this module would be, if the tick were flipped; null for Start Free Trial. */
  seam: TickSeam | null;
  /** Set while this module's tick differs from what the API says. */
  chip: Chip | null;
  changed: boolean;
};

export type SummaryBlock = {
  heading: string;
  /** "Until 16 August 2026" / "From 17 August 2026". */
  dateLine: string | null;
  lines: PlanLine[];
  price: string;
  /** The singles' sum struck through when the bundle price applies. */
  struck: string | null;
  /** "No additional charges will apply during the trial period." */
  note: string | null;
  greyed: boolean;
};

export type SummaryPanel =
  | { kind: "simple"; lines: PlanLine[]; price: string; greyed: boolean }
  | { kind: "changing"; current: SummaryBlock; future: SummaryBlock | null };

export type SummaryPayment = { brand: string; last4: string | null; label: string };

/** A pending change to confirm: the first module changed decides which confirmation opens. */
export type PendingChange = { code: ModuleCode; seam: TickSeam; codes: ModuleCode[] };

export type SummaryView = {
  modules: SummaryModule[];
  /** The blue ⓘ line: a trial is running. */
  trialNotice: boolean;
  panel: SummaryPanel;
  paymentMethod: SummaryPayment | null;
  footer: { createdOn: string | null; renewalOn: string | null };
  /** Set while a tick is pending: the "Confirm Subscription Change" button. */
  pendingChange: PendingChange | null;
};

export const TRIAL_NOTICE =
  "Confirm your subscription at any time during the trial. You'll continue to enjoy all remaining trial days before billing begins.";
export const TRIAL_NO_CHARGE = "No additional charges will apply during the trial period.";
export const NO_MODULE = "No module selected";
export const NO_MODULES = "No modules selected";
export const CONFIRM_CHANGE = "Confirm Subscription Change";

const TONE: Record<ModuleCode, PlanTone> = { PETTY_CASH: "petty", PAYMENT_REQUEST: "payment" };

// ---- money ---------------------------------------------------------------------------------

/** `HK$400`, `HK$400.50`, `HKD 400` - the API's `format_trimmed` in the browser. */
export function formatMoney(symbol: string, amount: number): string {
  const whole = Number.isInteger(amount);
  const digits = whole ? String(amount) : amount.toFixed(2);
  const sym = symbol.trim();
  if (!sym) return digits;
  return /[A-Za-z]$/.test(sym) ? `${sym} ${digits}` : `${sym}${digits}`;
}

function amountOf(card: ModuleCard): number {
  const n = Number(card.amount ?? card.formatted_amount);
  return Number.isFinite(n) ? n : 0;
}

// ---- dates ---------------------------------------------------------------------------------

export function utcDay(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** "16 August 2026" */
export function longDate(day: Date): string {
  return day.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "11 Sept 2025" - the footer's form (en-GB's short month). */
export function shortDate(day: Date): string {
  return day.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function dayAfter(day: Date): Date {
  return new Date(day.getTime() + 86_400_000);
}

// ---- the cards -----------------------------------------------------------------------------

export function billable(card: ModuleCard): boolean {
  return card.subscription_status === "active";
}

export function winding(card: ModuleCard): boolean {
  return (
    billable(card) &&
    Boolean(card.pending_cancel || card.cancel_at_period_end || card.trial_cancelled)
  );
}

export function trialing(card: ModuleCard): boolean {
  return card.subscription_status === "trialing";
}

/** A trial with a card and this company's consent converts on its own - the N-frames. */
export function trialConfirmed(card: ModuleCard): boolean {
  return trialing(card) && !card.needs_card && !card.trial_cancelled;
}

/** The tick the API's state gives a card, and the change a press would make. */
export function tickOf(card: ModuleCard): { tick: TickState; seam: TickSeam | null } {
  if (card.subscription_status === "past_due") return { tick: "unticked", seam: "reactivate" };
  if (winding(card)) return { tick: "unticked", seam: "resume" };
  if (billable(card)) return { tick: "ticked", seam: "cancel" };
  if (trialing(card)) {
    return trialConfirmed(card)
      ? { tick: "ticked", seam: "cancel" }
      : { tick: "unticked", seam: "confirm_trial" };
  }
  if (card.trial_eligible) return { tick: "start_trial", seam: null };
  return { tick: "unticked", seam: "subscribe" };
}

/** The chip a changed card carries: what the confirmed change would do to it. */
function chipOf(card: ModuleCard, wanted: boolean): Chip | null {
  if (wanted)
    return winding(card) || card.subscription_status === "past_due" ? "Restoring" : "Adding";
  // Unticking: an active module is removed; a confirmed trial simply stops converting (no chip).
  return billable(card) ? "Removing" : null;
}

/** The tick as shown - the pending one when the person changed it - and whether it changed. */
function shownTick(card: ModuleCard, pending: PendingTicks): { tick: TickState; changed: boolean } {
  const own = tickOf(card).tick;
  const wanted = pending[card.code];
  const changed = own !== "start_trial" && wanted !== undefined && wanted !== (own === "ticked");
  return { tick: changed ? (wanted ? "ticked" : "unticked") : own, changed };
}

function moduleOf(card: ModuleCard, today: Date, pending: PendingTicks): SummaryModule {
  const view = resolveModuleState(card, today);
  const { seam } = tickOf(card);
  const wanted = pending[card.code];
  const { tick, changed } = shownTick(card, pending);
  // Only a ticked card is drawn live (the teal fill, border and glow); the design's "Active"
  // reads as one word here.
  const live = tick === "ticked";
  const status = view.state === "active" ? { ...view.status, text: "Active" } : view.status;
  return {
    code: card.code,
    name: card.name,
    view: { ...view, live, status },
    tick,
    seam,
    chip: changed ? chipOf(card, Boolean(wanted)) : null,
    changed,
  };
}

// ---- the panel -----------------------------------------------------------------------------

function line(card: ModuleCard, tag: string | null): PlanLine {
  return { name: card.name, tone: TONE[card.code] ?? "none", tag };
}

function isBundleSet(cards: ModuleCard[], page: ModulePage): boolean {
  const bundleCodes = (page.summary?.bundle_codes ?? []).map((c) => String(c).toUpperCase()).sort();
  const codes = cards.map((c) => c.code.toUpperCase()).sort();
  return (
    bundleCodes.length > 1 &&
    codes.length === bundleCodes.length &&
    codes.every((c, i) => c === bundleCodes[i])
  );
}

function priceOf(cards: ModuleCard[], page: ModulePage): { price: number; struck: number | null } {
  const sum = cards.reduce((acc, c) => acc + amountOf(c), 0);
  if (isBundleSet(cards, page)) {
    const bundle = Number(page.summary?.bundle_amount);
    if (Number.isFinite(bundle)) return { price: bundle, struck: sum > bundle ? sum : null };
  }
  return { price: sum, struck: null };
}

function bundleLine(page: ModulePage): PlanLine {
  return { name: page.summary?.bundle_name || "Super Minty", tone: "bundle", tag: null };
}

// ---- the forecast ----------------------------------------------------------------------------

export type Forecast = {
  /** The summary's currency symbol. */
  symbol: string;
  /** What bills today: ACTIVE, winding down or not. */
  billed: ModuleCard[];
  trials: ModuleCard[];
  /** Billing today but scheduled to stop at its period end. */
  cancelling: ModuleCard[];
  /** A trial that converts at its term end. */
  converting: ModuleCard[];
  /** The cards whose tick is pending. */
  changed: ModuleCard[];
  /** What bills after the change day: the ticks as shown. */
  future: ModuleCard[];
  /** Something ends or starts at a period end, or a tick is pending. */
  changing: boolean;
  /** The earliest period end that changes; null when nothing does, or the change is today. */
  until: Date | null;
  now: { price: number; struck: number | null };
  after: { price: number; struck: number | null };
};

/**
 * The panel's arithmetic: what bills now, what will after the change day, and when that is.
 * `pending` are the ticks the person changed (none for the state as the API says it).
 */
export function forecast(page: ModulePage, today: Date, pending: PendingTicks = {}): Forecast {
  const cards = page.cards;
  const symbol =
    page.summary?.currency ?? page.cards.find((c) => c.currency_code)?.currency_code ?? "";
  const billed = cards.filter(billable);
  const trials = cards.filter(trialing);
  const cancelling = billed.filter(winding);
  const converting = trials.filter(trialConfirmed);
  const shown = cards.map((c) => ({ card: c, ...shownTick(c, pending) }));
  const changed = shown.filter((s) => s.changed).map((s) => s.card);
  const future = shown.filter((s) => s.tick === "ticked").map((s) => s.card);
  // Ends at the period end of whatever changes; the future starts the day after. A module with
  // no period running (expired, suspended - a date already behind it, or none) changes today,
  // and names no date.
  const until =
    [
      ...[...cancelling, ...converting].map(
        (c) => utcDay(c.period_end) ?? utcDay(c.access_end_date),
      ),
      ...changed.map((c) => utcDay(c.period_end)),
    ]
      .filter((d): d is Date => d !== null && d.getTime() > today.getTime())
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  return {
    symbol,
    billed,
    trials,
    cancelling,
    converting,
    changed,
    future,
    changing: cancelling.length > 0 || converting.length > 0 || changed.length > 0,
    until,
    now: priceOf(billed, page),
    after: priceOf(future, page),
  };
}

export function buildSummaryView(
  page: ModulePage,
  entity: Pick<PortalEntity, "created_at"> | null,
  wallet: EntityPaymentMethod | null,
  today: Date,
  pending: PendingTicks = {},
): SummaryView {
  const cards = page.cards;
  const modules = cards.map((c) => moduleOf(c, today, pending));
  const byCode = new Map(modules.map((m) => [m.code, m]));
  const shown = (card: ModuleCode) => byCode.get(card)!;
  const trialNotice = cards.some(trialing);

  // Today as the API says it, the future as the ticks say it - the API's own when none pends.
  const f = forecast(page, today, pending);
  const { billed, trials, cancelling, future, changing, until } = f;
  const changedCards = f.changed;
  const money = (n: number) => formatMoney(f.symbol, n);

  let panel: SummaryPanel;
  if (!changing) {
    const lines: PlanLine[] =
      billed.length > 0 && isBundleSet(billed, page)
        ? [bundleLine(page)]
        : [...billed.map((c) => line(c, null)), ...trials.map((c) => line(c, "(Free Trial)"))];
    const { price } = priceOf(billed, page);
    panel = {
      kind: "simple",
      lines: lines.length > 0 ? lines : [{ name: NO_MODULE, tone: "none", tag: null }],
      price: money(price),
      greyed: price === 0,
    };
  } else {
    const currentLines: PlanLine[] =
      billed.length > 0 && isBundleSet(billed, page) && cancelling.length === 0
        ? [bundleLine(page), ...trials.map((c) => line(c, "(Free Trial)"))]
        : [
            ...billed.map((c) => line(c, winding(c) ? "(Cancellation in progress)" : "(Active)")),
            ...trials.map((c) => line(c, "(Free Trial)")),
          ];
    const current = f.now;
    const futureLines: PlanLine[] =
      future.length > 0 && isBundleSet(future, page)
        ? [bundleLine(page)]
        : future.map((c) => line(c, future.length === 1 ? "only" : null));
    const futurePrice = f.after;
    // Nothing billing now and nothing after (a confirmed trial unticked - the NX-frames): the
    // current block says it all and there is no future to draw.
    const showFuture = future.length > 0 || billed.length > 0;
    panel = {
      kind: "changing",
      current: {
        heading: "Current Subscription",
        dateLine: until ? `Until ${longDate(until)}` : null,
        lines:
          currentLines.length > 0 ? currentLines : [{ name: NO_MODULE, tone: "none", tag: null }],
        price: money(current.price),
        struck: current.struck !== null ? money(current.struck) : null,
        note: current.price === 0 && trials.length > 0 ? TRIAL_NO_CHARGE : null,
        greyed: true,
      },
      future: showFuture
        ? {
            heading: "Future Subscription",
            dateLine: until ? `From ${longDate(dayAfter(until))}` : null,
            lines:
              futureLines.length > 0
                ? futureLines
                : [{ name: NO_MODULES, tone: "none", tag: null }],
            price: money(futurePrice.price),
            struck: null,
            note: null,
            greyed: false,
          }
        : null,
    };
  }

  const nominated: SavedPaymentMethod | undefined = wallet?.nominated_id
    ? wallet.methods.find((m) => m.id === wallet.nominated_id)
    : undefined;
  const paymentMethod: SummaryPayment | null = nominated
    ? {
        brand: nominated.brand_label || nominated.wallet_label || "Card",
        last4: nominated.last4,
        label: nominated.last4
          ? `${nominated.brand_label || "Card"} ${nominated.last4}`
          : nominated.label,
      }
    : null;

  const created = utcDay(entity?.created_at ?? null);
  const renewal = page.panel?.next_invoice?.date ?? null;

  const first = changedCards[0];
  const pendingChange: PendingChange | null =
    first && shown(first.code).seam
      ? {
          code: first.code,
          seam: shown(first.code).seam!,
          codes: changedCards.map((c) => c.code),
        }
      : null;

  return {
    modules,
    trialNotice,
    panel,
    paymentMethod,
    footer: { createdOn: created ? shortDate(created) : null, renewalOn: renewal },
    pendingChange,
  };
}

// ---- the company as the list knows it ---------------------------------------------------------

const MODULE_NAME: Record<ModuleCode, string> = {
  PETTY_CASH: "Petty Cash",
  PAYMENT_REQUEST: "Payment Request",
};

function cardFromList(m: PortalModule): ModuleCard {
  const code = m.code as ModuleCode;
  const day = m.date_iso ?? null;
  const card: ModuleCard = {
    code,
    name: m.name || MODULE_NAME[code] || m.code,
    description: "",
    learn_more: null,
    is_subscribed: false,
    trial_eligible: false,
    trial_closing: false,
    trial_expired: false,
    lapsed_long: false,
    has_access: false,
    subscription_status: null,
    can_cancel: false,
    formatted_amount: "",
    currency_code: "",
    billing_interval: "month",
    cancel_at_period_end: false,
    pending_cancel: false,
    trial_cancelled: false,
    formatted_period_end: null,
    period_end_short: null,
    period_end_long: null,
    period_end: null,
    extension_formatted: null,
    access_end_date: null,
    access_end_long: null,
    needs_card: false,
    needs_consent_only: false,
  };
  switch (m.status) {
    case "not_subscribed":
      return { ...card, trial_eligible: true };
    case "trialing":
      return {
        ...card,
        is_subscribed: true,
        has_access: true,
        subscription_status: "trialing",
        period_end: day,
        needs_card: true,
      };
    case "trial_expired":
      return { ...card, trial_expired: true, access_end_date: day };
    case "active":
      return {
        ...card,
        is_subscribed: true,
        has_access: true,
        subscription_status: "active",
        period_end: day,
      };
    case "cancelled":
      return {
        ...card,
        is_subscribed: true,
        has_access: true,
        subscription_status: "active",
        pending_cancel: true,
        cancel_at_period_end: true,
        period_end: day,
        access_end_date: day,
      };
    case "past_due":
      return {
        ...card,
        is_subscribed: true,
        has_access: true,
        subscription_status: "past_due",
        access_end_date: day,
      };
    default:
      return card;
  }
}

/** The company's page model as far as the list's row can tell it - the cards, no money. */
export function pageFromList(entity: PortalEntity): ModulePage {
  return {
    entity_id: entity.entity_id,
    cards: entity.modules.map(cardFromList),
    can_manage_modules: true,
    payer: null,
    viewer: { name: "", initials: "" },
    next_payment_date: null,
    summary: null,
    panel: null,
  };
}

/** Flip one module's tick: undone when it is already pending, otherwise the opposite of today's. */
export function toggleTick(pending: PendingTicks, card: ModuleCard): PendingTicks {
  const own = tickOf(card);
  if (own.tick === "start_trial") return pending;
  if (card.code in pending) {
    const next = { ...pending };
    delete next[card.code];
    return next;
  }
  return { ...pending, [card.code]: own.tick !== "ticked" };
}
