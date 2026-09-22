/**
 * What a module card SHOWS, derived from what the API SAYS about it.
 *
 * The Figma page (file 43YI3MYtTfX5Xzz6dRoRuT, section "03 · Settings › Module") draws six
 * states of the page; each card is in one of six states and carries one call to action. This
 * module is the one place that reads Flask's card flags (`api/moduleSettings.ts`, `ModuleCard`)
 * and turns them into that vocabulary, so the components render a `ModuleView` and never a
 * card. Pure: takes `today` so the tests are deterministic.
 *
 * Precedence, first match wins (the order matters where flags overlap - a past-due module can
 * also carry `pending_cancel`; a cancelled trial is still `trialing`):
 *
 *   past_due        "Subscription Suspended"             Reactivate Subscription (outline)
 *   pending_cancel  "Cancellation pending / Ends in N"   Resume Subscription     (filled)
 *   trialing        "Trial / N days remaining" (red, 7 days or fewer)
 *                   "Trial Active / N days remaining" (black, more)
 *                                                        Manage Subscription     (filled)
 *   active          "Currently Active"                   Manage Subscription →   (link)
 *   trial_eligible  "Get Started / 30 days trial…"       Start Free Trial        (outline)
 *   expired         "Trial Expired"                      Activate Subscription   (outline)
 *
 * A trial that is closing (`trial_closing`) is still a trial here: it is the access gate that
 * ends a trial, never the date (Minty's `subscription-restart-screen` note).
 */

import type { ModuleCard, ModuleCode } from "@/features/subscription/api/moduleSettings";

export type ModuleState =
  "past_due" | "pending_cancel" | "trialing" | "active" | "trial_eligible" | "expired";

/** What the CTA does; the hook maps each to a handler, the component to a label and a look. */
export type ModuleCtaKind = "reactivate" | "resume" | "manage" | "start_trial" | "activate";

export type ModuleCtaVariant = "filled" | "outline" | "link";

export type ModuleCta = { kind: ModuleCtaKind; label: string; variant: ModuleCtaVariant };

export type ModuleStatusLine = {
  /** The small first line ("Trial", "Cancellation pending", "Get Started"); absent for one-liners. */
  eyebrow?: string;
  /** The line that carries the state ("3 days remaining", "Currently Active"). */
  text: string;
  /** Which colour the design gives the text line (`plain` is black). */
  tone: "accent" | "teal" | "muted" | "info" | "plain";
};

export type ModuleView = {
  code: ModuleCode;
  name: string;
  description: string;
  state: ModuleState;
  /** The card's look: live (teal) or inactive (grey, illustration dimmed). */
  live: boolean;
  status: ModuleStatusLine;
  /** Days until the period or access ends, where the state names one; else null. */
  daysRemaining: number | null;
  cta: ModuleCta;
};

const CTA: Record<ModuleState, ModuleCta> = {
  past_due: { kind: "reactivate", label: "Reactivate Subscription", variant: "outline" },
  pending_cancel: { kind: "resume", label: "Resume Subscription", variant: "filled" },
  trialing: { kind: "manage", label: "Manage Subscription", variant: "filled" },
  active: { kind: "manage", label: "Manage Subscription", variant: "link" },
  trial_eligible: { kind: "start_trial", label: "Start Free Trial", variant: "outline" },
  expired: { kind: "activate", label: "Activate Subscription", variant: "outline" },
};

/** Free trials are thirty days (`billing_policy.TRIAL_DAYS`); the eligible card says so. */
export const TRIAL_DAYS = 30;

/**
 * A trial with this many days or fewer left is drawn as urgent (frame 03-B: "Trial" over a
 * red count); with more it is "Trial Active" over a black count.
 */
export const TRIAL_URGENT_DAYS = 7;

/** `YYYY-MM-DD` of an ISO date or datetime, or null when it does not start with one. */
function isoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function utcMidnight(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Whole days from `today` to the day part of `until`, floored at zero. Both sides are read as
 * calendar days (the API's dates are the business day already), never as instants - a
 * `Date` difference would drift by one across the HKT/UTC boundary.
 */
export function daysUntil(until: string | null | undefined, today: Date): number | null {
  const end = isoDay(until);
  if (!end) return null;
  const start = utcMidnight(today.toISOString().slice(0, 10));
  return Math.max(0, Math.round((utcMidnight(end) - start) / 86_400_000));
}

/** "1 day" / "N days". */
export function daysPhrase(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

export function daysLabel(days: number): string {
  return `${daysPhrase(days)} remaining`;
}

export function moduleState(card: ModuleCard): ModuleState {
  if (card.subscription_status === "past_due") return "past_due";
  if (card.pending_cancel || card.cancel_at_period_end || card.trial_cancelled) {
    return "pending_cancel";
  }
  if (card.subscription_status === "trialing") return "trialing";
  if (card.subscription_status === "active") return "active";
  if (card.trial_eligible) return "trial_eligible";
  return "expired";
}

export function resolveModuleState(card: ModuleCard, today: Date): ModuleView {
  const state = moduleState(card);
  let daysRemaining: number | null = null;
  let status: ModuleStatusLine;

  switch (state) {
    case "past_due":
      status = { text: "Subscription Suspended", tone: "muted" };
      break;
    case "pending_cancel":
      daysRemaining = daysUntil(card.access_end_date ?? card.period_end, today);
      status = {
        eyebrow: "Cancellation pending",
        text: daysRemaining === null ? "Ending soon" : `Ends in ${daysPhrase(daysRemaining)}`,
        tone: "accent",
      };
      break;
    case "trialing":
      daysRemaining = daysUntil(card.period_end, today);
      status =
        daysRemaining === null || daysRemaining <= TRIAL_URGENT_DAYS
          ? {
              eyebrow: "Trial",
              text: daysRemaining === null ? "Active" : daysLabel(daysRemaining),
              tone: "accent",
            }
          : { eyebrow: "Trial Active", text: daysLabel(daysRemaining), tone: "plain" };
      break;
    case "active":
      status = { text: "Currently Active", tone: "teal" };
      break;
    case "trial_eligible":
      status = { eyebrow: "Get Started", text: `${TRIAL_DAYS} days trial available`, tone: "info" };
      break;
    case "expired":
      status = { text: "Trial Expired", tone: "muted" };
      break;
  }

  return {
    code: card.code,
    name: card.name,
    description: card.description,
    state,
    live: state === "pending_cancel" || state === "trialing" || state === "active",
    status,
    daysRemaining,
    cta: CTA[state],
  };
}

/**
 * Frames 03-B and 03-C: when every card carries the SAME manage CTA, the page draws it once,
 * centred between the cards, instead of once per card. Returns that shared CTA, or null when
 * the cards keep their own.
 */
export function sharedCta(views: ModuleView[]): ModuleCta | null {
  if (views.length < 2) return null;
  const [first, ...rest] = views;
  if (first.cta.kind !== "manage") return null;
  return rest.every((v) => v.cta.kind === "manage" && v.cta.variant === first.cta.variant)
    ? first.cta
    : null;
}

/** The page banner (frame 03-F) shows when any module is suspended. */
export function paymentFailed(views: ModuleView[]): boolean {
  return views.some((v) => v.state === "past_due");
}

/**
 * Where the page draws each card's CTA. Frame 03-A (node 1410:2611) was redesigned on
 * 2026-09-22 with the CTA INSIDE the card, as a 248x66 rounded button; the other frames still
 * draw it under the card (or once, centred, for the shared CTA) until they are redesigned. The
 * cards themselves are the same size in every frame - only the CTA moves.
 */
export type PageLook = "inline" | "stacked";

/**
 * `inline` for frame 03-A only: every card is in trial or eligible for one, and both states
 * occur (a page of two trials is 03-B, a page of two eligible cards has no frame).
 */
export function pageLook(views: ModuleView[]): PageLook {
  const states = new Set(views.map((v) => v.state));
  const onlyThese = [...states].every((s) => s === "trialing" || s === "trial_eligible");
  return onlyThese && states.size === 2 ? "inline" : "stacked";
}
