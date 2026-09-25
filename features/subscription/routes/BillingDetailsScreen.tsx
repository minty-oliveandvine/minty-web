"use client";

/**
 * "Update Billing Information", composed (Figma 08-C): the banner, the form card, and Minty
 * filling a form under it. The frame has no back link above the banner - *Go Back* in the form
 * is the way out, to the account's page (08-B), where *Save billing account* lands too.
 */

import Image from "next/image";

import { BillingDetailsForm } from "@/features/subscription/components/BillingDetailsForm";
import { PortalHero } from "@/features/subscription/components/PortalHero";
import { useBillingDetails } from "@/features/subscription/hooks/useBillingDetails";
import { DETAILS_TITLE } from "@/features/subscription/lib/billingAccounts";

export function BillingDetailsScreen({
  accountId,
  fixture,
}: {
  accountId?: string | null;
  fixture?: string | null;
}) {
  const d = useBillingDetails({ accountId, fixture });

  return (
    <div className="flex flex-col gap-8 pb-16">
      <PortalHero title={DETAILS_TITLE} />

      {d.status === "error" ? (
        <div
          role="alert"
          className="mx-auto flex w-full max-w-[720px] flex-col items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {d.error}
          <button
            type="button"
            onClick={d.back}
            className="rounded-lg border border-rose-300 bg-white px-4 py-1.5 font-semibold"
          >
            Go Back
          </button>
        </div>
      ) : d.status === "loading" ? (
        <p role="status" className="py-6 text-center text-[15px] text-[#8b93a0]">
          Loading…
        </p>
      ) : (
        <BillingDetailsForm
          fields={d.fields}
          errors={d.errors}
          addressDefaults={d.addressDefaults}
          allowedCountries={d.allowedCountries}
          publishableKey={d.publishableKey}
          addressLocked={d.addressLocked}
          addressUnavailable={d.addressUnavailable}
          dirty={d.dirty}
          busy={d.busy}
          saveError={d.saveError}
          onChange={d.setField}
          onAddressChange={d.setAddress}
          onAddressFailed={d.addressFailed}
          onSave={(readAddress) => void d.save(readAddress)}
          onBack={d.back}
        />
      )}

      {/* The file is twice the drawn size (1448x708) for sharp screens; the design draws it at
          724x354, 73px under the card. */}
      <Image
        src="/portal/minty-filling-form.png"
        alt=""
        width={1448}
        height={708}
        unoptimized
        className="mx-auto mt-10 w-full max-w-[724px]"
      />
    </div>
  );
}
