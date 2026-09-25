"use client";

/**
 * 08-C "Update Billing Information", the form card (Figma `2278:3455`): the billing company and
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

const LABEL = "text-[13px] font-semibold text-[#464e5a]";
const INPUT =
  "h-[46px] w-full rounded-[10px] border-[1.5px] border-[#d6dae0] bg-white px-[14px] text-[15px] text-[#282e38] outline-none placeholder:text-[#ccc] focus:border-[#4fc7c7] disabled:bg-[#f2f4f7] disabled:text-[#8b93a0] aria-[invalid=true]:border-[#dc5a5a]";

/**
 * Stripe's fields in 08-C's look - the same numbers as `INPUT` and `LABEL` above, because they
 * live in a cross-origin iframe no stylesheet of ours reaches. Frozen at module scope: a new
 * object on every render is a changed prop to Stripe.
 */
const DETAILS_APPEARANCE: Appearance = {
  theme: "stripe",
  labels: "above",
  variables: {
    fontFamily: "Inter, system-ui, -apple-system, sans-serif",
    fontSizeBase: "15px",
    colorText: "#282e38",
    colorTextPlaceholder: "#cccccc",
    colorPrimary: "#4fc7c7",
    colorDanger: "#b42318",
    borderRadius: "10px",
    spacingUnit: "4px",
    // The form's own `gap-[18px]` between fields, so Stripe's rows keep our rhythm.
    gridRowSpacing: "18px",
  },
  rules: {
    // 13.5px + a 15px line + 13.5px + two 1.5px edges = the 46px of `INPUT` (measured live:
    // Stripe's default padding drew 43px beside ours).
    ".Input": { border: "1.5px solid #d6dae0", boxShadow: "none", padding: "13.5px 14px" },
    ".Input:focus": { border: "1.5px solid #4fc7c7", boxShadow: "none", outline: "none" },
    ".Label": { fontSize: "13px", fontWeight: "600", color: "#464e5a", marginBottom: "7px" },
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
        <p id={`${id}-error`} className="text-[13px] text-[#b42318]">
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
      className="mx-auto flex w-full max-w-[720px] flex-col gap-[18px] rounded-[16px] border border-[#e9ecf0] bg-white px-8 pb-6 pt-7"
    >
      <Field id="billing-company" label="Billing Company" error={errors.company}>
        <input {...input("company", "(e.g. Vine Consulting Limited)")} autoComplete="organization" />
      </Field>
      <Field id="billing-email" label="Billing email" error={errors.email}>
        <input
          {...input("email", "(e.g. billing@company.com)")}
          type="email"
          autoComplete="email"
        />
      </Field>

      <div className="h-px w-full bg-[#e5ebed]" />
      <p className="text-[12px] font-bold tracking-[0.48px] text-[#828a96]">Address</p>
      {addressLocked ? (
        <p className="text-[13px] text-[#6b7380]">{NO_CARD_FOR_ADDRESS}</p>
      ) : drawn ? (
        // Its own region, because everything in it is Stripe's: an iframe from js.stripe.com
        // that this page cannot read until Save asks.
        <section aria-label="Address (Stripe)" aria-busy={busy || undefined}>
          <Elements stripe={stripe} options={ELEMENTS_OPTIONS}>
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
        <p role="status" className="text-[13px] text-[#6b7380]">
          {ADDRESS_UNAVAILABLE}
        </p>
      )}

      {saveError && (
        <p role="alert" className="text-[13px] text-[#b42318]">
          {saveError}
        </p>
      )}
      <div className="flex w-full items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="rounded-[10px] border-[1.5px] border-[#d6dae0] bg-white px-[22px] py-3 text-[15px] font-semibold text-[#282e38] hover:bg-[#f5f7fa] disabled:opacity-60"
        >
          Go Back
        </button>
        <button
          type="submit"
          disabled={busy || !dirty}
          aria-busy={busy || undefined}
          className="rounded-[10px] bg-[#4fc7c7] px-[22px] py-3 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Saving…" : SAVE_BILLING_ACCOUNT}
        </button>
      </div>
    </form>
  );
}
