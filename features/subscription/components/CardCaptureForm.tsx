"use client";

/**
 * Stripe's own card form, mounted on a SetupIntent - in two looks:
 *
 * - "page" (Figma 08-Y / 08-E, a card added to one billing account): the fields in a column, the first-card
 *   note, the mandate, Cancel and Save at the right. Ported from minty-payment-request-web's
 *   `AddPaymentMethodModal` - the behaviour is that one's, the look is section 08's.
 * - "sheet" (onboarding's 01-D, the New billing account form inside the billing-account sheet):
 *   the caller's fields above, the card fields in their own bordered "Payment method" block
 *   themed with onboarding's `STRIPE_APPEARANCE`, the mandate, and Cancel beside a wide *Save
 *   billing account* - onboarding's `BillingSheet` form, the same act in two apps.
 *
 * WHAT IS OURS IS THE SCREEN, NOT THE CARD. The number is typed into a Stripe-hosted iframe
 * (`PaymentElement`) and confirmed straight against Stripe with a client secret; it never
 * touches this app's JavaScript, Minty's process, or any log - which is what keeps the
 * application out of PCI scope while the page around it is ours. NOTHING HERE MAY BE CHANGED
 * TO READ A CARD NUMBER. `redirect: "if_required"` keeps the confirmation on this page; the
 * SetupIntent is card-only, so the only redirect left is 3-D Secure, which Stripe runs in its
 * own modal.
 *
 * After Stripe says yes, `confirmCardSetup` is what makes the card the account's (for a first
 * card it also creates the customer), so it is not optional and its failure is reported here -
 * as is a failure in whatever the caller does next (`onSaved` is awaited).
 */

import {
  AddressElement,
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type {
  Appearance,
  StripeAddressElementChangeEvent,
  StripeAddressElementOptions,
  StripePaymentElementOptions,
} from "@stripe/stripe-js";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { ApiError } from "@/lib/apiClient";

import {
  NO_ACCOUNT_FOR_CARD,
  confirmCardSetup,
  namesAnAccount,
  type BillingAccountChoice,
  type ConfirmedCard,
  type SetupIntentHandle,
} from "@/features/subscription/api/payerPortal";
import {
  SHEET_ERROR,
  SHEET_FIELD,
  SHEET_GHOST,
  SHEET_LABEL,
  SHEET_LOADING,
  SHEET_PAIR,
  SHEET_PAIR_BACK,
  SHEET_PAIR_MAIN,
  SHEET_PRIMARY,
} from "@/components/ui/sheetClasses";
import type { SetupIntentState } from "@/features/subscription/hooks/useCardForm";
import { CARD_MANDATE, STRIPE_NOTE } from "@/features/subscription/lib/billing";
import { SAVE_BILLING_ACCOUNT } from "@/features/subscription/lib/billingAccounts";
import { STRIPE_FONTS, stripeFor } from "@/features/subscription/lib/stripe";

export const CARD_SAVE_FAILED =
  "The card was saved with our payment provider, but we couldn't finish adding it. Refresh and check before trying again.";
export const OPENING_CARD_FORM = "Opening the card form…";
const CARD_FORM_DEAD =
  "The card form couldn't load. If you're running an ad blocker or privacy extension, allow js.stripe.com and try again.";

/** Which of the two forms to draw - the billing page's, or onboarding's sheet. */
export type CardFormLook = "page" | "sheet";

/**
 * The sheet's Elements theme - onboarding's `STRIPE_APPEARANCE`, verbatim, so the card fields
 * are the fields the design draws. The ONLY legitimate way to style them: they live in a
 * cross-origin iframe no stylesheet of ours reaches. Frozen at module scope, as are the options
 * below - a new object identity on every render is a changed prop to Stripe.
 */
// Literals that mirror the --mv2-* tokens in app/globals.css (text-primary, text-muted,
// danger-ink, border-input, border-focus): the iframe cannot read our CSS variables.
const SHEET_APPEARANCE: Appearance = {
  theme: "stripe",
  variables: {
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    fontSizeBase: "14px",
    colorText: "#242828",
    colorTextPlaceholder: "#676F6F",
    colorPrimary: "#19676B",
    colorDanger: "#A82A2F",
    borderRadius: "12px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { border: "1px solid #848C8C", boxShadow: "none", padding: "12px 14px" },
    ".Input:focus": {
      border: "1px solid #19676B",
      boxShadow: "0 0 0 2px #19676B",
      outline: "none",
    },
    ".Label": { fontWeight: "500", fontSize: "14px", color: "#242828" },
  },
};

const PAYMENT_ELEMENT_OPTIONS: StripePaymentElementOptions = {
  layout: "tabs",
  // Stripe's own mandate line names the STRIPE ACCOUNT rather than Minty, so it is suppressed
  // and the sentence under the fields IS the disclosure: the two go together.
  terms: { card: "never" },
  // The name and address are the AddressElement's; left on, the payer fills them twice.
  fields: { billingDetails: { name: "never", address: "never" } },
};
const ADDRESS_ELEMENT_OPTIONS: StripeAddressElementOptions = {
  mode: "billing",
  display: { name: "full" },
};

/**
 * The address form starting on `country` when there is one - left to itself Stripe guesses from
 * the browser's location, so a Hong Kong payer on a US-set browser met "United States". Stable
 * per country: a new options object each render would have Stripe update the element each time.
 * Anything but an ISO alpha-2 code leaves Stripe's guess alone.
 */
function useAddressOptions(country?: string | null): StripeAddressElementOptions {
  return useMemo(
    () =>
      country && /^[A-Z]{2}$/.test(country)
        ? { ...ADDRESS_ELEMENT_OPTIONS, defaultValues: { address: { country } } }
        : ADDRESS_ELEMENT_OPTIONS,
    [country],
  );
}

/** What the screens around the form may add to it (the new billing account's two fields). */
export type CardFormExtras = {
  /**
   * Drawn above the card fields, inside the same form. `busy` is true while a save is in
   * flight: the fields are disabled then, so what `beforeConfirm` checked is what is sent.
   */
  fields?: (busy: boolean) => ReactNode;
  /**
   * Checked BEFORE Stripe is touched - false stops the submit. ORDER IS THE POINT:
   * `confirmSetup` attaches the card at Stripe and nothing here can undo it, so a field refused
   * afterwards would leave a real card saved against no billing account (onboarding's 01-D
   * rule, the same act in two apps).
   */
  beforeConfirm?: () => boolean;
  /**
   * Which billing account the confirmed card goes on - or the one it opens. Without one, Save is
   * refused before Stripe is touched: no card is ever saved unattached to an account.
   */
  account?: BillingAccountChoice | null;
  /** Told when a save starts, and when it stops without the form going away (it failed). */
  onBusy?: (busy: boolean) => void;
  /** Where the address starts (ISO alpha-2): the account's own country, when one is known. */
  country?: string | null;
};

type SavedCallback = (
  confirmed: ConfirmedCard,
  paymentMethodId: string | null,
) => void | Promise<void>;

type FormProps = {
  setupIntent: string;
  firstCard: boolean;
  onSaved: SavedCallback;
  onCancel: () => void;
} & CardFormExtras;

type LoadError = { error?: { message?: string } } | undefined;

/**
 * The submit both looks share, in the only order that is safe: our own checks, then Stripe's
 * (`elements.submit`), then `stripe.confirmSetup`, then Minty (`confirmCardSetup`), then the
 * caller. It lives inside `<Elements>` (Stripe's hooks work nowhere else).
 */
function useCardConfirm({ setupIntent, onSaved, beforeConfirm, account, onBusy }: FormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusyState] = useState(false);
  const [ready, setReady] = useState(false);
  const [dead, setDead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billing, setBilling] = useState<StripeAddressElementChangeEvent["value"] | null>(null);
  // THE CARD STRIPE ALREADY HOLDS, once it does. When Stripe said yes and our own confirm then
  // failed, a second submit must not confirm the intent again - Stripe refuses a SetupIntent
  // that has already succeeded, and the payer would be stuck in front of a card that exists.
  const [confirmed, setConfirmed] = useState<{ id: string; card: string | null } | null>(null);

  const setBusy = (next: boolean) => {
    setBusyState(next);
    onBusy?.(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || busy) return;
    if (beforeConfirm && !beforeConfirm()) return;
    // A card goes on a billing account or nowhere: refused BEFORE Stripe attaches it, loudly.
    if (!namesAnAccount(account)) {
      setError(NO_ACCOUNT_FOR_CARD);
      return;
    }
    setBusy(true);
    setError(null);

    let held = confirmed;
    if (!held) {
      const submitted = await elements.submit();
      if (submitted.error) {
        setError(submitted.error.message ?? "Please check the card details.");
        setBusy(false);
        return;
      }

      const { error: refused, setupIntent: intent } = await stripe.confirmSetup({
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
      held = {
        id: intent?.id ?? setupIntent,
        card:
          typeof intent?.payment_method === "string"
            ? intent.payment_method
            : (intent?.payment_method?.id ?? null),
      };
      setConfirmed(held);
    }

    try {
      const saved = await confirmCardSetup(held.id, false, account);
      await onSaved(saved, held.card);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : CARD_SAVE_FAILED);
      setBusy(false);
    }
  };

  return {
    busy,
    error,
    canSubmit: Boolean(stripe) && ready && !busy && !dead,
    submit,
    onReady: () => setReady(true),
    onLoadError: (event: LoadError) => {
      setDead(true);
      setError(event?.error?.message ?? CARD_FORM_DEAD);
    },
    onAddressChange: (event: StripeAddressElementChangeEvent) =>
      setBilling(event.complete ? event.value : null),
  };
}

/** 08-Y / 08-E / 07-E. */
function PageForm(props: FormProps) {
  const form = useCardConfirm(props);
  const addressOptions = useAddressOptions(props.country);
  return (
    <form onSubmit={form.submit} className="flex flex-col gap-4">
      {props.fields?.(form.busy)}
      <PaymentElement
        onReady={form.onReady}
        onLoadError={form.onLoadError}
        options={PAYMENT_ELEMENT_OPTIONS}
      />
      <AddressElement options={addressOptions} onChange={form.onAddressChange} />
      {props.firstCard && (
        <p className="text-body-s text-ink-2">
          This is the first payment method on your billing account, so it is the one card pickers
          will offer first.
        </p>
      )}
      <p className="text-body-s leading-relaxed text-ink-2">
        {CARD_MANDATE}
      </p>
      {form.error && (
        <p
          role="alert"
          className="rounded-xl border border-transparent bg-danger-bg px-4 py-3 text-body-s text-danger"
        >
          {form.error}
        </p>
      )}
      <div className="flex justify-end gap-3 max-sm:flex-col-reverse max-sm:[&>*]:w-full">
        <button
          type="button"
          onClick={props.onCancel}
          disabled={form.busy}
          className="h-11 rounded-xl border border-line-selected bg-card px-4 text-body-m font-semibold text-link hover:bg-selected disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!form.canSubmit}
          className="h-11 rounded-xl bg-action px-4 text-body-m font-semibold text-white hover:bg-action-hover active:bg-action-pressed disabled:bg-action-disabled disabled:text-ink-disabled"
        >
          {form.busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}

/**
 * Onboarding's 01-D. `noValidate` turns off the BROWSER'S validation bubbles, not ours: the
 * caller's inputs keep `required` for assistive tech, and their messages are drawn under them.
 */
function SheetForm(props: FormProps) {
  const form = useCardConfirm(props);
  const addressOptions = useAddressOptions(props.country);
  return (
    <form onSubmit={form.submit} noValidate className="mt-1">
      {props.fields?.(form.busy)}
      {/* The card fields in their own bordered block: the honest boundary - everything in it
          is rendered by Stripe, in Stripe's iframe, and never reaches this app. */}
      <div className={SHEET_FIELD}>
        <span className={SHEET_LABEL}>
            Payment method
            <RequiredMark />
          </span>
        <div className="rounded-xl border border-line p-4">
          <PaymentElement
            onReady={form.onReady}
            onLoadError={form.onLoadError}
            options={PAYMENT_ELEMENT_OPTIONS}
          />
          <div className="mt-4">
            <AddressElement options={addressOptions} onChange={form.onAddressChange} />
          </div>
        </div>
      </div>
      <p className="mt-6 text-label leading-normal text-ink-muted [overflow-wrap:anywhere]">
        {CARD_MANDATE}
      </p>
      {form.error && (
        <p role="alert" className={SHEET_ERROR}>
          {form.error}
        </p>
      )}
      <div className={SHEET_PAIR}>
        <button
          type="button"
          onClick={props.onCancel}
          disabled={form.busy}
          className={`${SHEET_GHOST} ${SHEET_PAIR_BACK}`}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!form.canSubmit}
          aria-busy={form.busy || undefined}
          className={`${SHEET_PRIMARY} ${SHEET_PAIR_MAIN}`}
        >
          {form.busy ? "Saving…" : SAVE_BILLING_ACCOUNT}
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
  look = "page",
  ...extras
}: {
  handle: SetupIntentHandle;
  firstCard: boolean;
  onSaved: SavedCallback;
  onCancel: () => void;
  look?: CardFormLook;
} & CardFormExtras) {
  const stripe = useMemo(
    () => (handle.publishable_key ? stripeFor(handle.publishable_key) : null),
    [handle.publishable_key],
  );
  const options = useMemo(
    () =>
      look === "sheet"
        ? // `fonts` goes with the appearance: it is what actually delivers the Inter the
          // appearance asks for (see STRIPE_FONTS). The page look names no face, so it needs none.
          { clientSecret: handle.client_secret, appearance: SHEET_APPEARANCE, fonts: STRIPE_FONTS }
        : { clientSecret: handle.client_secret },
    [look, handle.client_secret],
  );

  if (!stripe || !handle.client_secret) {
    // No key means no form: the API said the account has no Stripe configured (or a fixture is
    // being served), and an empty box would read as a broken page.
    return (
      <p
        role="status"
        className={look === "sheet" ? SHEET_LOADING : "text-body-l text-ink-muted"}
      >
        {STRIPE_NOTE}
      </p>
    );
  }

  const Form = look === "sheet" ? SheetForm : PageForm;
  return (
    <Elements stripe={stripe} options={options}>
      <Form
        setupIntent={handle.setup_intent}
        firstCard={firstCard}
        onSaved={onSaved}
        onCancel={onCancel}
        {...extras}
      />
    </Elements>
  );
}

/**
 * The form with the two states that always surround it: the SetupIntent being opened, and its
 * having failed to open. Here rather than on any one screen because two mount it - the
 * billing page's 08-Y (a card added to one account) and the billing-account sheet (a card that
 * opens one, wherever the sheet is asked from - 08-A, Manage Subscriptions, the handover's
 * 07-E) - and a form that silently renders nothing while an intent is in flight reads as a
 * broken page on both.
 */
export function CardCapturePanel({
  setup,
  onSaved,
  onCancel,
  look = "page",
  ...extras
}: {
  setup: SetupIntentState;
  onSaved: SavedCallback;
  onCancel: () => void;
  look?: CardFormLook;
} & CardFormExtras) {
  if (setup.status === "error") {
    if (look === "sheet") {
      return (
        <div>
          <p role="alert" className={SHEET_ERROR}>
            {setup.error}
          </p>
          <div className={SHEET_PAIR}>
            <button
              type="button"
              onClick={onCancel}
              className={`${SHEET_GHOST} ${SHEET_PAIR_BACK}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={setup.retry}
              className={`${SHEET_PRIMARY} ${SHEET_PAIR_MAIN}`}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-body-l text-danger">
          {setup.error}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-xl border border-line-selected bg-card px-4 text-body-m font-semibold text-link hover:bg-selected"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={setup.retry}
            className="h-11 rounded-xl bg-action px-4 text-body-m font-semibold text-white hover:bg-action-hover active:bg-action-pressed"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (setup.status === "loading" || !setup.handle) {
    return (
      <p
        role="status"
        className={
          look === "sheet" ? SHEET_LOADING : "py-6 text-center text-body-l text-ink-muted"
        }
      >
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
      look={look}
      {...extras}
    />
  );
}
