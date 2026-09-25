"use client";

/**
 * The portal's landing, drawn (Figma 08-A "Subscription & Billing"): the billing-account card -
 * which account the bill goes to, when it next goes out, and the ways to the billing-account
 * sheet, to moving a company between accounts and to the account's page - and the Subscription
 * Overview beside Minty counting the
 * cash: how many companies are being paid for, how many trials end soon, a line per company
 * that needs the payer to know something, and *Manage Subscription*. Everything shown is the
 * hook's (`useBillingOverview`).
 */

import Image from "next/image";

import { fromControl } from "@/features/subscription/components/SubscriptionSummaryRow";
import {
  ACTIVE_SUBSCRIPTIONS,
  BILL_TO,
  BILLING_ACCOUNT,
  CHANGE_BILLING_ACCOUNT,
  GO_TO_BILLING,
  MANAGE_BILLING_DETAILS,
  MANAGE_SUBSCRIPTION,
  NEXT_BILLING_DATE,
  NOTHING_TO_UPDATE,
  SUBSCRIPTION_OVERVIEW,
  SUBSCRIPTION_UPDATES,
  TRIAL_ENDING,
  entityCount,
  moreUpdatesLabel,
  visibleUpdates,
  type NextBilling,
  type Overview,
  type OverviewUpdate,
} from "@/features/subscription/lib/billing";
import { ACCOUNTS_LOAD_FAILED, CHOOSE_ACCOUNT } from "@/features/subscription/lib/billingAccounts";

const CARD =
  "rounded-xl border border-[#eef1f4] bg-white px-10 py-9 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.06)]";

/**
 * The first card: ONE billing account at a glance - its name as "Bill to", the payer's next
 * billing date (shared by every account) - and the ways on.
 *
 * TWO CLICKS, TWO JOBS (the user's call): CLICKING THE CARD opens the billing-account sheet -
 * which account it shows, and *New billing account* - and CLICKING THE ACCOUNT'S NAME is "Change
 * billing account", moving a company to another account. There is no separate button for the
 * move. The card is a region, not a control, and never gets a role or a name of its own, so the
 * keyboard's way to the sheet is a button of its own, out of sight until it is focused. Clicks on
 * the card's real controls are theirs (`fromControl`): the name moves a company and the link goes
 * to the account's page without the sheet opening under them.
 */
export function BillingAccountCard({
  next,
  accountsFailed,
  notice,
  onPick,
  onMove,
  onOpen,
  onRetry,
}: {
  next: NextBilling;
  /** The accounts could not be read: the payer-level fallback is shown, with a retry. */
  accountsFailed: boolean;
  /** How a move went, said once under the heading. */
  notice: { text: string; tone: "ok" | "failed" } | null;
  onPick: () => void;
  onMove: () => void;
  onOpen: () => void;
  onRetry: () => void;
}) {
  return (
    <section
      aria-label={BILLING_ACCOUNT}
      onClick={(e) => {
        if (!accountsFailed && !fromControl(e)) onPick();
      }}
      className={`${CARD} flex flex-col gap-5 ${accountsFailed ? "" : "cursor-pointer"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-[19px] font-bold text-[#16202e]">{MANAGE_BILLING_DETAILS}</h2>
        {!accountsFailed && (
          // What a click on the card does, for the keyboard - shown only while focused.
          <button
            type="button"
            onClick={onPick}
            aria-haspopup="dialog"
            className="sr-only shrink-0 rounded-md text-[13px] font-semibold text-[#2e9b9b] underline underline-offset-4 focus-visible:not-sr-only focus-visible:px-2 focus-visible:py-1"
          >
            {CHOOSE_ACCOUNT}
          </button>
        )}
      </div>
      {notice && (
        <p
          role={notice.tone === "failed" ? "alert" : "status"}
          className={`text-[15px] ${notice.tone === "failed" ? "text-[#b42318]" : "text-[#2e9b9b]"}`}
        >
          {notice.text}
        </p>
      )}
      <div className="flex flex-wrap gap-x-16 gap-y-5">
        <div className="min-w-0">
          <p className="text-[17px] font-bold text-[#16202e]">{BILL_TO}</p>
          {accountsFailed ? (
            <p className="mt-2 truncate text-[17px] text-[#16202e]">{next.billTo || "—"}</p>
          ) : (
            <button
              type="button"
              onClick={onMove}
              aria-haspopup="dialog"
              aria-label={`${next.billTo || "No billing account"} · ${CHANGE_BILLING_ACCOUNT}`}
              className="mt-2 flex max-w-full items-center gap-2 text-left text-[17px] text-[#16202e] hover:text-[#2e9b9b]"
            >
              <span className="truncate">{next.billTo || "—"}</span>
              <span aria-hidden className="text-[13px] text-[#8b93a0]">
                ▾
              </span>
            </button>
          )}
        </div>
        <div>
          <p className="text-[17px] font-bold text-[#16202e]">{NEXT_BILLING_DATE}</p>
          <p className="mt-2 text-[17px] text-[#16202e]">{next.date ?? "—"}</p>
        </div>
      </div>
      {accountsFailed && (
        <p className="text-[13px] text-[#b42318]">
          {ACCOUNTS_LOAD_FAILED}{" "}
          <button type="button" onClick={onRetry} className="font-semibold underline">
            Try again
          </button>
        </p>
      )}
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
  updatesExpanded,
  onToggleUpdates,
  onManage,
}: {
  overview: Overview;
  /** Every update line on show, rather than the first five. */
  updatesExpanded: boolean;
  onToggleUpdates: () => void;
  onManage: () => void;
}) {
  const more = moreUpdatesLabel(overview.updates);
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
            width is the class, and preflight's `img { height: auto }` gives the height.
            MIRRORED (the user's call, 2026-09-25): the file's Minty faces right, out of the
            card; turned, it faces the figures it is counting. The cap's lettering reads
            mirrored as a result. */}
        <Image
          src="/portal/minty-counting.png"
          alt=""
          width={243}
          height={210}
          unoptimized
          className="hidden w-[212px] shrink-0 -scale-x-100 sm:block"
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-[15px] text-[#16202e]">{SUBSCRIPTION_UPDATES}</h3>
        {overview.updates.length === 0 ? (
          <p className="text-[13px] text-[#a0a8b2]">{NOTHING_TO_UPDATE}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visibleUpdates(overview.updates, updatesExpanded).map((update, i) => (
              <UpdateLine
                key={`${update.entityId}-${update.module ?? "failed"}-${i}`}
                update={update}
              />
            ))}
          </ul>
        )}
        {more && (
          <button
            type="button"
            onClick={onToggleUpdates}
            aria-expanded={updatesExpanded}
            className="self-start text-[13px] text-[#6b7380] hover:underline"
          >
            {updatesExpanded ? "Show less" : more}
          </button>
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
