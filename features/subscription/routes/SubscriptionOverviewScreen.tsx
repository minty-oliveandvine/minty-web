"use client";

/**
 * "Subscription & Billing" - the portal's landing, composed (Figma 08-A): the way back into
 * Minty, the banner, the payment-method card and the Subscription Overview. `SubscriptionOverview`
 * reads the URL and hands the parameters here; the tests render this directly with fixtures.
 */

import { env } from "@/lib/env";

import {
  PaymentMethodCard,
  SubscriptionOverviewCard,
} from "@/features/subscription/components/BillingOverviewPanels";
import {
  useBillingOverview,
  type UseBillingOverviewArgs,
} from "@/features/subscription/hooks/useBillingOverview";
import { BACK_TO_ENTITIES, OVERVIEW_TITLE } from "@/features/subscription/lib/billing";

export function SubscriptionOverviewScreen(args: UseBillingOverviewArgs) {
  const o = useBillingOverview(args);

  return (
    <div className="flex flex-col gap-6 pb-16">
      <a
        href={`${env.MINTY_URL}/entity`}
        className="self-start text-base text-[var(--ink-soft)] hover:underline"
      >
        {BACK_TO_ENTITIES}
      </a>
      <div className="rounded-[32px] bg-gradient-to-r from-[#18c4c7] via-[#42ccc5] via-[74%] to-[#78d7c5] px-[54px] py-10">
        <h1 className="text-[40px] font-bold leading-none text-white">{OVERVIEW_TITLE}</h1>
      </div>

      {o.status === "error" ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {o.error}
          <button
            type="button"
            onClick={o.reload}
            className="rounded-lg border border-rose-300 bg-white px-4 py-1.5 font-semibold"
          >
            Try again
          </button>
        </div>
      ) : (
        <div
          className="mx-auto flex w-full max-w-[720px] flex-col gap-8"
          aria-busy={o.status === "loading"}
        >
          <PaymentMethodCard next={o.next} onOpen={o.goToBilling} />
          <SubscriptionOverviewCard overview={o.overview} onManage={o.manageSubscriptions} />
        </div>
      )}
    </div>
  );
}
