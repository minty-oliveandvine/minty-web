/**
 * What the row (or the page) SHOWS once a change has been applied - Figma section 05·C ("After
 * Confirm — the result screens"), where every Confirm Subscription Change lands, and where the
 * list's Start Trial lands too. Which screen appears depends on what the change DID, not on
 * which state it came from, so it is read off the company's page model before and after:
 *
 * - nothing left billing after a removal → the subscription cancellation page ("Thank you for
 *   being part of Minty", access until the end of the current period);
 * - a module removed while another paid one keeps running → the module cancellation page
 *   ("<Module> Cancellation Confirmed", access until its date, "you can reactivate anytime");
 * - a removal and an addition in one change → "Subscription updated" in the row (what ends and
 *   when, what is available now, the price until then and after);
 * - anything else that was added, confirmed, restored or started → "Congratulations!" in the
 *   row: one line per module ("… is confirmed. Billing starts the day its trial ends.", "… is
 *   active. Your card has been charged.", "… is restored and billing carries on as before.",
 *   "… free trial has started — 30 days, free.") and one line of money, the panel's own
 *   arithmetic (`forecast`): "Nothing is being charged." / "HK$400 a month." / "Nothing charged
 *   today · HK$400 a month when the trial ends." / "HK$280 a month now · HK$400 when the trial
 *   ends." / "HK$400 until 20 Aug 2026, then HK$280 a month."
 *
 * The lines come from the DIFFERENCE between the two page models, not from the ticks asked
 * for: a company's consent covers every trial it runs, so confirming one confirms both, and
 * the row says so. The design's 108 generated frames (RU/RV/RW) are the copy; the "row" layout
 * is 05·C-1/-5/-6 (the list, this row open), the "page" layout 05·C-2/-3 (the banner retitled,
 * one card). Pure.
 */

import type { PortalEntity } from "@/features/subscription/api/payerPortal";
import type {
  ModuleCard,
  ModuleCode,
  ModulePage,
} from "@/features/subscription/api/moduleSettings";
import { TRIAL_DAYS } from "@/features/subscription/lib/moduleState";
import {
  billable,
  forecast,
  formatMoney,
  longDate,
  rowFooter,
  shortDate,
  trialConfirmed,
  trialing,
  utcDay,
  winding,
  type Forecast,
  type PlanTone,
  type RowFooterFacts,
} from "@/features/subscription/lib/subscriptionSummary";

export type ResultKind =
  "celebrate" | "updated" | "module_cancelled" | "subscription_cancelled" | "transferred";

/** A module's name, painted in its colour. */
export type ModuleRef = { code: ModuleCode; name: string; tone: PlanTone };

/** One line of the row layout: the module in colour, then what happened to it. */
export type ResultLine = { module: ModuleRef; text: string };

/** A run of a paragraph: plain, a bold date, a company's name in teal, or a module's name in its colour. */
export type ResultPart = { text: string; style: "plain" | "strong" | "company" | PlanTone };

export type ChangeResult = {
  kind: ResultKind;
  /** In the list with this row open, or the whole page (the banner retitled, one card). */
  layout: "row" | "page";
  /** The page layout's banner title. */
  hero: string | null;
  /** "Congratulations!" / "Subscription updated" / "<Module> Cancellation Confirmed" / "Thank you …" */
  headline: { module: ModuleRef | null; text: string };
  company: string;
  lines: ResultLine[];
  money: string | null;
  paragraphs: ResultPart[][];
  footer: RowFooterFacts;
};

/** What was asked: the open row's ticks, or the list's Start Trial. */
export type ChangeAsked =
  { kind: "ticks"; codes: ModuleCode[] } | { kind: "start_trial"; code: ModuleCode };

export const HERO_MODULE_CANCELLED = "Module Cancellation Scheduled";
export const HERO_SUBSCRIPTION_CANCELLED = "Cancellation Scheduled";
export const CONGRATULATIONS = "Congratulations!";
export const SUBSCRIPTION_UPDATED = "Subscription updated";
export const THANK_YOU = "Thank you for being part of Minty";
export const BACK_TO_LIST = "Back to Manage Subscriptions";
export const NOTHING_CHARGED = "Nothing is being charged.";

const TONE: Record<ModuleCode, PlanTone> = { PETTY_CASH: "petty", PAYMENT_REQUEST: "payment" };

function ref(card: ModuleCard): ModuleRef {
  return { code: card.code, name: card.name, tone: TONE[card.code] ?? "none" };
}

/** What happened to one module between the two page models. */
export type Outcome = "started" | "confirmed" | "activated" | "restored" | "ending" | "stopped";

export function outcomeOf(before: ModuleCard, after: ModuleCard): Outcome | null {
  const suspended = before.subscription_status === "past_due";
  if (!trialing(before) && !billable(before) && !suspended && trialing(after)) return "started";
  if (trialing(before) && !trialConfirmed(before) && trialing(after) && trialConfirmed(after))
    return "confirmed";
  if ((winding(before) || suspended) && billable(after) && !winding(after)) return "restored";
  if (!billable(before) && !trialing(before) && billable(after) && !winding(after))
    return "activated";
  if (billable(before) && !winding(before) && winding(after)) return "ending";
  if (
    trialing(before) &&
    trialConfirmed(before) &&
    (!trialing(after) || after.trial_cancelled || !trialConfirmed(after))
  )
    return "stopped";
  return null;
}

/** The day a module's access ends, as the page model after the change says it. */
function accessEnd(card: ModuleCard): Date | null {
  return utcDay(card.access_end_date) ?? utcDay(card.period_end);
}

/**
 * The bold line of money under the row's lines - the panel's forecast, in a sentence. When a
 * module is scheduled to end, "until" is ITS day (the line above names the same one), and what
 * follows is what the ticks bill after the change.
 */
export function moneyLine(f: Forecast): string {
  const money = (n: number) => formatMoney(f.symbol, n);
  const ends = f.cancelling
    .map(accessEnd)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  const until = ends[0] ?? f.until;
  if (!f.changing || until === null) {
    return f.now.price === 0 ? NOTHING_CHARGED : `${money(f.now.price)} a month.`;
  }
  if (f.converting.length > 0 && f.cancelling.length === 0) {
    return f.now.price === 0
      ? `Nothing charged today · ${money(f.after.price)} a month when the trial ends.`
      : `${money(f.now.price)} a month now · ${money(f.after.price)} when the trial ends.`;
  }
  return `${money(f.now.price)} until ${shortDate(until)}, then ${money(f.after.price)} a month.`;
}

function lineFor(outcome: Outcome, card: ModuleCard): string {
  switch (outcome) {
    case "started":
      return `${card.name} free trial has started — ${TRIAL_DAYS} days, free.`;
    case "confirmed":
      return `${card.name} is confirmed. Billing starts the day its trial ends.`;
    case "activated":
      return `${card.name} is active. Your card has been charged.`;
    case "restored":
      return `${card.name} is restored and billing carries on as before.`;
    case "ending": {
      const end = accessEnd(card);
      return end
        ? `${card.name} is scheduled to end on ${shortDate(end)}.`
        : `${card.name} is scheduled to end.`;
    }
    case "stopped": {
      const end = accessEnd(card);
      return end
        ? `${card.name}'s trial ends on ${shortDate(end)} and will not be billed.`
        : `${card.name}'s trial will not be billed.`;
    }
  }
}

export const TRANSFER_COMPLETED = "Subscription Transfer Completed";

/**
 * Where accepting a handover lands (Figma 07-M): in the list, the company's row saying it is
 * now the person's - the sentences of the frame, the footer as any row's.
 */
export function transferredResult(
  entity: Pick<PortalEntity, "entity_name" | "created_at">,
  after: ModulePage | null,
): ChangeResult {
  return {
    kind: "transferred",
    layout: "row",
    hero: null,
    headline: { module: null, text: TRANSFER_COMPLETED },
    company: entity.entity_name,
    lines: [],
    money: null,
    paragraphs: [
      [{ text: "The subscription transfer has been completed successfully.", style: "plain" }],
      [
        { text: "You are now the owner of the ", style: "plain" },
        { text: entity.entity_name, style: "company" },
        { text: " subscription and have full control of this Minty.", style: "plain" },
      ],
    ],
    footer: rowFooter(entity, after),
  };
}

export function buildChangeResult(
  asked: ChangeAsked,
  before: ModulePage,
  after: ModulePage,
  entity: Pick<PortalEntity, "entity_name" | "created_at">,
  today: Date,
): ChangeResult {
  const company = entity.entity_name;
  const footer = rowFooter(entity, after);

  // What changed, module by module.
  const diff = after.cards
    .map((a) => {
      const b = before.cards.find((c) => c.code === a.code);
      return b ? { card: a, outcome: outcomeOf(b, a) } : null;
    })
    .filter((d): d is { card: ModuleCard; outcome: Outcome } => d !== null && d.outcome !== null);
  const removed = diff.filter((d) => d.outcome === "ending" || d.outcome === "stopped");
  const added = diff.filter((d) => d.outcome !== "ending" && d.outcome !== "stopped");

  if (removed.length > 0 && added.length === 0) {
    const gone = new Set(removed.map((d) => d.card.code));
    const others = after.cards.filter((c) => billable(c) && !gone.has(c.code));
    const ends = removed.map((d) => accessEnd(d.card)).filter((d): d is Date => d !== null);
    const last = ends.length > 0 ? new Date(Math.max(...ends.map((d) => d.getTime()))) : null;

    if (others.length > 0 && removed.length === 1) {
      const m = ref(removed[0].card);
      const paragraphs: ResultPart[][] = [
        [
          { text: "We've received your cancellation request for ", style: "plain" },
          { text: m.name, style: m.tone },
          { text: ".", style: "plain" },
        ],
        last
          ? [
              { text: "You'll still have access until ", style: "plain" },
              { text: longDate(last), style: "strong" },
              {
                text: ". Your other module will remain active, and your subscription fee will be updated accordingly.",
                style: "plain",
              },
            ]
          : [
              {
                text: "Your other module will remain active, and your subscription fee will be updated accordingly.",
                style: "plain",
              },
            ],
        [
          { text: "Changed your mind? You can reactivate ", style: "plain" },
          { text: m.name, style: m.tone },
          { text: " anytime!", style: "plain" },
        ],
      ];
      return {
        kind: "module_cancelled",
        layout: "page",
        hero: HERO_MODULE_CANCELLED,
        headline: { module: m, text: " Cancellation Confirmed" },
        company,
        lines: [],
        money: null,
        paragraphs,
        footer,
      };
    }

    const paragraphs: ResultPart[][] = [
      [{ text: "Your Minty subscription has been scheduled for cancellation.", style: "plain" }],
      last
        ? [
            {
              text: "You will continue to have access to your subscribed modules until the end of your current billing period which is ",
              style: "plain",
            },
            { text: longDate(last), style: "strong" },
            { text: ".", style: "plain" },
          ]
        : [
            {
              text: "You will continue to have access to your subscribed modules until the end of your current billing period.",
              style: "plain",
            },
          ],
      [{ text: "You may reactivate the subscription anytime.", style: "plain" }],
    ];
    return {
      kind: "subscription_cancelled",
      layout: "page",
      hero: HERO_SUBSCRIPTION_CANCELLED,
      headline: { module: null, text: THANK_YOU },
      company,
      lines: [],
      money: null,
      paragraphs,
      footer,
    };
  }

  if (removed.length > 0) {
    // A removal and an addition in one change: the design's "Subscription updated" row.
    const lines: ResultLine[] = [
      ...removed.map((d) => ({ module: ref(d.card), text: lineFor(d.outcome, d.card) })),
      ...added.map((d) => ({ module: ref(d.card), text: `${d.card.name} is available now.` })),
    ];
    return {
      kind: "updated",
      layout: "row",
      hero: null,
      headline: { module: null, text: SUBSCRIPTION_UPDATED },
      company,
      lines,
      money: moneyLine(forecast(after, today)),
      paragraphs: [],
      footer,
    };
  }

  const lines: ResultLine[] =
    added.length > 0
      ? added.map((d) => ({ module: ref(d.card), text: lineFor(d.outcome, d.card) }))
      : // The API said yes but the page model reads the same: say what was asked, plainly.
        (asked.kind === "start_trial" ? [asked.code] : asked.codes)
          .map((code) => after.cards.find((c) => c.code === code))
          .filter((c): c is ModuleCard => c !== undefined)
          .map((c) => ({ module: ref(c), text: `${c.name} has been updated.` }));
  return celebrateRow(company, lines, after, today, footer);
}

/** The "Congratulations!" row - one place, so the two ways of reaching it cannot drift apart. */
function celebrateRow(
  company: string,
  lines: ResultLine[],
  after: ModulePage,
  today: Date,
  footer: RowFooterFacts,
): ChangeResult {
  return {
    kind: "celebrate",
    layout: "row",
    hero: null,
    headline: { module: null, text: CONGRATULATIONS },
    company,
    lines,
    money: moneyLine(forecast(after, today)),
    paragraphs: [],
    footer,
  };
}

/**
 * The same row for a trial that has just started, rebuilt from the page model ALONE (Figma
 * RV11). The module settings page starts a trial and then LEAVES for the list, so the list has
 * no "before" to diff - it is told which module by `?started=` and reads the rest off the
 * company. It refuses rather than guess: nothing unless that module is really trialing now, so
 * a stale link, or one naming a module the company does not have, congratulates nobody.
 */
export function startedTrialResult(
  entity: Pick<PortalEntity, "entity_name" | "created_at">,
  after: ModulePage | null,
  code: string,
  today: Date,
): ChangeResult | null {
  const card = after?.cards.find((c) => c.code === code);
  // `trialing` is still true for a trial since cancelled - `outcomeOf` would call that
  // "stopped", not "started" - and an unknown code simply finds no card.
  if (!after || !card || !trialing(card) || card.trial_cancelled) return null;
  return celebrateRow(
    entity.entity_name,
    [{ module: ref(card), text: lineFor("started", card) }],
    after,
    today,
    rowFooter(entity, after),
  );
}
