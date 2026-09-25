/**
 * The payer portal's API: the `/api/me/*` routes, typed to the contract - Flask's fifteen
 * paths, plus `transfer/seen` and the four `billing/accounts` routes minty-billing-api added.
 *
 * billing-frontend/lib/payerPortal.ts, moved: the same function names, parameters, request
 * bodies, query names and response types, so the portal screens port mechanically (Part 2
 * step 4). What changed: the base URL is minty-billing-api (lib/apiClient.ts), and the token
 * refresh is gone - a 401 goes back through Flask's re-handoff instead (lib/handoff.ts).
 * `invite-admin` is the one route the API forwards to Flask; the caller cannot tell.
 *
 * Person-scoped: no `X-Entity-Id` on any of these. Where a route names a company it does so in
 * the query string or the body (`entity`), as Flask's routes/portal.py did.
 */

import { ApiError, apiFetch } from "@/lib/apiClient";

// --- Subscriptions ------------------------------------------------------------

/**
 * Seven statuses, not the four the design draws swatches for. `past_due`, `ended` and
 * `trial_expired` are splits of what would otherwise be a grey "not subscribed" that lies.
 */
export type ModuleStatus =
  "active" | "trialing" | "cancelled" | "past_due" | "ended" | "trial_expired" | "not_subscribed";

export type PortalModule = {
  code: string;
  name: string;
  status: ModuleStatus;
  /** What the badge reads, e.g. "free trial". Server-owned so every app says it the same way. */
  status_label: string;
  /** "Next billing" / "Trial ends" / "Expires" / "Access ends" / "Ended", or null. */
  date_label: string | null;
  /** Already formatted - "15 Aug 2026". Null when there is no date to show. */
  date: string | null;
  date_iso: string | null;
};

export type PortalEntity = {
  entity_id: string;
  entity_name: string;
  country: string | null;
  country_code: string | null;
  subscriber: { id: string; name: string; email: string };
  modules: PortalModule[];
  /** A Minty PATH. Hand the token back through Flask's /entity/<id>/enter to land on it signed in. */
  settings_path: string;
  /**
   * ISO; when the company was created. The Manage Subscriptions list is "ordered newest entity
   * first" (design note) - an addition over Flask's answer for the step-3 API to emit; absent,
   * the list keeps the API's order.
   */
  created_at?: string | null;
};

export const SORT_FIELDS = [
  "entity",
  "subscriber",
  "country",
  "modules",
  "status",
  "next_billing",
] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortDirection = "asc" | "desc";

/**
 * How one of the payer's OWN offers ended, where they have not been shown yet (07-I / A-07 for
 * a decline, A-08 for an expiry, 07-L for an accept).
 *
 * The only place a finished handover is visible: every other read filters on the open
 * statuses, so a declined offer is otherwise indistinguishable from one never made.
 */
export type TransferOutcomeRow = {
  id: string;
  entity_id: string;
  entity_name: string;
  status: "declined" | "expired" | "accepted";
  /** The other party, named - the modal's title is "<Name> declined the transfer". */
  who: string;
  responded_at: string | null;
};

export type PayerSubscriptions = {
  payer: { id: string; name: string; email: string };
  /** Empty when there is nothing to tell; absent on an API older than this field. */
  transfer_outcomes?: TransferOutcomeRow[];
  billing: {
    /** The cycle's START - the payer's first charge. Never a date to print as "next". */
    anchor: string | null;
    anchor_iso: string | null;
    paid_through: string | null;
    paid_through_iso: string | null;
    /** The date the payer is next billed: the end of the anchor period now is in. */
    next_billing?: string | null;
    next_billing_iso?: string | null;
    currency: string | null;
  };
  entities: PortalEntity[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
  sort: SortField;
  direction: SortDirection;
  query: string;
};

export type PayerSubscriptionsParams = {
  query?: string;
  sort?: SortField;
  direction?: SortDirection;
  page?: number;
  perPage?: number;
  signal?: AbortSignal;
};

const UNEXPECTED_SHAPE = "That came back in a shape I didn't expect. Mind trying again?";

export async function fetchPayerSubscriptions(
  params: PayerSubscriptionsParams = {},
): Promise<PayerSubscriptions> {
  const data = await apiFetch<PayerSubscriptions>("/api/me/subscriptions", {
    signal: params.signal,
    query: {
      q: params.query?.trim() || undefined,
      sort: params.sort,
      direction: params.direction,
      page: params.page,
      per_page: params.perPage,
    },
  });
  if (!data || !Array.isArray(data.entities)) throw new ApiError(502, UNEXPECTED_SHAPE);
  return data;
}

/** The API's page-size ceiling (`MAX_PER_PAGE` in Minty's portal route). */
export const MAX_PER_PAGE = 100;

/**
 * Every company the payer is responsible for, in one list: the design scrolls, it does not
 * page, so the pages are walked here. Sorting and searching happen on the loaded list.
 */
export async function fetchAllPayerSubscriptions(signal?: AbortSignal): Promise<{
  payer: PayerSubscriptions["payer"];
  billing: PayerSubscriptions["billing"];
  entities: PortalEntity[];
  transfer_outcomes: TransferOutcomeRow[];
}> {
  const first = await fetchPayerSubscriptions({ page: 1, perPage: MAX_PER_PAGE, signal });
  const entities = [...first.entities];
  for (let page = 2; page <= first.pages; page++) {
    const next = await fetchPayerSubscriptions({ page, perPage: MAX_PER_PAGE, signal });
    entities.push(...next.entities);
  }
  // From the FIRST page only: the outcomes are a fact about the payer, not about the window
  // of companies, so every page repeats them and concatenating would show each modal twice.
  return {
    payer: first.payer,
    billing: first.billing,
    entities,
    transfer_outcomes: first.transfer_outcomes ?? [],
  };
}

// --- Change subscriber ----------------------------------------------------------

/** What taking a company over costs the incoming payer, priced by the API. */
export type TransferQuote = {
  amount: number;
  currency: string;
  /** The window actually CHARGED - from the handover instant, not the period start. */
  covers_from: string;
  covers_to: string;
  period_start: string;
  period_end: string;
  anchor_at: string;
  /** True when this handover is what establishes their billing date. */
  anchor_is_new: boolean;
};

/** A free trial the incoming payer would INHERIT. One entry per conversion DATE, not per module. */
export type InheritedTrial = {
  label: string;
  codes: string[];
  trial_end: string;
  amount: number | null;
  currency: string | null;
  anchor_is_new: boolean | null;
};

/** A person the entity's bill could be handed to. Admins only; the current payer first. */
export type SubscriberCandidate = {
  id: string;
  name: string;
  email: string;
  is_current: boolean;
  quote?: TransferQuote | null;
  trials?: InheritedTrial[];
};

export type PendingTransfer = {
  id: string;
  to_user_id: string;
  status: string;
  since: string;
};

export type SubscriberOptions = {
  entity: { entity_id: string; entity_name: string };
  /**
   * ISO; the day the outgoing payer's money stops covering this company. A fact about the
   * ENTITY - the footer needs it whether or not there is anyone to hand the bill to.
   */
  paid_through?: string | null;
  current: { id: string; name: string; email: string };
  candidates: SubscriberCandidate[];
  /** Why the handover cannot go ahead, in the API's words, or empty. */
  blockers?: string[];
  /** An offer already waiting on this company. At most one. */
  pending_transfer?: PendingTransfer | null;
};

/** A handover offered TO the signed-in user. */
export type IncomingTransfer = {
  id: string;
  entity_id: string;
  entity_name: string;
  settings_path: string;
  from_name: string;
  from_user_id: string;
  status: string;
  expires_at: string;
  amount: number | null;
  currency: string | null;
  quote: TransferQuote | null;
  trials: InheritedTrial[];
  blockers: string[];
};

/** The only portal read that names a company, so the only one that can 404 (not your payer). */
export async function fetchSubscriberOptions(
  entityId: string,
  signal?: AbortSignal,
): Promise<SubscriberOptions> {
  const data = await apiFetch<SubscriberOptions>("/api/me/subscriptions/subscriber-options", {
    signal,
    query: { entity: entityId },
  });
  if (!data?.entity || !Array.isArray(data.candidates)) throw new ApiError(502, UNEXPECTED_SHAPE);
  return data;
}

/** Forwarded by the API to Flask, which owns the invitation. Resolves to the message to show. */
export async function inviteAdminToEntity(entityId: string, email: string): Promise<string> {
  const body = await apiFetch<{ ok?: boolean; message?: string }>(
    "/api/me/subscriptions/invite-admin",
    {
      method: "POST",
      json: { entity: entityId, email },
    },
  );
  if (!body?.ok) throw new ApiError(502, "I couldn't send that invitation. Mind trying again?");
  return body.message ?? "Invitation sent.";
}

export async function initiateTransfer(entityId: string, toUserId: string): Promise<string> {
  const data = await apiFetch<{ message?: string }>("/api/me/subscriptions/transfer", {
    method: "POST",
    json: { entity: entityId, to_user: toUserId },
  });
  return data?.message || "The handover request has been sent.";
}

/**
 * `codes` is the modules being taken on (07-D "Choose Modules"). Anything the company has and
 * the list does not name is CANCELLED as part of accepting, ending where the outgoing payer's
 * money runs out. Omitted means the whole company.
 */
export async function respondToTransfer(
  transferId: string,
  accept: boolean,
  codes?: string[],
): Promise<string> {
  const data = await apiFetch<{ message?: string }>("/api/me/subscriptions/transfer/respond", {
    method: "POST",
    json: { transfer: transferId, accept, ...(codes ? { codes } : {}) },
  });
  return data?.message || (accept ? "You're now the subscriber." : "Request declined.");
}

/** 07-I's Done: this payer has been shown how that offer ended, and never will be again. */
export async function markTransferSeen(transferId: string): Promise<void> {
  await apiFetch("/api/me/subscriptions/transfer/seen", {
    method: "POST",
    json: { transfer: transferId },
  });
}

export async function cancelTransfer(transferId: string): Promise<string> {
  const data = await apiFetch<{ message?: string }>("/api/me/subscriptions/transfer/cancel", {
    method: "POST",
    json: { transfer: transferId },
  });
  return data?.message || "The handover request has been withdrawn.";
}

export async function listIncomingTransfers(signal?: AbortSignal): Promise<IncomingTransfer[]> {
  const data = await apiFetch<{ transfers?: IncomingTransfer[] }>(
    "/api/me/subscriptions/transfers",
    {
      signal,
    },
  );
  return Array.isArray(data?.transfers) ? data.transfers : [];
}

// --- Saved payment methods ---------------------------------------------------------

/** A card or wallet on the payer's Stripe customer, pre-formatted by the API; always safe to print. */
export type SavedPaymentMethod = {
  id: string;
  type: string;
  brand: string | null;
  brand_label: string;
  last4: string | null;
  label: string;
  cardholder: string | null;
  email: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
  };
  exp_month: number | null;
  exp_year: number | null;
  expiry: string | null;
  funding: string | null;
  wallet: string | null;
  wallet_label: string | null;
  country: string | null;
  country_name: string | null;
  is_default: boolean;
  expired: boolean;
  expires_soon: boolean;
  added: string | null;
  added_iso: string | null;
};

export type PayerPaymentMethods = {
  /** False means no Stripe customer at all - not an empty wallet. */
  has_account: boolean;
  default_id: string | null;
  methods: SavedPaymentMethod[];
  total: number;
};

export type EntityPaymentMethod = PayerPaymentMethods & {
  entity_id: string;
  /** The card THIS company is billed to, or null if it has none yet. Distinct from `default_id`. */
  nominated_id: string | null;
};

export type SetupIntentHandle = {
  client_secret: string;
  publishable_key: string;
  setup_intent: string;
};

export async function fetchPaymentMethods(signal?: AbortSignal): Promise<PayerPaymentMethods> {
  const data = await apiFetch<PayerPaymentMethods>("/api/me/billing/payment-methods", { signal });
  if (!data || !Array.isArray(data.methods)) throw new ApiError(502, UNEXPECTED_SHAPE);
  return data;
}

export async function startCardSetup(): Promise<SetupIntentHandle> {
  const data = await apiFetch<SetupIntentHandle>("/api/me/billing/payment-methods/setup-intent", {
    method: "POST",
    json: {},
  });
  if (!data?.client_secret || !data?.publishable_key) {
    throw new ApiError(502, "I couldn't open the card form. Mind trying again?");
  }
  return data;
}

/** Which billing account a confirmed card goes on - onboarding's `BillingAccountChoice`. */
export type BillingAccountChoice = {
  /** Put the card on this account (08-B's "Add payment method"). */
  billingGroupId?: string | null;
  /** With `company`, OPEN a new account on the card ("New billing account"). */
  email?: string | null;
  company?: string | null;
};

/** The confirm answer: the wallet, plus the account the card went on when it named one. */
export type ConfirmedCard = PayerPaymentMethods & {
  account?: {
    id: string;
    billing_email: string | null;
    billing_company: string | null;
    default_id: string;
  };
};

/**
 * Tell the API about the card the browser just confirmed. `account` is optional: the id puts
 * the card on an account the payer holds; a company and an email OPEN one. The body is
 * onboarding's `confirmCardSetup` exactly (onboarding/lib/billing.ts), the same act in two apps.
 */
export function confirmCardSetup(
  setupIntent: string,
  makeDefault = false,
  account?: BillingAccountChoice | null,
): Promise<ConfirmedCard> {
  return apiFetch<ConfirmedCard>("/api/me/billing/payment-methods/confirm", {
    method: "POST",
    json: {
      setup_intent: setupIntent,
      make_default: makeDefault,
      ...(account?.billingGroupId ? { billing_group_id: account.billingGroupId } : {}),
      ...(account?.email != null ? { billing_email: account.email } : {}),
      ...(account?.company != null ? { billing_company: account.company } : {}),
    },
  });
}

export function setDefaultPaymentMethod(paymentMethod: string): Promise<PayerPaymentMethods> {
  return apiFetch<PayerPaymentMethods>("/api/me/billing/payment-methods/default", {
    method: "POST",
    json: { payment_method: paymentMethod },
  });
}

export async function fetchEntityPaymentMethod(
  entityId: string,
  signal?: AbortSignal,
): Promise<EntityPaymentMethod> {
  const data = await apiFetch<EntityPaymentMethod>("/api/me/billing/entity-payment-method", {
    signal,
    query: { entity: entityId },
  });
  if (!data || !Array.isArray(data.methods)) throw new ApiError(502, UNEXPECTED_SHAPE);
  return data;
}

export function setEntityPaymentMethod(
  entityId: string,
  paymentMethod: string,
): Promise<EntityPaymentMethod> {
  return apiFetch<EntityPaymentMethod>("/api/me/billing/entity-payment-method", {
    method: "POST",
    json: { entity: entityId, payment_method: paymentMethod },
  });
}

export function updatePaymentMethod(
  paymentMethod: string,
  changes: {
    exp_month?: number;
    exp_year?: number;
    name?: string;
    address?: Partial<SavedPaymentMethod["address"]>;
  },
): Promise<PayerPaymentMethods> {
  return apiFetch<PayerPaymentMethods>("/api/me/billing/payment-methods/update", {
    method: "POST",
    json: { payment_method: paymentMethod, ...changes },
  });
}

/**
 * `accountId` is the billing account whose page asked (08-B): the API refuses that account's
 * own card in its words, and hands the payer-wide default to the account's card rather than
 * refusing with a fix this page has no button for.
 */
export function removePaymentMethod(
  paymentMethod: string,
  accountId?: string | null,
): Promise<PayerPaymentMethods> {
  return apiFetch<PayerPaymentMethods>("/api/me/billing/payment-methods/remove", {
    method: "POST",
    json: { payment_method: paymentMethod, ...(accountId ? { account: accountId } : {}) },
  });
}

// --- Billing accounts (08-A / 08-B / 08-C) ---------------------------------------------

/** A billing account's address: the Stripe billing address of the card it charges. */
export type BillingAddress = SavedPaymentMethod["address"] & { country_name: string | null };

/** A company one account pays for. */
export type AccountCompany = { entity_id: string; entity_name: string; past_due: boolean };

/**
 * A billing account: a name ("Bill to"), a billing email, the cards on it, the ONE card it
 * charges, the companies it pays for and its own dunning clock.
 */
export type BillingAccount = {
  id: string;
  /** What "Bill to" reads: the company it bills under, else the payer. */
  name: string;
  /** Raw, so a form can tell "unnamed" from "named after the payer". */
  billing_company: string | null;
  billing_email: string | null;
  /** The card the account CHARGES. */
  default_id: string;
  /** That card, or null when Stripe no longer holds it - an account that cannot pay. */
  card: SavedPaymentMethod | null;
  /** The account's cards, its own first; `is_default` marks THIS account's card. */
  cards: SavedPaymentMethod[];
  total: number;
  /** The charged card's billing address; null with no card to hold one. */
  address: BillingAddress | null;
  companies: AccountCompany[];
  in_dunning: boolean;
  /** In dunning, or any of its companies past due. */
  past_due: boolean;
  /**
   * What its next renewal will charge - ESTIMATED, priced by the API's renewal runner for the
   * period starting on the payer's next billing date (its companies billing forward, the trials
   * that will have converted by then, a cancellation extension riding along). Null when there
   * is no cycle yet or nothing to bill.
   */
  next_bill: { amount: string; amount_minor: number; currency: string } | null;
};

export type CountryOption = { code: string; name: string };

export type BillingAccounts = {
  has_account: boolean;
  payer: { id: string; name: string; email: string };
  /** ONE date for the payer - every account renews on the same anchor. */
  next_billing: string | null;
  next_billing_iso: string | null;
  /** Oldest first: the first is the one shown when none is asked for. */
  accounts: BillingAccount[];
  total: number;
  /** The flat wallet: a card on no account is still the payer's. */
  methods: SavedPaymentMethod[];
  default_id: string | null;
  /** Only when asked (`countries: true`) - the countries 08-C's address form may offer. */
  countries?: CountryOption[];
  /**
   * Only when asked, with the countries: the key 08-C's address form - Stripe's own - mounts
   * with. Null when the environment has no Stripe.
   */
  publishable_key?: string | null;
};

/** What "Change billing account" did: the company, where from and where to. */
export type AccountMove = {
  entity_id: string;
  entity_name: string;
  from_account: { id: string; name: string } | null;
  to_account: { id: string; name: string };
};

export type MovedAccounts = BillingAccounts & { moved: AccountMove | null };

/**
 * What 08-C may change: the name and email (the account), the address and the cardholder's name
 * that Stripe's address form asks for with it (both its charged card's).
 */
export type AccountChanges = {
  billing_company?: string;
  billing_email?: string;
  address?: Partial<SavedPaymentMethod["address"]>;
  cardholder?: string;
};

function accountsOrThrow<T extends BillingAccounts>(data: T | null | undefined): T {
  if (!data || !Array.isArray(data.accounts)) throw new ApiError(502, UNEXPECTED_SHAPE);
  return data;
}

export async function fetchBillingAccounts(
  params: { countries?: boolean; signal?: AbortSignal } = {},
): Promise<BillingAccounts> {
  return accountsOrThrow(
    await apiFetch<BillingAccounts>("/api/me/billing/accounts", {
      signal: params.signal,
      query: { countries: params.countries ? 1 : undefined },
    }),
  );
}

/** Make one card on the account the card it CHARGES: its companies' next bills go to it. */
export async function setAccountDefaultCard(
  accountId: string,
  paymentMethod: string,
): Promise<BillingAccounts> {
  return accountsOrThrow(
    await apiFetch<BillingAccounts>("/api/me/billing/accounts/default-card", {
      method: "POST",
      json: { account: accountId, payment_method: paymentMethod },
    }),
  );
}

/** 08-C: only the keys that changed; a blank clears. */
export async function updateBillingAccount(
  accountId: string,
  changes: AccountChanges,
): Promise<BillingAccounts> {
  return accountsOrThrow(
    await apiFetch<BillingAccounts>("/api/me/billing/accounts/update", {
      method: "POST",
      json: { account: accountId, ...changes },
    }),
  );
}

/** "Change billing account": nothing is charged; the company's paid days go with it. */
export async function moveCompanyToAccount(
  entityId: string,
  accountId: string,
): Promise<MovedAccounts> {
  return accountsOrThrow(
    await apiFetch<MovedAccounts>("/api/me/billing/accounts/move", {
      method: "POST",
      json: { entity: entityId, account: accountId },
    }),
  );
}

// --- Invoices ------------------------------------------------------------------

export type InvoiceRow = {
  id: string;
  reference: string;
  date: string | null;
  date_iso: string | null;
  period_start: string | null;
  period_end: string | null;
  /** WHAT HAPPENED, then the plans - "Upgrade · Petty Cash → Super Minty". */
  description: string;
  description_detail: string;
  memo: string | null;
  /** Formatted with its own currency symbol, e.g. "HK$400.00". */
  amount: string;
  amount_minor: number;
  currency: string;
  /** Stripe's vocabulary: paid / open / draft / uncollectible / void. */
  status: string;
  status_label: string;
  payment_method: string | null;
  /** A CAPABILITY URL (Stripe's hosted invoice page): open with rel="noopener noreferrer", never log. */
  hosted_invoice_url: string | null;
  entities: string[];
};

export type PayerInvoices = {
  invoices: InvoiceRow[];
  entity_options: { id: string; name: string }[];
  entity_id: string | null;
  /** The billing account asked about, when one was. */
  account_id?: string | null;
  total: number;
  page: number;
  pages: number;
  per_page: number;
};

export type PayerInvoicesParams = {
  entityId?: string | null;
  /** ONE billing account's invoices (08-B); a pre-accounts invoice belongs to the oldest. */
  accountId?: string | null;
  page?: number;
  perPage?: number;
  signal?: AbortSignal;
};

/**
 * One line of an invoice's breakdown (08-B's "Billing Breakdown"): a company, the subscription
 * it was charged for, the monthly rate that charge was priced at, the days it paid for and what
 * was charged. The API reads each line's days and rate back from how that kind of line is priced
 * - `full` a renewal, `remaining` a mid-period start or upgrade, `unused` the credit for the plan
 * replaced (negative), `extension` the days of access past a cancellation.
 */
export type BreakdownRow = {
  entity_id: string;
  entity_name: string;
  subscription: string;
  kind: "full" | "remaining" | "unused" | "extension" | (string & {});
  /** Minor units; null when it could not be read back. */
  monthly_minor: number | null;
  period_start: string | null;
  /** The instant the days paid for end (the next period's start); null when it is not known. */
  period_end: string | null;
  charged_minor: number;
};

export type InvoiceBreakdown = {
  invoice: {
    id: string;
    reference: string;
    currency: string;
    period_start: string | null;
    period_end: string | null;
    total_minor: number;
  };
  rows: BreakdownRow[];
};

/** One invoice, company by company - someone else's invoice is a 404, in the API's words. */
export async function fetchInvoiceBreakdown(invoiceId: string): Promise<InvoiceBreakdown> {
  const data = await apiFetch<InvoiceBreakdown>(
    `/api/me/invoices/${encodeURIComponent(invoiceId)}/breakdown`,
  );
  if (!data || !Array.isArray(data.rows) || !data.invoice) {
    throw new ApiError(502, UNEXPECTED_SHAPE);
  }
  return data;
}

export async function fetchPayerInvoices(params: PayerInvoicesParams = {}): Promise<PayerInvoices> {
  const data = await apiFetch<PayerInvoices>("/api/me/invoices", {
    signal: params.signal,
    query: {
      entity: params.entityId ?? undefined,
      account: params.accountId ?? undefined,
      page: params.page,
      per_page: params.perPage,
    },
  });
  if (!data || !Array.isArray(data.invoices)) throw new ApiError(502, UNEXPECTED_SHAPE);
  return data;
}
