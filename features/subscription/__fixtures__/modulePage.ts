/**
 * The page model in each of the six states the Figma design draws (file 43YI3MYtTfX5Xzz6dRoRuT,
 * section "03 · Settings › Module", frames 03-A … 03-F), shaped exactly as
 * `GET /api/entities/{id}/modules` answers. Shared by the Vitest suites, the Playwright specs
 * (served through `page.route`) and the dev-only `?fixture=` switch of `useModulePage`.
 *
 * Dates are relative to `TODAY` so "3 days remaining" is 3 in every run, in every timezone.
 */

import type { ModuleCard, ModulePage } from "@/features/subscription/api/moduleSettings";

export const TODAY = new Date("2026-09-21T03:00:00.000Z");

export const ENTITY_ID = "7d2c1b6e-4a8f-4f3b-9c1d-2e5f6a7b8c9d";

function daysFromToday(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** A card with nothing going on - the base every state is written over. */
function blank(code: ModuleCard["code"]): ModuleCard {
  const petty = code === "PETTY_CASH";
  return {
    code,
    name: petty ? "Petty Cash" : "Payment Request",
    description: petty
      ? "Track sales, expenses, cash counts and daily closing."
      : "Track supplier invoices, approvals and payments",
    learn_more: null,
    is_subscribed: false,
    trial_eligible: false,
    trial_closing: false,
    trial_expired: false,
    lapsed_long: false,
    has_access: false,
    subscription_status: null,
    can_cancel: false,
    formatted_amount: petty ? "HK$68.00" : "HK$88.00",
    currency_code: "HKD",
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
}

function trialing(code: ModuleCard["code"], daysLeft: number): ModuleCard {
  const end = daysFromToday(daysLeft);
  return {
    ...blank(code),
    is_subscribed: true,
    has_access: true,
    subscription_status: "trialing",
    can_cancel: true,
    period_end: end,
    period_end_short: end.slice(0, 10),
    period_end_long: longDate(end),
    formatted_period_end: longDate(end),
    needs_card: true,
  };
}

function neverStarted(code: ModuleCard["code"]): ModuleCard {
  return { ...blank(code), trial_eligible: true };
}

function active(code: ModuleCard["code"]): ModuleCard {
  const end = daysFromToday(21);
  return {
    ...blank(code),
    is_subscribed: true,
    has_access: true,
    subscription_status: "active",
    can_cancel: true,
    period_end: end,
    period_end_short: end.slice(0, 10),
    period_end_long: longDate(end),
    formatted_period_end: longDate(end),
  };
}

function trialExpired(code: ModuleCard["code"]): ModuleCard {
  const end = daysFromToday(-4);
  return {
    ...blank(code),
    trial_expired: true,
    access_end_date: end.slice(0, 10),
    access_end_long: longDate(end),
  };
}

function cancelling(code: ModuleCard["code"], daysLeft: number): ModuleCard {
  const end = daysFromToday(daysLeft);
  return {
    ...active(code),
    cancel_at_period_end: true,
    pending_cancel: true,
    can_cancel: false,
    period_end: end,
    period_end_short: end.slice(0, 10),
    period_end_long: longDate(end),
    formatted_period_end: longDate(end),
    access_end_date: end.slice(0, 10),
    access_end_long: longDate(end),
  };
}

function suspended(code: ModuleCard["code"]): ModuleCard {
  const end = daysFromToday(9);
  return {
    ...blank(code),
    is_subscribed: true,
    has_access: true,
    subscription_status: "past_due",
    can_cancel: true,
    access_end_date: end.slice(0, 10),
    access_end_long: longDate(end),
  };
}

function page(cards: ModuleCard[], extra: Partial<ModulePage> = {}): ModulePage {
  return {
    entity_id: ENTITY_ID,
    cards,
    can_manage_modules: true,
    payer: null,
    viewer: { name: "Olive Vine", initials: "OV" },
    next_payment_date: null,
    ...extra,
  };
}

export type FixtureFrame = "A" | "B" | "C" | "D" | "E" | "F";

/** 03-A … 03-F, keyed by the frame's letter. */
export const FIXTURES: Record<FixtureFrame, ModulePage> = {
  /** One in trial, one never started. */
  A: page([trialing("PETTY_CASH", 3), neverStarted("PAYMENT_REQUEST")]),
  /** Both in trial, different end dates. */
  B: page([trialing("PETTY_CASH", 3), trialing("PAYMENT_REQUEST", 15)]),
  /** Both currently active. */
  C: page([active("PETTY_CASH"), active("PAYMENT_REQUEST")]),
  /** Trial expired on one module. */
  D: page([trialExpired("PETTY_CASH"), active("PAYMENT_REQUEST")]),
  /** Cancellation pending on one module. */
  E: page([cancelling("PETTY_CASH", 15), active("PAYMENT_REQUEST")]),
  /** Both modules suspended - a payment failed. */
  F: page([suspended("PETTY_CASH"), suspended("PAYMENT_REQUEST")]),
};

/** 03-A seen by an admin who is not the payer: no buttons, the payer named. */
export const NON_MANAGER: ModulePage = page(FIXTURES.A.cards, {
  can_manage_modules: false,
  payer: { user_id: "u-payer", name: "Priya Chan", email: "priya@example.com" },
});

/** 03-A seen by someone who is neither admin nor payer, on a company with no payer yet. */
export const NOT_ADMIN: ModulePage = page(FIXTURES.A.cards, { can_manage_modules: false });

export function isFixtureFrame(value: string | null | undefined): value is FixtureFrame {
  return (
    value === "A" ||
    value === "B" ||
    value === "C" ||
    value === "D" ||
    value === "E" ||
    value === "F"
  );
}
