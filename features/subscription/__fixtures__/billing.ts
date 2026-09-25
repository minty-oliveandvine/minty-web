/**
 * Section 08's answers, shaped as the API gives them: the saved cards in each state the design
 * draws (08-B two cards, 08-H none, 08-I the default expired, 08-J eight of them), the billing
 * accounts they sit on (`/api/me/billing/accounts`), an account being opened in the sheet (the
 * confirm's answer, and the accounts after it), and the invoices already paid (08-B's table).
 * Shared by the Vitest suites, the Playwright specs and the dev-only `?fixture=` switches. The
 * money is pre-formatted, as `/api/me/invoices` answers.
 */

import type {
  BillingAccount,
  BillingAccounts,
  ConfirmedCard,
  InvoiceBreakdown,
  InvoiceRow,
  PayerPaymentMethods,
  SavedPaymentMethod,
} from "@/features/subscription/api/payerPortal";
import { TODAY, WALLET } from "@/features/subscription/__fixtures__/modulePage";
import { PAYER } from "@/features/subscription/__fixtures__/subscriptions";

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

/**
 * The breakdown of invoice #11241234113 - the user's sample file, row for row: two renewals
 * over the whole period, and a Petty Cash extension for the days of access after cancelling
 * (26 Jul to 5 Aug, 10 of 31 days of 280: 90.32).
 */
export const BREAKDOWN: InvoiceBreakdown = {
  invoice: {
    id: "in_1",
    reference: "#11241234113",
    currency: "HKD",
    period_start: "2026-07-26T12:00:00+00:00",
    period_end: "2026-08-26T12:00:00+00:00",
    total_minor: 77032,
  },
  rows: [
    {
      entity_id: "e-nexora-health-limited",
      entity_name: "Nexora Health Limited",
      subscription: "Super Minty",
      kind: "full",
      monthly_minor: 40000,
      period_start: "2026-07-26T12:00:00+00:00",
      period_end: "2026-08-26T12:00:00+00:00",
      charged_minor: 40000,
    },
    {
      entity_id: "e-aetheria-capital-limited",
      entity_name: "Aetheria Capital Limited",
      subscription: "Payment Request",
      kind: "full",
      monthly_minor: 28000,
      period_start: "2026-07-26T12:00:00+00:00",
      period_end: "2026-08-26T12:00:00+00:00",
      charged_minor: 28000,
    },
    {
      entity_id: "e-company-e-limited",
      entity_name: "Company E Limited",
      subscription: "Petty Cash",
      kind: "extension",
      monthly_minor: 28000,
      period_start: "2026-07-26T12:00:00+00:00",
      period_end: "2026-08-05T12:00:00+00:00",
      charged_minor: 9032,
    },
  ],
};

export function invoicePage(
  rows: InvoiceRow[] = INVOICES,
  paging: { total?: number; page?: number; pages?: number; per_page?: number } = {},
) {
  return {
    invoices: rows,
    entity_options: [{ id: "e-company-a", name: "Company A Limited" }],
    entity_id: null,
    total: paging.total ?? rows.length,
    page: paging.page ?? 1,
    pages: paging.pages ?? 1,
    per_page: paging.per_page ?? 20,
  };
}

// --- Billing accounts -----------------------------------------------------------------

const AMEX_1007 = card("pm_amex1007", "Amex", "1007", 7, 2028);
const UNION_0005 = card("pm_union0005", "UnionPay", "0005", 2, 2034);

const company = (id: string, name: string, pastDue = false) => ({
  entity_id: id,
  entity_name: name,
  past_due: pastDue,
});

/**
 * Three accounts on the list fixture's companies (`subscriptions.ts`), oldest first:
 *
 * - Company A Limited - 08-B's own: Visa 4121 charged, Mastercard 4651 a spare, the Figma
 *   address, and one company whose payment failed (so the block is 08-K's amber);
 * - Vine Consulting Limited - 08-C's example company, on an Amex, nothing owed;
 * - an account nobody ever named (every account opened before names existed): it reads as the
 *   payer, and its collection is failing.
 */
const COMPANY_A: BillingAccount = {
  id: "acc-company-a",
  name: "Company A Limited",
  billing_company: "Company A Limited",
  billing_email: "billing@companyalimited.com",
  default_id: VISA_4121.id,
  card: VISA_4121,
  cards: [VISA_4121, { ...MASTER_4651, is_default: false }],
  total: 2,
  address: {
    line1: "Unit 10, 1/F, ABC Building",
    line2: "2 ABC Street",
    city: "Quarry Bay",
    state: null,
    postal_code: null,
    country: "HK",
    country_name: "Hong Kong",
  },
  companies: [
    company("e-nexora-health-limited", "Nexora Health Limited"),
    company("e-solera-group-limited", "Solera Group Limited"),
    company("e-willow-court-limited", "Willow Court Limited", true),
  ],
  in_dunning: false,
  past_due: true,
  next_bill: { amount: "HK$960.00", amount_minor: 96000, currency: "HKD" },
};

const VINE: BillingAccount = {
  id: "acc-vine",
  name: "Vine Consulting Limited",
  billing_company: "Vine Consulting Limited",
  billing_email: "accounts@vineconsulting.test",
  default_id: AMEX_1007.id,
  card: { ...AMEX_1007, is_default: true },
  cards: [{ ...AMEX_1007, is_default: true }],
  total: 1,
  address: {
    line1: "18/F, Harbour Tower",
    line2: "8 Harbour Road",
    city: "Wan Chai",
    state: "Hong Kong Island",
    postal_code: null,
    country: "HK",
    country_name: "Hong Kong",
  },
  companies: [
    company("e-aetheria-capital-limited", "Aetheria Capital Limited"),
    company("e-lantern-bay-limited", "Lantern Bay Limited"),
  ],
  in_dunning: false,
  past_due: false,
  next_bill: { amount: "HK$680.00", amount_minor: 68000, currency: "HKD" },
};

const UNNAMED: BillingAccount = {
  id: "acc-legacy",
  name: PAYER.name,
  billing_company: null,
  billing_email: null,
  default_id: UNION_0005.id,
  card: { ...UNION_0005, is_default: true },
  cards: [{ ...UNION_0005, is_default: true }],
  total: 1,
  address: null,
  companies: [company("e-halcyon-labs-limited", "Halcyon Labs Limited", true)],
  in_dunning: true,
  past_due: true,
  next_bill: { amount: "HK$280.00", amount_minor: 28000, currency: "HKD" },
};

const COUNTRIES = [
  { code: "HK", name: "Hong Kong" },
  { code: "PH", name: "Philippines" },
  { code: "SG", name: "Singapore" },
];

/** `/api/me/billing/accounts` for the payer of the list fixture. */
export const ACCOUNTS: BillingAccounts = {
  has_account: true,
  payer: PAYER,
  next_billing: "28 Sep 2026",
  next_billing_iso: inDays(7).iso,
  accounts: [COMPANY_A, VINE, UNNAMED],
  total: 3,
  methods: [VISA_4121, MASTER_4651, AMEX_1007, UNION_0005],
  default_id: VISA_4121.id,
  countries: COUNTRIES,
};

/** A payer who has never had an account: nothing billed, no card - 08-B offers to open one. */
export const ACCOUNTS_NONE: BillingAccounts = {
  has_account: false,
  payer: PAYER,
  next_billing: null,
  next_billing_iso: null,
  accounts: [],
  total: 0,
  methods: [],
  default_id: null,
  countries: COUNTRIES,
};

// --- An account opened in the sheet (onboarding's 01-D, then 01-J) ------------------------

const VISA_4242 = card("pm_visa4242", "Visa", "4242", 12, 2030);

const ACME: BillingAccount = {
  id: "acc-acme",
  name: "Acme Ltd",
  billing_company: "Acme Ltd",
  billing_email: "ap@acme.test",
  default_id: VISA_4242.id,
  card: { ...VISA_4242, is_default: true },
  cards: [{ ...VISA_4242, is_default: true }],
  total: 1,
  address: null,
  companies: [],
  in_dunning: false,
  past_due: false,
  // Nothing on it yet: nothing to bill.
  next_bill: null,
};

/**
 * The confirm's answer when the form OPENED an account: the payer's wallet with the new card in
 * it, and the account the card opened - charging that card, which is what 01-J's default line
 * reads. The payer-wide default is untouched (`make_default: false`).
 */
export const OPENED_ACCOUNT: ConfirmedCard = {
  has_account: true,
  default_id: VISA_4121.id,
  total: ACCOUNTS.methods.length + 1,
  methods: [...ACCOUNTS.methods, VISA_4242],
  account: {
    id: ACME.id,
    billing_email: ACME.billing_email,
    billing_company: ACME.billing_company,
    default_id: VISA_4242.id,
  },
};

/** The accounts once it is open - a fourth, and the newest is listed last. */
export const ACCOUNTS_OPENED: BillingAccounts = {
  ...ACCOUNTS,
  accounts: [...ACCOUNTS.accounts, ACME],
  total: ACCOUNTS.accounts.length + 1,
  methods: OPENED_ACCOUNT.methods,
};

/**
 * The accounts with a wallet fixture's cards on Company A - so each `?fixture=` frame of the
 * billing page (08-B / H / I / J / N) is Company A's page in that state.
 */
export function accountsFor(wallet: PayerPaymentMethods): BillingAccounts {
  const [first, ...rest] = ACCOUNTS.accounts;
  const charged = wallet.methods.find((m) => m.id === wallet.default_id) ?? null;
  return {
    ...ACCOUNTS,
    methods: wallet.methods,
    default_id: wallet.default_id,
    accounts: [
      {
        ...first,
        default_id: wallet.default_id ?? first.default_id,
        card: charged ? { ...charged, is_default: true } : null,
        cards: wallet.methods.map((m) => ({ ...m, is_default: m.id === wallet.default_id })),
        total: wallet.methods.length,
        address: charged ? first.address : null,
      },
      ...rest,
    ],
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
