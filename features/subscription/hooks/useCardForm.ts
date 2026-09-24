"use client";

/**
 * The billing page's two card screens (Figma 08-Y "Add a card" and 08-D "Edit card details").
 *
 * ADDING (`useAddCard`) is three server trips in this order, and the last is not optional:
 *   1. `startCardSetup` - a SetupIntent, opened with no customer when the payer has none, so
 *      abandoning the screen leaves nothing behind;
 *   2. `stripe.confirmSetup` - the browser to Stripe, DIRECTLY. The number is typed into
 *      Stripe's own iframe and never reaches this app, Minty, or any log. That is what keeps
 *      us out of PCI scope, and nothing here may be changed to read a card number;
 *   3. `confirmCardSetup` - Minty finds out what happened. For a FIRST card this is what
 *      creates the customer and attaches the method; skip it and the card is saved to nothing.
 * Step 2 lives in `components/CardCaptureForm.tsx` (it needs Stripe's Elements); this hook owns
 * 1 and 3 and where the screen goes afterwards - back to the billing page with `?added=<card>`,
 * which is what draws 08-N / 08-S.
 *
 * EDITING (`useEditCard`) changes only what Stripe allows to change on a saved card: the name
 * on it and its expiry. A different NUMBER is a different payment method, which is why the
 * design says "To use a different number, add a new card" and the number field is disabled.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/apiClient";

import {
  fetchPaymentMethods,
  startCardSetup,
  updatePaymentMethod,
  type PayerPaymentMethods,
  type SavedPaymentMethod,
  type SetupIntentHandle,
} from "@/features/subscription/api/payerPortal";
import { BILLING, PORTAL } from "@/features/subscription/lib/paths";

export const SETUP_FAILED = "The card form didn’t open. Mind trying again?";
export const CARD_NOT_FOUND = "That card isn’t on your billing account.";
export const SAVE_FAILED = "That didn’t save. Mind trying again?";

function sentence(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export type SetupIntentState = {
  status: "loading" | "ready" | "error";
  error: string | null;
  /** The SetupIntent the form mounts against; one per visit, never re-opened under the form. */
  handle: SetupIntentHandle | null;
  /** True when this is the first card: the server makes a first card the default by itself. */
  firstCard: boolean;
  retry: () => void;
};

/**
 * Step 1 on its own — opening a SetupIntent and asking whether this is the account's first card.
 *
 * Shared, because the card form is no longer only the billing page's: the handover's accept
 * screen mounts it too (07-E), so that someone offered a company they cannot yet be charged for
 * can save a card without leaving the offer. What differs between the two is only where the
 * screen goes afterwards, which is the caller's.
 *
 * `enabled` exists for that second caller: the accept screen mounts this hook long before the
 * person asks to add a card, and opening a SetupIntent for everyone who merely READ an offer
 * would leave a trail of abandoned intents on the account.
 */
export function useSetupIntent({
  enabled = true,
  fixture,
}: { enabled?: boolean; fixture?: string | null } = {}): SetupIntentState {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState<SetupIntentHandle | null>(null);
  const [firstCard, setFirstCard] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    (async () => {
      try {
        if (process.env.NODE_ENV !== "production" && fixture) {
          // Dev only: the screen around the form, without opening a real SetupIntent.
          setHandle({ client_secret: "", publishable_key: "", setup_intent: "seti_fixture" });
          setFirstCard(fixture === "H");
          setStatus("ready");
          return;
        }
        // The wallet says whether this is the first card; it must not stop the form opening.
        const [opened, wallet] = await Promise.all([
          startCardSetup(),
          fetchPaymentMethods().catch(() => null),
        ]);
        if (!live) return;
        setHandle(opened);
        // A wallet that could not be read is UNKNOWN, not empty: the line only claims a first
        // card when the server actually said the account has none.
        setFirstCard(wallet ? wallet.methods.length === 0 : false);
        setError(null);
        setStatus("ready");
      } catch (err) {
        if (!live) return;
        setError(sentence(err, SETUP_FAILED));
        setStatus("error");
      }
    })();
    return () => {
      live = false;
    };
  }, [enabled, fixture, generation]);

  return {
    status,
    error,
    handle,
    firstCard,
    retry: useCallback(() => {
      setStatus("loading");
      setGeneration((g) => g + 1);
    }, []),
  };
}

export type UseAddCardResult = SetupIntentState & {
  /** Step 3: what the form calls once Stripe has the card. */
  saved: (methods: PayerPaymentMethods, paymentMethodId: string | null) => void;
  cancel: () => void;
};

export function useAddCard({ fixture }: { fixture?: string | null } = {}): UseAddCardResult {
  const router = useRouter();
  const opened = useSetupIntent({ fixture });

  const saved = useCallback(
    (methods: PayerPaymentMethods, paymentMethodId: string | null) => {
      // The id Stripe confirmed, else the newest card the server now holds - the billing page
      // needs one to name in 08-N / 08-S, and "the card that wasn't there before" is it.
      const id = paymentMethodId ?? methods.methods.at(-1)?.id ?? "";
      router.push(id ? BILLING.added(id) : PORTAL.billing);
    },
    [router],
  );

  return {
    ...opened,
    saved,
    cancel: useCallback(() => router.push(PORTAL.billing), [router]),
  };
}

export type CardFields = { name: string; expMonth: string; expYear: string };

export type UseEditCardResult = {
  status: "loading" | "ready" | "error";
  error: string | null;
  card: SavedPaymentMethod | null;
  fields: CardFields;
  setField: (field: keyof CardFields, value: string) => void;
  dirty: boolean;
  busy: boolean;
  saveError: string | null;
  save: () => Promise<void>;
  cancel: () => void;
};

/** "12 / 27" - the two boxes the design draws as one field. */
export function expiryText(fields: CardFields): string {
  return `${fields.expMonth} / ${fields.expYear}`;
}

export function useEditCard({
  cardId,
  fixture,
}: {
  cardId?: string | null;
  fixture?: string | null;
}): UseEditCardResult {
  const router = useRouter();
  const [loaded, setLoaded] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [card, setCard] = useState<SavedPaymentMethod | null>(null);
  const [fields, setFields] = useState<CardFields>({ name: "", expMonth: "", expYear: "" });
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // No card in the URL is not a failed read - it is a screen opened without a subject, which
  // the effect below never runs for (derived here so nothing is set during a render).
  const status = cardId ? loaded : "error";
  const error = cardId ? loadError : CARD_NOT_FOUND;

  useEffect(() => {
    if (!cardId) return;
    let live = true;
    (async () => {
      try {
        let wallet: PayerPaymentMethods;
        if (process.env.NODE_ENV !== "production" && fixture) {
          const f = await import("@/features/subscription/__fixtures__/billing");
          wallet = f.isBillingFixture(fixture) ? f.BILLING_FIXTURES[fixture] : f.WALLET_TWO;
        } else {
          wallet = await fetchPaymentMethods();
        }
        if (!live) return;
        const found = wallet.methods.find((m) => m.id === cardId) ?? null;
        if (!found) {
          setLoadError(CARD_NOT_FOUND);
          setLoaded("error");
          return;
        }
        setCard(found);
        setFields({
          name: found.cardholder ?? "",
          expMonth: found.exp_month ? String(found.exp_month).padStart(2, "0") : "",
          expYear: found.exp_year ? String(found.exp_year).slice(-2) : "",
        });
        setLoadError(null);
        setLoaded("ready");
      } catch (err) {
        if (!live) return;
        setLoadError(sentence(err, SAVE_FAILED));
        setLoaded("error");
      }
    })();
    return () => {
      live = false;
    };
  }, [cardId, fixture]);

  const setField = useCallback((field: keyof CardFields, value: string) => {
    setFields((f) => ({
      ...f,
      [field]: field === "name" ? value : value.replace(/\D/g, "").slice(0, 2),
    }));
  }, []);

  const dirty = useMemo(() => {
    if (!card) return false;
    const month = card.exp_month ? String(card.exp_month).padStart(2, "0") : "";
    const year = card.exp_year ? String(card.exp_year).slice(-2) : "";
    return (
      fields.name !== (card.cardholder ?? "") ||
      fields.expMonth !== month ||
      fields.expYear !== year
    );
  }, [card, fields]);

  const save = useCallback(async () => {
    if (!card || busy) return;
    setBusy(true);
    setSaveError(null);
    try {
      const month = Number(fields.expMonth);
      const year = Number(fields.expYear);
      await updatePaymentMethod(card.id, {
        name: fields.name,
        // A two-digit year is this century's: Stripe wants the full one.
        ...(month >= 1 && month <= 12 && year > 0
          ? { exp_month: month, exp_year: year < 100 ? 2000 + year : year }
          : {}),
      });
      router.push(PORTAL.billing);
    } catch (err) {
      setSaveError(sentence(err, SAVE_FAILED));
      setBusy(false);
    }
  }, [card, fields, busy, router]);

  return {
    status,
    error,
    card,
    fields,
    setField,
    dirty,
    busy,
    saveError,
    save,
    cancel: useCallback(() => router.push(PORTAL.billing), [router]),
  };
}
