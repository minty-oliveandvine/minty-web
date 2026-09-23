"use client";

/**
 * The portal's landing, drawn (Figma 08-A "Subscription & Billing"): the payment-method card -
 * who the bill goes to, when it next goes out, and the way through to the billing page - and
 * the Subscription Overview beside Minty counting the cash: how many companies are being paid
 * for, how many trials end soon, a line per company that needs the payer to know something,
 * and *Manage Subscription*. Everything shown is the hook's (`useBillingOverview`).
 */

import Image from "next/image";

import {
  ACTIVE_SUBSCRIPTIONS,
  BILL_TO,
  GO_TO_BILLING,
  MANAGE_SUBSCRIPTION,
  NOTHING_TO_UPDATE,
  SUBSCRIPTION_OVERVIEW,
  SUBSCRIPTION_UPDATES,
  TRIAL_ENDING,
  UPDATES_SHOWN,
  entityCount,
  moreUpdates,
  type NextBilling,
  type Overview,
  type OverviewUpdate,
} from "@/features/subscription/lib/billing";

const CARD =
  "rounded-xl border border-[#eef1f4] bg-white px-10 py-9 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.06)]";

/** The first card: the account's billing at a glance, and the way to the details. */
export function PaymentMethodCard({ next, onOpen }: { next: NextBilling; onOpen: () => void }) {
  return (
    <section aria-label="Payment Method" className={`${CARD} flex flex-col gap-5`}>
      <p className="text-[15px] text-[#a0a8b2]">Payment Method</p>
      <h2 className="text-[19px] font-bold text-[#16202e]">
        Manage Billing Details and Payment Methods
      </h2>
      <div className="flex flex-wrap gap-x-16 gap-y-5">
        <div className="min-w-0">
          <p className="text-[17px] font-bold text-[#16202e]">{BILL_TO}</p>
          <p className="mt-2 truncate text-[17px] text-[#16202e]">{next.billTo || "—"}</p>
        </div>
        <div>
          <p className="text-[17px] font-bold text-[#16202e]">Next Billing Date</p>
          <p className="mt-2 text-[17px] text-[#16202e]">{next.date ?? "—"}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="self-end text-[15px] text-[#16202e] underline underline-offset-4 hover:text-[#2e9b9b]"
      >
        {GO_TO_BILLING} ›
      </button>
    </section>
  );
}

function UpdateLine({ update }: { update: OverviewUpdate }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1" data-tone={update.tone}>
      <span className="w-[150px] shrink-0 truncate text-[13px] text-[#a0a8b2]">
        {update.entityName}
      </span>
      {update.module && (
        <span className="text-[13px] font-bold text-[#16202e]">{update.module}</span>
      )}
      <span className={`text-[13px] ${update.tone === "failed" ? "font-bold text-[#e5484d]" : ""}`}>
        {update.text}
      </span>
      {update.emphasis && (
        <span className="text-[13px] font-bold text-[#ea9713]">{update.emphasis}</span>
      )}
    </li>
  );
}

function Figure({ label, value, tone }: { label: string; value: number; tone: "grey" | "orange" }) {
  return (
    <div className="flex min-w-[150px] flex-col items-center gap-1">
      <p className="text-[15px] text-[#16202e]">{label}</p>
      <p
        className={`text-[40px] font-bold leading-none ${
          tone === "orange" ? "text-[#e5484d]" : "text-[#8b93a0]"
        }`}
      >
        {value}
      </p>
      <p className="text-[13px] text-[#8b93a0]">{entityCount(value).replace(/^\d+\s/, "")}</p>
    </div>
  );
}

export function SubscriptionOverviewCard({
  overview,
  onManage,
}: {
  overview: Overview;
  onManage: () => void;
}) {
  return (
    <section aria-label={SUBSCRIPTION_OVERVIEW} className={`${CARD} flex flex-col gap-8`}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex flex-col gap-7">
          <h2 className="text-[19px] font-bold text-[#16202e]">{SUBSCRIPTION_OVERVIEW}</h2>
          <div className="flex flex-wrap gap-6">
            <Figure label={ACTIVE_SUBSCRIPTIONS} value={overview.active} tone="grey" />
            <Figure label={TRIAL_ENDING} value={overview.trialEnding} tone="orange" />
          </div>
        </div>
        {/* width/height are the file's own pixels (the ratio next/image needs); the drawn
            width is the class, and preflight's `img { height: auto }` gives the height. */}
        <Image
          src="/portal/minty-counting.png"
          alt=""
          width={243}
          height={210}
          unoptimized
          className="hidden w-[212px] shrink-0 sm:block"
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-[15px] text-[#16202e]">{SUBSCRIPTION_UPDATES}</h3>
        {overview.updates.length === 0 ? (
          <p className="text-[13px] text-[#a0a8b2]">{NOTHING_TO_UPDATE}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {overview.updates.slice(0, UPDATES_SHOWN).map((update, i) => (
              <UpdateLine
                key={`${update.entityId}-${update.module ?? "failed"}-${i}`}
                update={update}
              />
            ))}
            {moreUpdates(overview.updates) && (
              <li className="text-[13px] text-[#a0a8b2]">{moreUpdates(overview.updates)}</li>
            )}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onManage}
        className="mx-auto h-[52px] w-[240px] rounded-[26px] bg-[#4fc7c7] text-[15px] font-bold text-white hover:opacity-90"
      >
        {MANAGE_SUBSCRIPTION}
      </button>
    </section>
  );
}
