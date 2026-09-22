/**
 * The page model in each of the six states the Figma design draws (file 43YI3MYtTfX5Xzz6dRoRuT,
 * section "03 · Settings › Module", frames 03-A … 03-F), shaped exactly as
 * `GET /api/entities/{id}/modules` answers. Shared by the Vitest suites, the Playwright specs
 * (served through `page.route`) and the dev-only `?fixture=` switch of `useModulePage`.
 *
 * Dates are relative to `TODAY` so "3 days remaining" is 3 in every run, in every timezone -
 * and TODAY is the real calendar day, not a pinned one: the Vitest suites hand `today: TODAY`
 * to the screens, but a Playwright spec serves these fixtures through `page.route` to a page that
 * counts from the browser's own clock, so a pinned day drifted by one every midnight (the
 * "3 days remaining" written on 2026-09-21 read "2" on the 22nd).
 */

import type {
  ModuleCard,
  ModulePage,
  ModulePanel,
  ModuleSummary,
} from "@/features/subscription/api/moduleSettings";
import type { EntityPaymentMethod } from "@/features/subscription/api/payerPortal";
import type { ChangeAsked } from "@/features/subscription/lib/changeResult";

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3));
}

export const TODAY = startOfToday();

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
      ? "Track sales, expenses,\ncash counts and daily closing."
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
    // The real catalogue's money (Figma 05·A prices from it): HK$280 a module, HK$400 the bundle.
    amount: "280",
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

/** A confirmed trial (the N-frames): a card and this company's consent are in place. */
function confirmedTrial(code: ModuleCard["code"], daysLeft: number): ModuleCard {
  return { ...trialing(code, daysLeft), needs_card: false };
}

/** `get_subscription_summary`'s money, as the API answers it for the HKD catalogue. */
export const SUMMARY: ModuleSummary = {
  currency: "HK$",
  currency_code: "HKD",
  bundle_amount: "400",
  bundle_amount_formatted: "400.00",
  bundle_codes: ["PAYMENT_REQUEST", "PETTY_CASH"],
  bundle_name: "Super Minty",
};

/** The panel's two footer facts: the next renewal (21 days out, as `active()` cards end). */
function panelFor(cards: ModuleCard[]): ModulePanel {
  const billed = cards.some((c) => c.subscription_status === "active" && !c.pending_cancel);
  const next = daysFromToday(21).slice(0, 10);
  const [y, m, d] = next.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return {
    next_invoice: billed
      ? { date, amount: "HK$280", overdue: false, includes_extension: false }
      : null,
    total: billed ? "HK$280" : "HK$0",
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
    summary: SUMMARY,
    panel: panelFor(cards),
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

// ---- 05·A - the open row ("Subscription Summary") ---------------------------------------------

export type SummaryFrame = "M11" | "M21" | "M22" | "M31" | "M44" | "M45" | "M51" | "M61" | "N21a";

/**
 * The 05·A states the tests render, keyed by the design's frame (down = Petty Cash, across =
 * Payment Request; N = a trial confirmed). Each is the company's page model as the API answers
 * it, so the same fixture feeds the module page and the open row.
 */
export const SUMMARY_FIXTURES: Record<SummaryFrame, ModulePage> = {
  /** Nothing started: two Start Free Trial buttons, "No module selected", HK$0. */
  M11: page([neverStarted("PETTY_CASH"), neverStarted("PAYMENT_REQUEST")]),
  /** Petty Cash on trial (unconfirmed), Payment Request never started. */
  M21: page([trialing("PETTY_CASH", 3), neverStarted("PAYMENT_REQUEST")]),
  /** Both on trial. */
  M22: page([trialing("PETTY_CASH", 3), trialing("PAYMENT_REQUEST", 15)]),
  /** Petty Cash's trial expired, Payment Request never started. */
  M31: page([trialExpired("PETTY_CASH"), neverStarted("PAYMENT_REQUEST")]),
  /** Both active: the bundle, both ticked. */
  M44: page([active("PETTY_CASH"), active("PAYMENT_REQUEST")]),
  /** Petty Cash active, Payment Request cancelling: current vs future. */
  M45: page([active("PETTY_CASH"), cancelling("PAYMENT_REQUEST", 15)]),
  /** Petty Cash cancelling, Payment Request never started: the future is empty. */
  M51: page([cancelling("PETTY_CASH", 15), neverStarted("PAYMENT_REQUEST")]),
  /** Petty Cash suspended (a payment failed), Payment Request never started. */
  M61: page([suspended("PETTY_CASH"), neverStarted("PAYMENT_REQUEST")]),
  /** Petty Cash's trial confirmed: ticked, HK$0 now, HK$280 from the day after it ends. */
  N21a: page([confirmedTrial("PETTY_CASH", 3), neverStarted("PAYMENT_REQUEST")]),
};

/**
 * The result screens (Figma 05·C), keyed by the design's generated frame (R + the 05·B frame
 * whose confirm they follow): the page model before, what was asked, and the page model the API
 * answers after. `buildChangeResult` turns each into the screen.
 */
export type ResultFrame =
  | "RU22"
  | "RU23"
  | "RU24"
  | "RV14"
  | "RV44"
  | "RV45"
  | "RW45"
  | "RV41"
  | "RV51"
  | "RV61"
  | "RNX21a";

export const RESULT_FIXTURES: Record<
  ResultFrame,
  { before: ModulePage; asked: ChangeAsked; after: ModulePage }
> = {
  /** Both trials confirmed: nothing charged today, the bundle when they end. */
  RU22: {
    before: SUMMARY_FIXTURES.M22,
    asked: { kind: "ticks", codes: ["PETTY_CASH", "PAYMENT_REQUEST"] },
    after: page([confirmedTrial("PETTY_CASH", 3), confirmedTrial("PAYMENT_REQUEST", 15)]),
  },
  /**
   * A trial confirmed (a card on file, consent still to give) and an expired trial bought back:
   * HK$280 now, the bundle when the trial ends.
   */
  RU23: {
    before: page([
      { ...trialing("PETTY_CASH", 3), needs_consent_only: true },
      trialExpired("PAYMENT_REQUEST"),
    ]),
    asked: { kind: "ticks", codes: ["PETTY_CASH", "PAYMENT_REQUEST"] },
    after: page([confirmedTrial("PETTY_CASH", 3), active("PAYMENT_REQUEST")]),
  },
  /** A trial confirmed while the other module is removed: "Subscription updated". */
  RU24: {
    before: page([trialing("PETTY_CASH", 3), active("PAYMENT_REQUEST")]),
    asked: { kind: "ticks", codes: ["PETTY_CASH", "PAYMENT_REQUEST"] },
    after: page([confirmedTrial("PETTY_CASH", 3), cancelling("PAYMENT_REQUEST", 21)]),
  },
  /** Start Free Trial on Petty Cash while Payment Request is active. */
  RV14: {
    before: page([neverStarted("PETTY_CASH"), active("PAYMENT_REQUEST")]),
    asked: { kind: "start_trial", code: "PETTY_CASH" },
    after: page([trialing("PETTY_CASH", 30), active("PAYMENT_REQUEST")]),
  },
  /** Petty Cash removed while Payment Request keeps running: the module cancellation page. */
  RV44: {
    before: SUMMARY_FIXTURES.M44,
    asked: { kind: "ticks", codes: ["PETTY_CASH"] },
    after: page([cancelling("PETTY_CASH", 21), active("PAYMENT_REQUEST")]),
  },
  /** Petty Cash removed while Payment Request winds down: still the module cancellation page. */
  RV45: {
    before: SUMMARY_FIXTURES.M45,
    asked: { kind: "ticks", codes: ["PETTY_CASH"] },
    after: page([cancelling("PETTY_CASH", 21), cancelling("PAYMENT_REQUEST", 15)]),
  },
  /** Payment Request's cancellation resumed beside an active Petty Cash: the bundle again. */
  RW45: {
    before: SUMMARY_FIXTURES.M45,
    asked: { kind: "ticks", codes: ["PAYMENT_REQUEST"] },
    after: SUMMARY_FIXTURES.M44,
  },
  /** The only paid module removed: the subscription cancellation page. */
  RV41: {
    before: page([active("PETTY_CASH"), neverStarted("PAYMENT_REQUEST")]),
    asked: { kind: "ticks", codes: ["PETTY_CASH"] },
    after: page([cancelling("PETTY_CASH", 21), neverStarted("PAYMENT_REQUEST")]),
  },
  /** A cancellation resumed: restored, billing carries on. */
  RV51: {
    before: SUMMARY_FIXTURES.M51,
    asked: { kind: "ticks", codes: ["PETTY_CASH"] },
    after: page([active("PETTY_CASH"), neverStarted("PAYMENT_REQUEST")]),
  },
  /** A suspension reactivated - the outstanding invoice paid: restored. */
  RV61: {
    before: SUMMARY_FIXTURES.M61,
    asked: { kind: "ticks", codes: ["PETTY_CASH"] },
    after: page([active("PETTY_CASH"), neverStarted("PAYMENT_REQUEST")]),
  },
  /** A confirmed trial unticked (NX): the trial stops converting; nothing else bills. */
  RNX21a: {
    before: SUMMARY_FIXTURES.N21a,
    asked: { kind: "ticks", codes: ["PETTY_CASH"] },
    after: page([
      { ...confirmedTrial("PETTY_CASH", 3), trial_cancelled: true },
      neverStarted("PAYMENT_REQUEST"),
    ]),
  },
};

export function isResultFrame(value: string | null | undefined): value is ResultFrame {
  return value !== null && value !== undefined && value in RESULT_FIXTURES;
}

/** The company's nominated card, as `/api/me/billing/entity-payment-method` answers. */
export const WALLET: EntityPaymentMethod = {
  entity_id: ENTITY_ID,
  has_account: true,
  default_id: "pm_visa4121",
  nominated_id: "pm_visa4121",
  total: 1,
  methods: [
    {
      id: "pm_visa4121",
      type: "card",
      brand: "visa",
      brand_label: "Visa",
      last4: "4121",
      label: "Visa •••• 4121",
      cardholder: "Olive Vine",
      email: null,
      address: {
        line1: null,
        line2: null,
        city: null,
        state: null,
        postal_code: null,
        country: null,
      },
      exp_month: 4,
      exp_year: 2029,
      expiry: "04/29",
      funding: "credit",
      wallet: null,
      wallet_label: null,
      country: "HK",
      country_name: "Hong Kong",
      is_default: true,
      expired: false,
      expires_soon: false,
      added: "1 Aug 2026",
      added_iso: "2026-08-01T00:00:00+00:00",
    },
  ],
};

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
