"use client";

/**
 * 08-C "Update Billing Information" - one billing account's name, billing email and address.
 * The screen calls this and renders what it returns.
 *
 * THE SUBJECT IS EXACTLY THE ACCOUNT NAMED (`?account=`): a stale link says the account cannot
 * be found rather than opening another account's form, because what is typed here is written.
 * The read asks for what the address form needs as well - the country registry and Stripe's
 * publishable key - the one screen that does.
 *
 * TWO HOMES FOR WHAT IS SAVED, one request: the company and email are the ACCOUNT's, typed into
 * our own fields; the address, and the cardholder's name with it, belong to the CARD the account
 * charges, typed into STRIPE'S own address form (the user's call, 2026-09-25 - the fields a
 * country's addresses need, checked and autocompleted). Only what changed is sent, the address
 * as a whole when any of it changed. The order is fixed: our fields' rules, then Stripe's check
 * of its own fields (`readAddress` - nothing is sent while it marks one), then the API, which
 * checks everything again and writes Stripe first.
 *
 * An account with no card has nowhere to keep an address, and a page that cannot load Stripe
 * cannot edit one: either way the address stays as it is and the name and email still save.
 * Save and Go Back both land on 08-B.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/apiClient";

import {
  fetchBillingAccounts,
  updateBillingAccount,
  type BillingAccount,
  type BillingAccounts,
} from "@/features/subscription/api/payerPortal";
import {
  ACCOUNT_NOT_FOUND,
  ACCOUNTS_LOAD_FAILED,
  DETAILS_SAVE_FAILED,
  addressChanged,
  addressDefaults,
  allowedCountries,
  detailsChanges,
  detailsFields,
  findAccount,
  validateDetails,
  type CardAddress,
  type DetailsErrors,
  type DetailsFields,
  type ReadAddress,
} from "@/features/subscription/lib/billingAccounts";
import { BILLING } from "@/features/subscription/lib/paths";
import { stripeFor } from "@/features/subscription/lib/stripe";

const EMPTY: DetailsFields = { company: "", email: "" };

export type UseBillingDetailsResult = {
  status: "loading" | "ready" | "error";
  error: string | null;
  account: BillingAccount | null;
  fields: DetailsFields;
  errors: DetailsErrors;
  /** What Stripe's address form opens on: the charged card's cardholder and address. */
  addressDefaults: CardAddress | null;
  /** The countries it may offer (null: Stripe's whole list). */
  allowedCountries: string[] | null;
  /** The key it mounts with - null when this environment has none. */
  publishableKey: string | null;
  /** The account has no card to keep an address on. */
  addressLocked: boolean;
  /** Stripe's form cannot be drawn here: no key, or Stripe.js would not load. */
  addressUnavailable: boolean;
  dirty: boolean;
  busy: boolean;
  saveError: string | null;
  setField: (field: keyof DetailsFields, value: string) => void;
  /** Every change Stripe's form reports. */
  setAddress: (value: CardAddress) => void;
  /** Stripe's form could not load. */
  addressFailed: () => void;
  save: (readAddress?: ReadAddress) => Promise<void>;
  back: () => void;
};

function sentence(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

async function loadAccounts(fixture: string | null | undefined): Promise<BillingAccounts> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/billing");
    return f.ACCOUNTS;
  }
  return fetchBillingAccounts({ countries: true });
}

export function useBillingDetails({
  accountId,
  fixture,
}: {
  accountId?: string | null;
  fixture?: string | null;
}): UseBillingDetailsResult {
  const router = useRouter();
  const [loaded, setLoaded] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<BillingAccounts | null>(null);
  const [fields, setFields] = useState<DetailsFields>(EMPTY);
  const [initial, setInitial] = useState<DetailsFields>(EMPTY);
  const [errors, setErrors] = useState<DetailsErrors>({});
  // Stripe's form's latest value; null until it reports one (it opens on the defaults).
  const [address, setAddressState] = useState<CardAddress | null>(null);
  const [stripeFailed, setStripeFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // No account in the URL is not a failed read - it is a form opened without a subject, which
  // the effect below never runs for (derived here so nothing is set during a render).
  const status = accountId ? loaded : "error";
  const error = accountId ? loadError : ACCOUNT_NOT_FOUND;

  useEffect(() => {
    if (!accountId) return;
    let live = true;
    (async () => {
      try {
        const answer = await loadAccounts(fixture);
        if (!live) return;
        const found = findAccount(answer, accountId);
        if (!found) {
          setLoadError(ACCOUNT_NOT_FOUND);
          setLoaded("error");
          return;
        }
        const start = detailsFields(found);
        setData(answer);
        setFields(start);
        setInitial(start);
        setLoadError(null);
        setLoaded("ready");
        // Stripe.js that will not load (an ad blocker, a proxy) resolves null rather than
        // failing loudly; the address then says so instead of sitting empty.
        if (answer.publishable_key && found.card) {
          const stripe = await stripeFor(answer.publishable_key);
          if (live && !stripe) setStripeFailed(true);
        }
      } catch (err) {
        if (!live) return;
        setLoadError(sentence(err, ACCOUNTS_LOAD_FAILED));
        setLoaded("error");
      }
    })();
    return () => {
      live = false;
    };
  }, [accountId, fixture]);

  const account = useMemo(() => findAccount(data, accountId), [data, accountId]);
  const defaults = useMemo(() => (account ? addressDefaults(account) : null), [account]);
  const countries = useMemo(
    () => allowedCountries(data?.countries, defaults?.address.country ?? ""),
    [data, defaults],
  );
  const current = address ?? defaults;
  const changes = useMemo(
    () => detailsChanges(fields, initial, { value: current, initial: defaults }),
    [fields, initial, current, defaults],
  );

  const setField = useCallback((field: keyof DetailsFields, value: string) => {
    setFields((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }, []);

  const save = useCallback(
    async (readAddress?: ReadAddress) => {
      if (!account || busy) return;
      const found = validateDetails(fields, initial);
      setErrors(found);
      if (Object.keys(found).length > 0 || Object.keys(changes).length === 0) return;
      setBusy(true);
      setSaveError(null);
      try {
        let latest = current;
        if (addressChanged(current, defaults)) {
          // Stripe checks its own fields and marks what it will not accept; nothing is sent
          // until it is satisfied, and what is sent is what it returned.
          const read = readAddress ? await readAddress() : null;
          if (!read) {
            setBusy(false);
            return;
          }
          latest = read;
        }
        const send = detailsChanges(fields, initial, { value: latest, initial: defaults });
        if (Object.keys(send).length === 0) {
          setBusy(false);
          return;
        }
        await updateBillingAccount(account.id, send);
        router.push(BILLING.account({ id: account.id }));
      } catch (err) {
        // The API's words: it checks the same rules, and says which card could not hold it.
        setSaveError(sentence(err, DETAILS_SAVE_FAILED));
        setBusy(false);
      }
    },
    [account, busy, fields, initial, changes, current, defaults, router],
  );

  const publishableKey = data?.publishable_key ?? null;
  return {
    status,
    error,
    account,
    fields,
    errors,
    addressDefaults: defaults,
    allowedCountries: countries,
    publishableKey,
    addressLocked: Boolean(account && !account.card),
    addressUnavailable: !publishableKey || stripeFailed,
    dirty: Object.keys(changes).length > 0,
    busy,
    saveError,
    setField,
    setAddress: setAddressState,
    addressFailed: useCallback(() => setStripeFailed(true), []),
    save,
    back: useCallback(() => router.push(BILLING.account({ id: accountId })), [router, accountId]),
  };
}
