/**
 * Section 08's answers, shaped as the API gives them: the saved cards in each state the design
 * draws (08-B two cards, 08-H none, 08-I the default expired, 08-J eight of them) and the
 * invoices already paid (08-B's table). Shared by the Vitest suites, the Playwright specs and
 * the dev-only `?fixture=` switches. The money is pre-formatted, as `/api/me/invoices` answers.
 */

import type {
  InvoiceRow,
  PayerPaymentMethods,
  SavedPaymentMethod,
} from "@/features/subscription/api/payerPortal";
import { TODAY, WALLET } from "@/features/subscription/__fixtures__/modulePage";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function inDays(days: number): { iso: string; text: string } {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + days);
  const text = `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return { iso: d.toISOString(), text };
}

/** One saved card, on the shape `/api/me/billing/payment-methods` answers with. */
export function card(
  id: string,
  brand: string,
  last4: string,
  expMonth: number,
  expYear: number,
  extra: Partial<SavedPaymentMethod> = {},
): SavedPaymentMethod {
  const label = `${brand} •••• ${last4}`;
  return {
    ...WALLET.methods[0],
    id,
    brand: brand.toLowerCase(),
    brand_label: brand,
    last4,
    label,
    exp_month: expMonth,
    exp_year: expYear,
    expiry: `${String(expMonth).padStart(2, "0")}/${String(expYear).slice(-2)}`,
    is_default: false,
    expired: false,
    expires_soon: false,
    ...extra,
  };
}

const VISA_4121 = card("pm_visa4121", "Visa", "4121", 9, 2026, {
  is_default: true,
  cardholder: "Rebecca Park",
});
const MASTER_4651 = card("pm_master4651", "Mastercard", "4651", 3, 2027);

/** 08-B: the default card and one other - what the page shows before "Show more". */
export const WALLET_TWO: PayerPaymentMethods = {
  has_account: true,
  default_id: "pm_visa4121",
  total: 2,
  methods: [VISA_4121, MASTER_4651],
};

/** 08-H: a billing account with no card on it at all. */
export const WALLET_NONE: PayerPaymentMethods = {
  has_account: true,
  default_id: null,
  total: 0,
  methods: [],
};

/** 08-I: the card being charged has already expired. */
export const WALLET_EXPIRED: PayerPaymentMethods = {
  has_account: true,
  default_id: "pm_visa4121",
  total: 2,
  methods: [
    { ...VISA_4121, exp_month: 8, exp_year: 2026, expiry: "08/26", expired: true },
    MASTER_4651,
  ],
};

/** 08-J: all eight saved cards, the default pinned first and one of them expired. */
export const WALLET_MANY: PayerPaymentMethods = {
  has_account: true,
  default_id: "pm_visa4121",
  total: 8,
  methods: [
    VISA_4121,
    MASTER_4651,
    card("pm_visa3184", "Visa", "3184", 12, 2029),
    card("pm_union0005", "UnionPay", "0005", 2, 2034),
    card("pm_amex1007", "Amex", "1007", 7, 2028),
    card("pm_visa0341", "Visa", "0341", 5, 2026, { expired: true }),
    card("pm_visa6720", "Visa", "6720", 9, 2028),
    card("pm_union4410", "UnionPay", "4410", 1, 2030),
  ],
};

/** 08-N / 08-S: the card that comes back from the Stripe form, not yet the default. */
export const ADDED_CARD = card("pm_master8842", "Mastercard", "8842", 11, 2027);

export const WALLET_ADDED: PayerPaymentMethods = {
  has_account: true,
  default_id: "pm_visa4121",
  total: 3,
  methods: [VISA_4121, MASTER_4651, ADDED_CARD],
};

/** 08-B's invoice history, newest first. */
export const INVOICES: InvoiceRow[] = [
  {
    id: "in_1",
    reference: "#11241234113",
    date: inDays(-59).text,
    date_iso: inDays(-59).iso,
    period_start: inDays(-89).text,
    period_end: inDays(-59).text,
    description: "Renewal · Super Minty",
    description_detail: "Petty Cash + Payment Request",
    memo: null,
    amount: "HK$19,383",
    amount_minor: 1938300,
    currency: "HKD",
    status: "paid",
    status_label: "Paid",
    payment_method: "Visa •••• 4121",
    hosted_invoice_url: "https://invoice.stripe.test/in_1",
    entities: ["Company A Limited"],
  },
  {
    id: "in_2",
    reference: "#1134125533",
    date: inDays(-89).text,
    date_iso: inDays(-89).iso,
    period_start: inDays(-119).text,
    period_end: inDays(-89).text,
    description: "Renewal · Super Minty",
    description_detail: "Petty Cash + Payment Request",
    memo: null,
    amount: "HK$15,311",
    amount_minor: 1531100,
    currency: "HKD",
    status: "paid",
    status_label: "Paid",
    payment_method: "Visa •••• 4121",
    hosted_invoice_url: "https://invoice.stripe.test/in_2",
    entities: ["Company A Limited"],
  },
  {
    id: "in_3",
    reference: "#13512512311",
    date: inDays(-120).text,
    date_iso: inDays(-120).iso,
    period_start: inDays(-150).text,
    period_end: inDays(-120).text,
    description: "Renewal · Super Minty",
    description_detail: "Petty Cash + Payment Request",
    memo: null,
    amount: "HK$15,311",
    amount_minor: 1531100,
    currency: "HKD",
    status: "paid",
    status_label: "Paid",
    payment_method: "Visa •••• 4121",
    hosted_invoice_url: null,
    entities: ["Company A Limited"],
  },
];

export function invoicePage(rows: InvoiceRow[] = INVOICES) {
  return {
    invoices: rows,
    entity_options: [{ id: "e-company-a", name: "Company A Limited" }],
    entity_id: null,
    total: rows.length,
    page: 1,
    pages: 1,
    per_page: 20,
  };
}

/** The dev-only `?fixture=` switches on the billing page: one per frame of the design. */
export const BILLING_FIXTURES = {
  B: WALLET_TWO,
  H: WALLET_NONE,
  I: WALLET_EXPIRED,
  J: WALLET_MANY,
  N: WALLET_ADDED,
} as const;

export type BillingFixture = keyof typeof BILLING_FIXTURES;

export function isBillingFixture(value: string | null): value is BillingFixture {
  return value !== null && value in BILLING_FIXTURES;
}
