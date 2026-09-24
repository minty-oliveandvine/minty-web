"use client";

/**
 * Stripe's own card form, mounted on a SetupIntent (Figma 08-Y / 08-E).
 *
 * WHAT IS OURS IS THE SCREEN, NOT THE CARD. The number is typed into a Stripe-hosted iframe
 * (`PaymentElement`) and confirmed straight against Stripe with a client secret; it never
 * touches this app's JavaScript, Minty's process, or any log - which is what keeps the
 * application out of PCI scope while the page around it is ours. NOTHING HERE MAY BE CHANGED
 * TO READ A CARD NUMBER. `redirect: "if_required"` keeps the confirmation on this page; the
 * SetupIntent is card-only, so the only redirect left is 3-D Secure, which Stripe runs in its
 * own modal. Ported from billing-frontend's `AddPaymentMethodModal` - the behaviour is that
 * one's, the look is section 08's.
 *
 * After Stripe says yes, `confirmCardSetup` is what makes the card the account's (for a first
 * card it also creates the customer), so it is not optional and its failure is reported here.
 */

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { AddressElement } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe, type StripeAddressElementChangeEvent } from "@stripe/stripe-js";
import { useMemo, useState, type FormEvent } from "react";

import { ApiError } from "@/lib/apiClient";

import {
  confirmCardSetup,
  type PayerPaymentMethods,
  type SetupIntentHandle,
} from "@/features/subscription/api/payerPortal";
import type { SetupIntentState } from "@/features/subscription/hooks/useCardForm";
import { CARD_MANDATE, STRIPE_NOTE } from "@/features/subscription/lib/billing";

export const CARD_SAVE_FAILED =
  "The card was saved with our payment provider, but we couldn't finish adding it. Refresh and check before trying again.";
export const OPENING_CARD_FORM = "Opening the card form…";

/**
 * `loadStripe` per publishable key, at module scope: Stripe.js injects a script tag and
 * rebuilding it mid-flow tears down the mounted iframe. The key comes from the server (Minty
 * knows which Stripe account is configured), so this is a small cache rather than a constant.
 */
const stripeByKey = new Map<string, Promise<Stripe | null>>();

function stripeFor(key: string): Promise<Stripe | null> {
  let promise = stripeByKey.get(key);
  if (!promise) {
    // Resolves to null rather than rejecting when the script cannot be fetched at all - an ad
    // blocker, a privacy extension, a proxy. Left to reject it becomes an unhandled rejection
    // and the form simply sits there with nothing said.
    promise = loadStripe(key).catch(() => null);
    stripeByKey.set(key, promise);
  }
  return promise;
}

function Form({
  setupIntent,
  firstCard,
  onSaved,
  onCancel,
}: {
  setupIntent: string;
  firstCard: boolean;
  onSaved: (methods: PayerPaymentMethods, paymentMethodId: string | null) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [dead, setDead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billing, setBilling] = useState<StripeAddressElementChangeEvent["value"] | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);

    const submitted = await elements.submit();
    if (submitted.error) {
      setError(submitted.error.message ?? "Please check the card details.");
      setBusy(false);
      return;
    }

    const { error: refused, setupIntent: confirmed } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: window.location.href,
        ...(billing
          ? {
              payment_method_data: {
                billing_details: { name: billing.name, address: billing.address },
              },
            }
          : {}),
      },
      redirect: "if_required",
    });
    if (refused) {
      // Stripe's message is written for the cardholder and is the only account of what the
      // issuer actually said, so it is shown as written.
      setError(refused.message ?? "That card couldn't be saved.");
      setBusy(false);
      return;
    }

    try {
      const id = confirmed?.id ?? setupIntent;
      const methods = await confirmCardSetup(id);
      const paymentMethod =
        typeof confirmed?.payment_method === "string"
          ? confirmed.payment_method
          : (confirmed?.payment_method?.id ?? null);
      onSaved(methods, paymentMethod);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : CARD_SAVE_FAILED);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <PaymentElement
        onReady={() => setReady(true)}
        onLoadError={(event) => {
          setDead(true);
          setError(
            event?.error?.message ??
              "The card form couldn't load. If you're running an ad blocker or privacy extension, allow js.stripe.com and try again.",
          );
        }}
        options={{
          layout: "tabs",
          // Stripe's own mandate line names the STRIPE ACCOUNT rather than Minty, so it is
          // suppressed and the sentence below IS the disclosure: the two go together.
          terms: { card: "never" },
          fields: { billingDetails: { name: "never", address: "never" } },
        }}
      />
      <AddressElement
        options={{ mode: "billing", display: { name: "full" } }}
        onChange={(event) => setBilling(event.complete ? event.value : null)}
      />
      {firstCard && (
        <p className="text-[13px] text-[#6b7380]">
          This is the first payment method on your billing account, so it is the one card pickers
          will offer first.
        </p>
      )}
      <p className="text-[13px] leading-relaxed text-[#8b93a0]">
        {CARD_MANDATE} <span className="font-semibold text-[#2e9b9b]">(Details)</span>
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-[#f3c2c2] bg-[#fdf3f3] px-4 py-3 text-[13px] text-[#b42318]"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-[44px] w-[104px] rounded-lg border border-[#d8dee4] bg-white text-[15px] font-semibold text-[#292e38] hover:bg-[#f5f7fa] disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!stripe || !ready || busy || dead}
          className="h-[44px] w-[114px] rounded-lg bg-[#4fc7c7] text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

export function CardCaptureForm({
  handle,
  firstCard,
  onSaved,
  onCancel,
}: {
  handle: SetupIntentHandle;
  firstCard: boolean;
  onSaved: (methods: PayerPaymentMethods, paymentMethodId: string | null) => void;
  onCancel: () => void;
}) {
  const stripe = useMemo(
    () => (handle.publishable_key ? stripeFor(handle.publishable_key) : null),
    [handle.publishable_key],
  );

  if (!stripe || !handle.client_secret) {
    // No key means no form: the API said the account has no Stripe configured (or a fixture is
    // being served), and an empty box would read as a broken page.
    return (
      <p role="status" className="text-[15px] text-[#8b93a0]">
        {STRIPE_NOTE}
      </p>
    );
  }

  return (
    <Elements stripe={stripe} options={{ clientSecret: handle.client_secret }}>
      <Form
        setupIntent={handle.setup_intent}
        firstCard={firstCard}
        onSaved={onSaved}
        onCancel={onCancel}
      />
    </Elements>
  );
}

/**
 * The form with the two states that always surround it: the SetupIntent being opened, and its
 * having failed to open. Here rather than on either screen because there are now two of them —
 * the billing page's 08-Y, and the handover's 07-E, where a card is added mid-accept — and a
 * form that silently renders nothing while an intent is in flight reads as a broken page on
 * both.
 */
export function CardCapturePanel({
  setup,
  onSaved,
  onCancel,
}: {
  setup: SetupIntentState;
  onSaved: (methods: PayerPaymentMethods, paymentMethodId: string | null) => void;
  onCancel: () => void;
}) {
  if (setup.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-[15px] text-[#b42318]">
          {setup.error}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-[44px] w-[104px] rounded-lg border border-[#d8dee4] bg-white text-[15px] font-semibold text-[#292e38]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={setup.retry}
            className="h-[44px] w-[114px] rounded-lg bg-[#4fc7c7] text-[15px] font-semibold text-white"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (setup.status === "loading" || !setup.handle) {
    return (
      <p role="status" className="py-6 text-center text-[15px] text-[#8b93a0]">
        {OPENING_CARD_FORM}
      </p>
    );
  }

  return (
    <CardCaptureForm
      handle={setup.handle}
      firstCard={setup.firstCard}
      onSaved={onSaved}
      onCancel={onCancel}
    />
  );
}
