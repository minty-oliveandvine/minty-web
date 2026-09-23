/**
 * Section 07's answers, shaped as the API gives them: the payer's subscriber options (07-A
 * to pick from, 07-C with an offer waiting), the requests offered to a recipient (07-D), and
 * the recipient's own cards (07-E). Shared by the Vitest suites, the Playwright specs and the
 * dev-only `?fixture=` switches. Money in MINOR units, as the routes answer it.
 */

import type {
  IncomingTransfer,
  PayerPaymentMethods,
  SubscriberOptions,
} from "@/features/subscription/api/payerPortal";

import { TODAY } from "@/features/subscription/__fixtures__/modulePage";
import { WALLET } from "@/features/subscription/__fixtures__/modulePage";

function iso(days: number): string {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

const QUOTE = (days: number) => ({
  amount: 8800,
  currency: "HKD",
  covers_from: iso(21),
  covers_to: iso(21 + days),
  period_start: iso(21),
  period_end: iso(21 + days),
  anchor_at: iso(21 + days),
  anchor_is_new: false,
});

export const ENTITY_B = { entity_id: "e-company-b", entity_name: "Company B Limited" };

/** 07-A: the current payer first, three admins to choose from, each with its own quote. */
export const SUBSCRIBER_OPTIONS: SubscriberOptions = {
  entity: ENTITY_B,
  current: { id: "u-harry", name: "Harry Kim", email: "harry.kim@oliveandvine.com" },
  candidates: [
    { id: "u-harry", name: "Harry Kim", email: "harry.kim@oliveandvine.com", is_current: true },
    {
      id: "u-rebecca",
      name: "Rebecca Park",
      email: "rebecca.park@oliveandvine.com",
      is_current: false,
      quote: QUOTE(9),
      trials: [],
    },
    {
      id: "u-jiwon",
      name: "Jiwon Kim",
      email: "jiwon.kim@oliveandvine.com",
      is_current: false,
      quote: { ...QUOTE(16), anchor_is_new: true },
      trials: [
        {
          label: "Petty Cash",
          codes: ["PETTY_CASH"],
          trial_end: iso(3),
          amount: 28000,
          currency: "HKD",
          anchor_is_new: true,
        },
      ],
    },
    {
      id: "u-daniel",
      name: "Daniel Park",
      email: "daniel.park@oliveandvine.com",
      is_current: false,
      quote: QUOTE(4),
      trials: [],
    },
  ],
  blockers: [],
  pending_transfer: null,
};

/** 07-C: the same company with an offer already out to Jiwon Kim. */
export const SUBSCRIBER_OPTIONS_PENDING: SubscriberOptions = {
  ...SUBSCRIBER_OPTIONS,
  candidates: SUBSCRIBER_OPTIONS.candidates.map((c) => ({ ...c, quote: null, trials: [] })),
  pending_transfer: { id: "t-9", to_user_id: "u-jiwon", status: "pending", since: iso(-2) },
};

/** A company whose handover the API refuses, in its own words. */
export const SUBSCRIBER_OPTIONS_BLOCKED: SubscriberOptions = {
  ...SUBSCRIBER_OPTIONS,
  blockers: [
    "This company still has a module on its free trial. The handover can go ahead once it converts.",
  ],
};

/** 07-D: a request offered to the signed-in person, priced. */
export const INCOMING_REQUEST: IncomingTransfer = {
  id: "t-1",
  entity_id: "e-new-company",
  entity_name: "New Company Limited",
  settings_path: "/entity/settings/module/e-new-company",
  from_name: "Priya Chan",
  from_user_id: "u-priya",
  status: "pending",
  expires_at: iso(5),
  amount: 8800,
  currency: "HKD",
  quote: QUOTE(9),
  trials: [],
  blockers: [],
};

/** The same request with everything on trial: nothing to pay today. */
export const INCOMING_REQUEST_TRIAL: IncomingTransfer = {
  ...INCOMING_REQUEST,
  id: "t-2",
  amount: null,
  currency: null,
  quote: null,
  trials: [
    {
      label: "Petty Cash",
      codes: ["PETTY_CASH"],
      trial_end: iso(3),
      amount: 28000,
      currency: "HKD",
      anchor_is_new: true,
    },
  ],
};

/** The recipient's own cards (07-E): two, the Visa the default. */
export const RECIPIENT_CARDS: PayerPaymentMethods = {
  has_account: true,
  default_id: "pm_visa4121",
  total: 2,
  methods: [
    WALLET.methods[0],
    {
      ...WALLET.methods[0],
      id: "pm_master8842",
      brand: "mastercard",
      brand_label: "Mastercard",
      last4: "8842",
      label: "Mastercard •••• 8842",
      exp_month: 11,
      exp_year: 2027,
      expiry: "11/27",
      is_default: false,
    },
  ],
};

export type TransferFixture = "A" | "C" | "BLOCKED";
export const TRANSFER_FIXTURES: Record<TransferFixture, SubscriberOptions> = {
  A: SUBSCRIBER_OPTIONS,
  C: SUBSCRIBER_OPTIONS_PENDING,
  BLOCKED: SUBSCRIBER_OPTIONS_BLOCKED,
};
export function isTransferFixture(value: string | null | undefined): value is TransferFixture {
  return value === "A" || value === "C" || value === "BLOCKED";
}

export type RequestsFixture = "D" | "TRIAL" | "F";
export const REQUESTS_FIXTURES: Record<RequestsFixture, IncomingTransfer[]> = {
  D: [INCOMING_REQUEST],
  TRIAL: [INCOMING_REQUEST_TRIAL],
  F: [],
};
export function isRequestsFixture(value: string | null | undefined): value is RequestsFixture {
  return value === "D" || value === "TRIAL" || value === "F";
}
