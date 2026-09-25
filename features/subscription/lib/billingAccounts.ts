/**
 * Billing accounts - what 08-A, 08-B and 08-C show of them, and the rules for moving a company
 * between them, derived from `GET /api/me/billing/accounts`. Pure: the hooks fetch, this
 * decides what is on the screen.
 *
 * A BILLING ACCOUNT is a name ("Bill to"), a billing email, the cards on it, the ONE card it
 * charges, the companies it pays for and its own dunning clock. The payer opens one with a new
 * card and a company and email to bill under - in the billing-account sheet, onboarding's
 * `BillingSheet` (`components/AccountSheet`); 08-A shows one at a time (clicking its card opens
 * that sheet on the list, `?account=`); "Change billing account" moves a company from one to
 * another; 08-B is one account's profile and 08-C its name and address.
 *
 * TWO FACTS THAT LOOK LIKE CHOICES AND ARE NOT:
 *
 * - THE NEXT BILLING DATE IS THE PAYER'S. Every account renews on the payer's one anchor, so
 *   the date is the same whichever account is on screen - and it is the boundary AHEAD
 *   (`next_billing`), never the anchor, which is the first charge and never moves.
 * - THE ADDRESS IS THE CARD'S. No column holds an account's address (the user's decision): it
 *   is the billing address of the card the account charges - edited on 08-C in Stripe's own
 *   address form, with the cardholder's name it asks for, and written to that card at Stripe.
 */

import type {
  AccountChanges,
  BillingAccount,
  BillingAccounts,
  BillingAddress,
  CountryOption,
  PayerPaymentMethods,
} from "@/features/subscription/api/payerPortal";
import { cardTitle, type NextBilling } from "@/features/subscription/lib/billing";
import { formatMinor } from "@/features/subscription/lib/transfer";

// --- Copy ---------------------------------------------------------------------------

export const BILLING_ACCOUNTS = "Billing Accounts";
export const NEW_BILLING_ACCOUNT = "New billing account";
export const CHOOSE_ACCOUNT = "Choose which billing account to show";
export const ACCOUNTS_LOAD_FAILED = "I couldn't load your billing accounts.";
export const NO_ACCOUNT_TITLE = "No billing account yet";
export const NO_ACCOUNT_BODY =
  "A billing account is the company invoices are addressed to and the card it pays with. Open one to add cards and see its invoices.";
export const OPEN_BILLING_ACCOUNT = "Open a billing account";
export const ACCOUNT_NOT_FOUND = "That billing account couldn't be found.";
export const NO_CARD_TO_CHARGE = "No card it can charge";
export const PAYMENT_FAILED_CHIP = "Payment failed";
/** "Change billing account", step 1 and step 2. */
export const MOVE_PICK_COMPANY = "Change billing account";
export const MOVE_PICK_COMPANY_LEAD = "Which company's bills should move?";
export const MOVE_NO_COMPANIES =
  "No company is on a billing account yet. A company gets one when its billing is confirmed.";
export const MOVE_BUSY = "Moving…";
export const MOVE_FAILED = "That didn't go through. Mind trying again?";
/** 08-C. */
export const DETAILS_TITLE = "Update Billing Information";
export const SAVE_BILLING_ACCOUNT = "Save billing account";
export const DETAILS_SAVE_FAILED = "That didn't save. Mind trying again?";
export const NO_CARD_FOR_ADDRESS =
  "This account has no card to keep an address on. Add a card to it first.";
/** 08-C with no Stripe to draw the address form: no key here, or Stripe.js blocked or down. */
export const ADDRESS_UNAVAILABLE =
  "The address form couldn't load, so the address can't be changed right now. The company name and email still can.";
/** The sheet (onboarding's `BillingSheet`): the card flags on a row, and 01-J's name. */
export const CARD_EXPIRED_FLAG = "Expired";
export const CARD_EXPIRING_FLAG = "Expiring soon";
export const CARD_ADDED_LABEL = "Card added";

// Onboarding's 01-D fields, in its order and with its error words; the email is labelled
// "Billing Email" here (the user's call, 2026-09-25) - it is where invoices go, not a login.
export const EMAIL_LABEL = "Billing Email";
export const EMAIL_PLACEHOLDER = "name@company.com";
export const COMPANY_LABEL = "Billing company";
export const COMPANY_PLACEHOLDER = "Company name";
export const COMPANY_REQUIRED = "Enter the company name to invoice.";
export const EMAIL_REQUIRED = "Enter the email address invoices should go to.";
export const EMAIL_INVALID = "That email address doesn't look right.";
/** `billing_company` / `billing_email` are VARCHAR(255): the limit, and the API's own words. */
export const FIELD_MAX = 255;
export const TOO_LONG = "Keep that under 255 characters.";

/** Over the limit as the API counts it - characters, not UTF-16 units (an emoji is one). */
function tooLong(value: string): boolean {
  return [...value.trim()].length > FIELD_MAX;
}

/** One "@", something either side, a dot in the domain - onboarding's `EMAIL_RE`, and the API's. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: unknown): boolean {
  return EMAIL_RE.test(String(value ?? "").trim());
}

// --- Which account ------------------------------------------------------------------

/**
 * The account 08-A and 08-B show: the one asked for by id, else the one a company is on
 * (`?entity=` - a payment-failed banner knows a company, not an account), else the OLDEST. The
 * API lists them oldest first, so that is the first. An id that is not one of the payer's falls
 * back rather than failing: the page still has something true to show.
 */
export function pickAccount(
  data: BillingAccounts | null,
  want: { id?: string | null; entity?: string | null } = {},
): BillingAccount | null {
  const accounts = data?.accounts ?? [];
  if (want.id) {
    const hit = accounts.find((a) => a.id === want.id);
    if (hit) return hit;
  }
  if (want.entity) {
    const hit = accounts.find((a) => a.companies.some((c) => c.entity_id === want.entity));
    if (hit) return hit;
  }
  return accounts[0] ?? null;
}

/** 08-C's subject: exactly the account named, or nothing - a form must never open on another. */
export function findAccount(
  data: BillingAccounts | null,
  id: string | null | undefined,
): BillingAccount | null {
  return (id && data?.accounts.find((a) => a.id === id)) || null;
}

/** "Visa ending in 4121" - the card an account charges, as its second line names it. */
export function accountCardLine(account: BillingAccount): string {
  return account.card ? cardTitle(account.card) : NO_CARD_TO_CHARGE;
}

export function companyCount(n: number): string {
  return n === 1 ? "1 company" : `${n} companies`;
}

/** The account's cards in the shape `cardRows` reads, with THIS account's card as the default. */
export function accountWallet(account: BillingAccount | null): PayerPaymentMethods | null {
  if (!account) return null;
  return {
    has_account: true,
    default_id: account.default_id,
    methods: account.cards,
    total: account.cards.length,
  };
}

/**
 * The address as 08-B prints it: line 1, line 2, then the place - city, region, postal code and
 * country on one line with blanks and repeats dropped ("Hong Kong, Hong Kong" says it once).
 */
export function addressLines(address: BillingAddress | null): string[] {
  if (!address) return [];
  const seen = new Set<string>();
  const place = [address.city, address.state, address.postal_code, address.country_name]
    .map((part) => (part ?? "").trim())
    .filter((part) => {
      const key = part.toLowerCase();
      if (!part || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
  return [address.line1, address.line2, place].map((line) => (line ?? "").trim()).filter(Boolean);
}

/** What 08-A's card and 08-B's "Next billing" block show for one account. */
export function accountBilling(
  data: BillingAccounts | null,
  account: BillingAccount | null,
): NextBilling {
  return {
    billTo: account?.name ?? "",
    // The account's own address for invoices; one never given it reads as the payer's, like
    // its name does.
    email: account ? account.billing_email || data?.payer.email || null : null,
    addressLines: addressLines(account?.address ?? null),
    date: data?.next_billing ?? null,
    // The currency by its CODE - "HKD 1,500" (the user's call) - cents only when there are some.
    amount: account?.next_bill
      ? formatMinor(account.next_bill.amount_minor, account.next_bill.currency)
      : null,
    failed: Boolean(account?.past_due),
    failedNames: (account?.companies ?? []).filter((c) => c.past_due).map((c) => c.entity_name),
  };
}

// --- "Change billing account": moving a company ---------------------------------------

export type MovableCompany = {
  entityId: string;
  entityName: string;
  accountId: string;
  accountName: string;
  /** Its bill failed: the debt, the retries and "Pay now" follow the account it is on. */
  pastDue: boolean;
};

/**
 * Step 1: every company on one of the payer's accounts, by name, each with where it is now. A
 * company on no account is not here - it has nothing to move, and giving it one is its billing
 * being confirmed, which is not this dialog's. A past-due one is listed but cannot be picked.
 */
export function movableCompanies(data: BillingAccounts | null): MovableCompany[] {
  const rows: MovableCompany[] = [];
  for (const account of data?.accounts ?? []) {
    for (const company of account.companies) {
      rows.push({
        entityId: company.entity_id,
        entityName: company.entity_name,
        accountId: account.id,
        accountName: account.name,
        pastDue: company.past_due,
      });
    }
  }
  return rows.sort((a, b) => a.entityName.localeCompare(b.entityName));
}

export type MoveBlock = "current" | "in_dunning" | "no_card";

export const MOVE_BLOCK_LABEL: Record<MoveBlock, string> = {
  current: "Billed here now",
  in_dunning: PAYMENT_FAILED_CHIP,
  no_card: "No card",
};

export type MoveTarget = { account: BillingAccount; block: MoveBlock | null };

/**
 * Step 2: the accounts the company could go to, each with the reason it cannot when it cannot -
 * the API refuses the same three (it is on it already; a payment there failed; its card is gone),
 * and saying so on the row beats a refusal after Confirm.
 */
export function moveTargets(data: BillingAccounts | null, from: MovableCompany): MoveTarget[] {
  return (data?.accounts ?? []).map((account) => ({
    account,
    block:
      account.id === from.accountId
        ? "current"
        : account.in_dunning
          ? "in_dunning"
          : account.card
            ? null
            : "no_card",
  }));
}

/** Told on 08-A once a company has moved. */
export function movedNotice(data: BillingAccounts | null, entityId: string): string | null {
  const account = data?.accounts.find((a) => a.companies.some((c) => c.entity_id === entityId));
  const company = account?.companies.find((c) => c.entity_id === entityId);
  return account && company ? `${company.entity_name} is now billed to ${account.name}.` : null;
}

/** Told on 08-A when a new account opened but the company it was opened for did not move. */
export function moveFailedNotice(data: BillingAccounts | null, entityId: string): string {
  const account = data?.accounts.find((a) => a.companies.some((c) => c.entity_id === entityId));
  const company = account?.companies.find((c) => c.entity_id === entityId);
  return account && company
    ? `Your new billing account is ready, but ${company.entity_name} is still billed to ${account.name}. Move it again from Change billing account.`
    : "Your new billing account is ready, but the company was not moved. Move it again from Change billing account.";
}

// --- The new account form (identity) ------------------------------------------------

export type IdentityFields = { company: string; email: string };
export type IdentityErrors = Partial<Record<keyof IdentityFields, string>>;

/** Both are required to OPEN an account (01-D's rule, and the API's), and neither may pass 255. */
export function validateIdentity(fields: IdentityFields): IdentityErrors {
  const errors: IdentityErrors = {};
  if (!fields.company.trim()) errors.company = COMPANY_REQUIRED;
  else if (tooLong(fields.company)) errors.company = TOO_LONG;
  if (!fields.email.trim()) errors.email = EMAIL_REQUIRED;
  else if (!isEmail(fields.email)) errors.email = EMAIL_INVALID;
  else if (tooLong(fields.email)) errors.email = TOO_LONG;
  return errors;
}

// --- 08-C: the name and email here, the address in Stripe's own form -------------------

/** What 08-C types into its own fields: the account's name and billing email. */
export type DetailsFields = IdentityFields;
export type DetailsErrors = IdentityErrors;

const ADDRESS_KEYS = ["line1", "line2", "city", "state", "postal_code", "country"] as const;
type AddressKey = (typeof ADDRESS_KEYS)[number];

/**
 * An address as Stripe's address form holds it (`AddressElement`, billing mode): the cardholder's
 * name and the six keys Stripe knows - every value trimmed and a missing one blank, so two
 * addresses compare the way they print.
 */
export type CardAddress = { name: string; address: Record<AddressKey, string> };

/** Stripe's address form's CHECKED value - null while it marks a field it will not accept. */
export type ReadAddress = () => Promise<CardAddress | null>;

/** Stripe's value, or the API's card: whatever shape arrives, as a `CardAddress`. */
export function cardAddress(
  name: string | null | undefined,
  address: Partial<Record<AddressKey, string | null | undefined>> | null | undefined,
): CardAddress {
  const a = address ?? {};
  const clean = (value: string | null | undefined) => (value ?? "").trim();
  return {
    name: clean(name),
    address: {
      line1: clean(a.line1),
      line2: clean(a.line2),
      city: clean(a.city),
      state: clean(a.state),
      postal_code: clean(a.postal_code),
      country: clean(a.country).toUpperCase(),
    },
  };
}

/** The form's own fields as the account is now: its raw name and email. */
export function detailsFields(account: BillingAccount): DetailsFields {
  return { company: account.billing_company ?? "", email: account.billing_email ?? "" };
}

/**
 * What Stripe's address form opens on: the charged card's cardholder and billing address. Null
 * when the account charges no card - there is nothing to keep an address on.
 */
export function addressDefaults(account: BillingAccount): CardAddress | null {
  return account.card ? cardAddress(account.card.cardholder, account.address) : null;
}

function addressKeysChanged(value: CardAddress, initial: CardAddress): boolean {
  return ADDRESS_KEYS.some((key) => value.address[key] !== initial.address[key]);
}

/** Whether Stripe's form now holds anything the card does not - the name included. */
export function addressChanged(value: CardAddress | null, initial: CardAddress | null): boolean {
  if (!value || !initial) return false;
  return value.name !== initial.name || addressKeysChanged(value, initial);
}

/**
 * What stops Save in OUR fields (Stripe's form checks its own). The company is the account's
 * name, so a name it has cannot be blanked (an account never named may stay so - it reads as the
 * payer); the email may be cleared but not mistyped; neither may pass 255 characters.
 */
export function validateDetails(fields: DetailsFields, initial: DetailsFields): DetailsErrors {
  const errors: DetailsErrors = {};
  if (!fields.company.trim()) {
    if (initial.company.trim()) errors.company = COMPANY_REQUIRED;
  } else if (tooLong(fields.company)) errors.company = TOO_LONG;
  if (fields.email.trim()) {
    if (!isEmail(fields.email)) errors.email = EMAIL_INVALID;
    else if (tooLong(fields.email)) errors.email = TOO_LONG;
  }
  return errors;
}

/**
 * Only what changed goes to the API. The address goes as a GROUP when any of it changed - all six
 * keys, blanks included, because a blank is how a line is cleared (the API sends it to Stripe as
 * its "unset"), and Stripe's form leaves out what the country does not use (no postcode in Hong
 * Kong) - and the cardholder only when the name changed.
 */
export function detailsChanges(
  fields: DetailsFields,
  initial: DetailsFields,
  address?: { value: CardAddress | null; initial: CardAddress | null },
): AccountChanges {
  const changes: AccountChanges = {};
  if (fields.company.trim() !== initial.company.trim()) {
    changes.billing_company = fields.company.trim();
  }
  if (fields.email.trim() !== initial.email.trim()) changes.billing_email = fields.email.trim();
  const value = address?.value;
  const start = address?.initial;
  if (value && start) {
    if (addressKeysChanged(value, start)) changes.address = { ...value.address };
    if (value.name !== start.name) changes.cardholder = value.name;
  }
  return changes;
}

/**
 * The countries Stripe's address form may offer: the registry's (the API refuses any other),
 * plus the card's current one when the registry lacks it - a form that cannot show the value it
 * holds would silently change it on save. Null - Stripe's whole list - with no registry to go by.
 */
export function allowedCountries(
  countries: CountryOption[] | undefined,
  current: string,
): string[] | null {
  const codes = (countries ?? []).map((c) => c.code);
  if (codes.length === 0) return null;
  return current && !codes.includes(current) ? [current, ...codes] : codes;
}
