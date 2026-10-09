"use client";

/**
 * 08-C "Update Billing Information", the form card (Figma `2278:3455`): the billing company and
 * NO required asterisks here, deliberately (2026-10-09): Billing email accepts a blank, and
 * Billing Company is refused only when the account already HAD one - a condition that lives in
 * `validateDetails(fields, initial)`, and `initial` never reaches this component. Marking it
 * unconditionally would lie on a fresh account. The invalid half already works: `errors.company`
 * reddens the field and prints the message when it really is required.
 *
 * email in our own fields, and below a rule the address, in STRIPE'S own address form - styled
 * as drawn where we draw (the 720px card, 46px fields with a 1.5px edge, the grey "Address"
 * caption, *Go Back* and *Save billing account* at the foot) and themed to match where Stripe
 * does.
 *
 * THE ADDRESS IS STRIPE'S `AddressElement` (the user's call, 2026-09-25), not the frame's Hong
 * Kong breakdown (unit, floor, building, street): the address is the billing address of the card
 * the account charges, and Stripe's form asks for exactly what that country's addresses need (a
 * postcode where there is one), checks it and autocompletes it. It opens on what the card holds,
 * offers only the registry's countries (the API refuses any other), and asks for the
 * cardholder's name with it - which is saved onto the card too, so the field does something.
 * Nothing typed there passes through this app until Save asks it for its checked value.
 *
 * A *Billing email* field under the company, which the frame lacks: 08-B prints the account's
 * billing email, and without it here nothing could correct one typed wrong.
 *
 * The hook owns the values and the rules (`useBillingDetails`); this draws them.
 */

import { AddressElement, Elements, useElements } from "@stripe/react-stripe-js";
import type {
  Appearance,
  StripeAddressElementChangeEvent,
  StripeAddressElementOptions,
} from "@stripe/stripe-js";
import { useImperativeHandle, useMemo, useRef, type ReactNode, type Ref } from "react";

import {
  ADDRESS_UNAVAILABLE,
  NO_CARD_FOR_ADDRESS,
  SAVE_BILLING_ACCOUNT,
  cardAddress,
  type CardAddress,
  type DetailsErrors,
  type DetailsFields,
  type ReadAddress,
} from "@/features/subscription/lib/billingAccounts";
import { stripeFor } from "@/features/subscription/lib/stripe";
import { EMAIL_ASCII_HINT, useEmailInput } from "@/lib/emailInput";

const LABEL = "text-label font-semibold text-ink";
const INPUT =
  "h-[46px] w-full rounded-xl border-[1.5px] border-line-input bg-card px-3.5 text-body-m text-ink outline-none placeholder:text-ink-muted focus:border-line-selected disabled:bg-sunk disabled:text-ink-disabled aria-[invalid=true]:border-danger";

/**
 * Stripe's fields in 08-C's look - the same numbers as `INPUT` and `LABEL` above, because they
 * live in a cross-origin iframe no stylesheet of ours reaches. Frozen at module scope: a new
 * object on every render is a changed prop to Stripe.
 */
// Literals that mirror the --mv2-* tokens in app/globals.css (text-primary, text-muted,
// danger-ink, border-input, border-focus): the iframe cannot read our CSS variables.
const DETAILS_APPEARANCE: Appearance = {
  theme: "stripe",
  labels: "above",
  variables: {
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    fontSizeBase: "15px",
    colorText: "#242828",
    colorTextPlaceholder: "#676F6F",
    colorPrimary: "#19676B",
    colorDanger: "#A82A2F",
    borderRadius: "12px",
    spacingUnit: "4px",
    // The form's own `gap-[18px]` between fields, so Stripe's rows keep our rhythm.
    gridRowSpacing: "18px",
  },
  rules: {
    // 13.5px + a 15px line + 13.5px + two 1.5px edges = the 46px of `INPUT` (measured live:
    // Stripe's default padding drew 43px beside ours).
    ".Input": { border: "1.5px solid #848C8C", boxShadow: "none", padding: "13.5px 14px" },
    ".Input:focus": { border: "1.5px solid #19676B", boxShadow: "0 0 0 2px #19676B", outline: "none" },
    ".Label": { fontSize: "14px", fontWeight: "500", color: "#242828", marginBottom: "7px" },
  },
};
const ELEMENTS_OPTIONS = { appearance: DETAILS_APPEARANCE };

type AddressHandle = { read: ReadAddress };

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-body-s text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Stripe's address form, and the one thing Save needs from it: its CHECKED value.
 * `getValue()` makes Stripe mark every field it will not accept and answers `complete` - so an
 * address it refuses is never sent, and what is sent is what it holds, not what we last heard.
 */
function StripeAddress({
  ref,
  defaults,
  countries,
  onChange,
  onLoadError,
}: {
  ref: Ref<AddressHandle>;
  defaults: CardAddress;
  countries: string[] | null;
  onChange: (value: CardAddress) => void;
  onLoadError: () => void;
}) {
  const elements = useElements();
  useImperativeHandle(
    ref,
    () => ({
      read: async () => {
        const element = elements?.getElement("address");
        if (!element) return null;
        const { complete, value } = await element.getValue();
        return complete ? cardAddress(value.name, value.address) : null;
      },
    }),
    [elements],
  );
  const options = useMemo<StripeAddressElementOptions>(
    () => ({
      mode: "billing",
      display: { name: "full" },
      ...(countries ? { allowedCountries: countries } : {}),
      // Stripe's address needs a country to exist at all; a card saved with none opens on the
      // name alone, and Stripe's own country (the browser's) under it.
      defaultValues: defaults.address.country
        ? { name: defaults.name, address: defaults.address }
        : { name: defaults.name },
    }),
    [defaults, countries],
  );
  return (
    <AddressElement
      options={options}
      onChange={(event: StripeAddressElementChangeEvent) =>
        onChange(cardAddress(event.value.name, event.value.address))
      }
      onLoadError={onLoadError}
    />
  );
}

export function BillingDetailsForm({
  fields,
  errors,
  addressDefaults,
  allowedCountries,
  publishableKey,
  addressLocked,
  addressUnavailable,
  resetNonce,
  dirty,
  busy,
  saveError,
  onChange,
  onAddressChange,
  onAddressFailed,
  onSave,
  onBack,
}: {
  fields: DetailsFields;
  errors: DetailsErrors;
  /** What Stripe's form opens on; null when the account charges no card. */
  addressDefaults: CardAddress | null;
  allowedCountries: string[] | null;
  publishableKey: string | null;
  /** The account has no card to keep an address on. */
  addressLocked: boolean;
  /** Stripe's form cannot be drawn here. */
  addressUnavailable: boolean;
  /** Changes when the details are discarded: Stripe's fields are drawn again (see the hook). */
  resetNonce: number;
  dirty: boolean;
  busy: boolean;
  saveError: string | null;
  onChange: (field: keyof DetailsFields, value: string) => void;
  onAddressChange: (value: CardAddress) => void;
  onAddressFailed: () => void;
  onSave: (readAddress: ReadAddress) => void;
  onBack: () => void;
}) {
  const stripe = useMemo(
    () => (publishableKey ? stripeFor(publishableKey) : null),
    [publishableKey],
  );
  const addressRef = useRef<AddressHandle>(null);
  const emailInput = useEmailInput((value) => onChange("email", value));
  const emailError = errors.email ?? (emailInput.rejected ? EMAIL_ASCII_HINT : undefined);
  const drawn = !addressLocked && !addressUnavailable && stripe && addressDefaults;

  const input = (field: keyof DetailsFields, placeholder: string) => ({
    id: `billing-${field}`,
    value: fields[field],
    placeholder,
    disabled: busy,
    onChange: (e: { target: { value: string } }) => onChange(field, e.target.value),
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `billing-${field}-error` : undefined,
    className: INPUT,
  });

  return (
    <form
      aria-label="Billing information"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSave(async () => (addressRef.current ? addressRef.current.read() : null));
      }}
      className="flex w-full flex-col gap-4 rounded-xl border border-line bg-card p-4 sm:p-5"
    >
      <Field id="billing-company" label="Billing Company" error={errors.company}>
        <input {...input("company", "(e.g. Vine Consulting Limited)")} autoComplete="organization" />
      </Field>
      <Field id="billing-email" label="Billing email" error={emailError}>
        <input
          {...input("email", "(e.g. billing@company.com)")}
          {...emailInput.props}
          aria-describedby={emailError ? "billing-email-error" : undefined}
        />
      </Field>

      <div className="h-px w-full bg-line-subtle" />
      <p className="text-label font-bold tracking-[0.48px] text-ink-muted">Address</p>
      {addressLocked ? (
        <p className="text-body-s text-ink-2">{NO_CARD_FOR_ADDRESS}</p>
      ) : drawn ? (
        // Its own region, because everything in it is Stripe's: an iframe from js.stripe.com
        // that this page cannot read until Save asks.
        <section aria-label="Address (Stripe)" aria-busy={busy || undefined}>
          {/* Keyed on the discard counter: Stripe reads `defaultValues` at mount only, so this
              is the one way to put its fields back. */}
          <Elements key={resetNonce} stripe={stripe} options={ELEMENTS_OPTIONS}>
            <StripeAddress
              ref={addressRef}
              defaults={drawn}
              countries={allowedCountries}
              onChange={onAddressChange}
              onLoadError={onAddressFailed}
            />
          </Elements>
        </section>
      ) : (
        <p role="status" className="text-body-s text-ink-2">
          {ADDRESS_UNAVAILABLE}
        </p>
      )}

      {saveError && (
        <p role="alert" className="text-body-s text-danger">
          {saveError}
        </p>
      )}
      <div className="flex w-full items-center justify-end gap-3 pt-2 max-sm:flex-col-reverse max-sm:items-stretch max-sm:[&>*]:w-full">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="h-11 rounded-xl border border-line-selected bg-card px-4 text-body-m font-semibold text-link hover:bg-selected disabled:opacity-60"
        >
          Go Back
        </button>
        <button
          type="submit"
          disabled={busy || !dirty}
          aria-busy={busy || undefined}
          className="h-11 rounded-xl bg-action px-4 text-body-m font-semibold text-white hover:bg-action-hover active:bg-action-pressed disabled:bg-action-disabled disabled:text-ink-disabled"
        >
          {busy ? "Saving…" : SAVE_BILLING_ACCOUNT}
        </button>
      </div>
    </form>
  );
}
