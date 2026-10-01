"use client";

/**
 * The recipient's side of a handover, drawn (Figma 07-D/E/F): a request under review - the
 * company's cards as they are, the summary with the card of the billing account the bill will
 * go to, Confirm Subscription Transfer (and Decline, the design's other answer); 07-E's account
 * picker - the person's BILLING ACCOUNTS as the "Billing Accounts" sheet lists them, New billing
 * account, Confirm; and "No requests waiting". Everything shown is the hook's
 * (`useSubscriptionRequests`).
 */

import Image from "next/image";

import type { IncomingTransfer, SavedPaymentMethod } from "@/features/subscription/api/payerPortal";
import { AccountTargetList } from "@/features/subscription/components/BillingAccountDialogs";
import { CardBrand, SUMMARY_MARK } from "@/features/subscription/components/CardBrand";
import {
  SHEET_ADD,
  SHEET_ERROR,
  SHEET_PRIMARY,
  SHEET_SINGLE,
} from "@/features/subscription/components/sheetClasses";
import type { ReviewedRequest } from "@/features/subscription/hooks/useSubscriptionRequests";
import { BILLING_ACCOUNTS, NEW_BILLING_ACCOUNT } from "@/features/subscription/lib/billingAccounts";
import { utcDay, type SummaryView } from "@/features/subscription/lib/subscriptionSummary";
import {
  ADD_BILLING_ACCOUNT,
  BILLING_ACCOUNT_LABEL,
  CONFIRM_TRANSFER,
  NEEDS_ACCOUNT,
  NO_BILLING_ACCOUNT_YET,
  TRANSFER_ACCOUNTS_LEAD,
  declinedNote,
  undatedDecline,
  NO_REQUESTS,
  NO_REQUESTS_BODY,
  TRANSFER_CHARGE_NOTE,
  expiresLabel,
} from "@/features/subscription/lib/transfer";

import {
  PLAN_TONE,
  PriceBox,
  SummaryModuleCard,
} from "@/features/subscription/components/SubscriptionSummaryRow";

export function NoRequests({ onBack }: { onBack: () => void }) {
  return (
    <section
      aria-label="No requests waiting"
      className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[#e6ebed] bg-white px-6 py-12 text-center"
    >
      {/* the file's own pixels; the drawn width is the class, the height follows the ratio */}
      <Image
        src="/portal/minty-dont.png"
        alt=""
        width={266}
        height={346}
        unoptimized
        className="w-[130px]"
      />
      <h2 className="text-[25px] font-bold text-[#21262e]">{NO_REQUESTS}</h2>
      <p className="max-w-[680px] text-[15px] text-[#6b7380]">{NO_REQUESTS_BODY}</p>
      <button
        type="button"
        onClick={onBack}
        className="mt-2 h-[52px] w-[260px] rounded-lg border border-[#d8dee4] bg-white text-[15px] font-semibold text-[#292e38] hover:bg-[#f5f7fa]"
      >
        Back to Manage Subscription
      </button>
    </section>
  );
}

/** Several requests waiting: which one to review. */
export function RequestList({
  requests,
  onReview,
}: {
  requests: IncomingTransfer[];
  onReview: (transfer: IncomingTransfer) => void;
}) {
  return (
    <ul aria-label="Requests waiting" className="flex flex-col gap-4">
      {requests.map((row) => (
        <li
          key={row.id}
          data-transfer={row.id}
          className="flex flex-wrap items-center gap-6 rounded-xl bg-white px-7 py-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]"
        >
          <div className="min-w-[260px] flex-1">
            <p className="text-[25px] font-bold text-black">{row.entity_name}</p>
            <p className="text-base text-[var(--ink-soft)]">
              {row.from_name} has asked you to become the subscriber.
              {expiresLabel(row) ? ` ${expiresLabel(row)}.` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onReview(row)}
            className="h-[58px] rounded-[24px] bg-secondary px-6 text-xl font-bold text-white hover:opacity-90"
          >
            Review and accept
          </button>
        </li>
      ))}
    </ul>
  );
}

/** The chosen billing account's card number, as the summary grid's second row draws it. A
 *  card is only ever shown as an account's, so with no account there is no card to name. */
function CardNumber({
  account,
  card,
}: {
  account: ReviewedRequest["account"];
  card: SavedPaymentMethod | null;
}) {
  return (
    <p className="text-xl font-bold text-black" data-payment-method>
      {account === null
        ? NO_BILLING_ACCOUNT_YET
        : card === null
          ? "No card"
          : card.last4
            ? `${card.brand_label || "Card"} ${card.last4}`
            : card.label}
    </p>
  );
}

export function IncomingRequestReview({
  reviewed,
  busy,
  actionError,
  onChangeCard,
  onToggleModule,
  onAccept,
  onDecline,
}: {
  reviewed: ReviewedRequest;
  busy: boolean;
  actionError: string | null;
  onChangeCard: () => void;
  onToggleModule: (code: string) => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { row, view, viewStatus, card, account, offered, taking } = reviewed;
  const blocked = row.blockers.length > 0;
  // Only once the accounts have been READ: until then there is none chosen because nothing has
  // answered yet, and saying "add one" to someone who has three is worse than saying nothing.
  const needsAccount = viewStatus === "ready" && account === null;
  const panel: SummaryView["panel"] | null = view?.panel ?? null;
  // The plan the recipient ends up on: the future half when something has been unticked,
  // otherwise the company as it stands. Normalised to one shape so the price box and the
  // plan lines do not each have to ask which kind of panel this is.
  const chosen =
    panel === null
      ? null
      : panel.kind === "simple"
        ? { lines: panel.lines, price: panel.price, struck: null, greyed: panel.greyed }
        : (panel.future ?? panel.current);
  const declinedModules = (view?.modules ?? [])
    .filter((m) => offered.includes(m.code) && !taking.includes(m.code))
    .map((m) => ({ name: m.name, trialing: m.view.state === "trialing" }));
  const paidUntil = utcDay(row.quote?.covers_from);
  // MUST NOT HAPPEN: a paid module is being declined and the API has not said when the
  // company is paid up to. Held rather than worded around - see `undatedDecline`.
  const undated = undatedDecline(declinedModules, paidUntil);
  const expires = expiresLabel(row);
  return (
    <section aria-label="Transfer request" className="flex flex-col gap-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-[25px] font-bold text-black">{row.entity_name}</h2>
        <p className="text-[15px] text-[var(--ink-soft)]">
          {row.from_name} has asked you to become the subscriber.
          {expires && (
            <span className="ml-3 rounded-md bg-[#fff7e6] px-2.5 py-1 text-xs font-semibold text-[#8a5a00]">
              {expires}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-[1fr_1fr_minmax(360px,1.45fr)] items-start gap-6">
        {viewStatus === "ready" && view ? (
          view.modules.map((module) => (
            <div key={module.code} className="flex flex-col items-center gap-[46px]">
              <SummaryModuleCard
                module={module}
                onToggle={
                  offered.includes(module.code) &&
                  !(taking.length === 1 && taking[0] === module.code)
                    ? () => onToggleModule(module.code)
                    : undefined
                }
              />
              {offered.includes(module.code) && (
                /* THE CHOICE, not the module's state. 07-D is titled "Choose Modules" and
                   this is what does the choosing: ticked = "I am taking this on", and
                   unticking it cancels that module for the company as part of accepting.
                   It starts ticked for everything the company holds, because arriving on
                   this screen means being offered all of it. */
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={taking.includes(module.code)}
                  aria-label={`Take on ${module.name}`}
                  /* THE LAST ONE STAYS TICKED. Taking nothing on is declining the handover,
                     which is the button below - so the choice never reaches a state the
                     Confirm would have to refuse. */
                  disabled={busy || (taking.length === 1 && taking[0] === module.code)}
                  onClick={() => onToggleModule(module.code)}
                  className={
                    taking.includes(module.code)
                      ? "flex size-10 items-center justify-center rounded-lg bg-[#4fc7c7] text-white disabled:opacity-60"
                      : "size-[34px] rounded-[9px] border-2 border-[#c7cdd4] bg-white disabled:opacity-60"
                  }
                >
                  {taking.includes(module.code) && "✓"}
                </button>
              )}
            </div>
          ))
        ) : (
          <>
            <div className="h-[354px] animate-pulse rounded-[20px] border border-[#e6e6e6] bg-[#f7f9fa]" />
            <div className="h-[354px] animate-pulse rounded-[20px] border border-[#e6e6e6] bg-[#f7f9fa]" />
          </>
        )}

        <section
          aria-label="Subscription Summary"
          className="flex w-full flex-col gap-6 rounded-xl bg-white p-8 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]"
        >
          <h3 className="text-xl font-bold text-black">Subscription Summary</h3>
          {/*
            ONE GRID, not two stacks. The plan and the card are read across: the module name
            sits level with the card's mark, the plan's qualifier level with the card number,
            and Change on a row of its own. Two independent columns let those drift apart by
            however tall each happened to be.

            WHAT THEY ARE TAKING ON is what the ticks decide: when a module is unticked the
            panel splits, and `chosen` is the FUTURE half of that - what the recipient ends up
            paying for, not what the company has today.
          */}
          <div className="grid grid-cols-[auto_auto] items-end justify-between gap-x-6">
            <p className="col-start-1 row-start-1 text-[15px] text-[#737a87]">Selected plan</p>
            <p className="col-start-2 row-start-1 justify-self-end text-[15px] text-[#737a87]">
              {BILLING_ACCOUNT_LABEL}
            </p>

            <div className="col-start-1 row-start-2 mt-3 flex flex-col gap-1">
              {(chosen?.lines ?? [{ name: "…", tone: "none" as const, tag: null }]).map((l) => (
                <span key={l.name} className="flex items-center gap-2">
                  <span className={`text-xl font-bold ${PLAN_TONE[l.tone]}`}>{l.name}</span>
                  {/* Super Minty rides beside the bundle's name, as `PlanLines` draws it
                      everywhere else - this grid replaced that component and has to keep it. */}
                  {l.tone === "bundle" && (
                    <Image
                      src="/portal/super-minty.png"
                      alt=""
                      width={60}
                      height={56}
                      unoptimized
                    />
                  )}
                </span>
              ))}
            </div>
            <div className="col-start-2 row-start-2 mt-3 justify-self-end">
              {card && (
                <CardBrand
                  brand={card.brand}
                  label={card.brand_label}
                  fit="mark"
                  className={SUMMARY_MARK}
                />
              )}
            </div>

            {/* The qualifier - "only", "(Free Trial)" - sits at the lower right OF THE NAME,
                not of the column: the plan column is `auto`, so it is only as wide as the
                widest thing in it, and `justify-between` holds the two columns apart. Aligned
                to a `1fr` column instead, the word drifted off into the gap. */}
            <span className="col-start-1 row-start-3 text-right text-sm text-[#737a87]">
              {chosen?.lines.find((l) => l.tag)?.tag ?? ""}
            </span>
            <div className="col-start-2 row-start-3 flex flex-col items-end justify-self-end">
              {account && (
                <p className="text-[15px] text-[#737a87]" data-billing-account>
                  {account.name}
                </p>
              )}
              <CardNumber account={account} card={card} />
            </div>

            <button
              type="button"
              onClick={onChangeCard}
              className="col-start-2 row-start-4 justify-self-end text-[15px] text-quiet hover:underline"
            >
              {needsAccount ? ADD_BILLING_ACCOUNT : "Change"}
            </button>
          </div>
          {chosen && (
            <PriceBox price={chosen.price} struck={chosen.struck} greyed={chosen.greyed} />
          )}
          {undated ? (
            <p role="alert" className="text-center text-[15px] font-semibold text-[#b42318]">
              {undated}
            </p>
          ) : (
            <p className="text-center text-xl font-bold text-quiet">
              {declinedNote(declinedModules, paidUntil)}
            </p>
          )}

          {/* NO DETAIL SECTION. The grey box under the price held two things and both have
              gone: the money line (a handover takes nothing at accept) and the inherited-
              trial lines. What accepting means is the plan and the price above it, and the
              note below - "charged to your selected billing account from the date that
              transfer is completed". */}

          {blocked && (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
            >
              {row.blockers.map((reason) => (
                <p key={reason}>{reason}</p>
              ))}
            </div>
          )}
          {/* Said HERE rather than left to the API's refusal, because the API can only answer
              once Confirm has been pressed. The offer is allowed to reach someone with no
              billing account — being asked is not being charged — so this is a normal state of
              this screen and not an error. Only claimed once the accounts have been read. */}
          {needsAccount && (
            <div
              role="status"
              className="rounded-lg border border-[#e6ebed] bg-[#f7f9fa] px-3.5 py-2.5 text-sm text-[#6b7380]"
            >
              {NEEDS_ACCOUNT}
            </div>
          )}
          {actionError && (
            <p className="text-sm text-[#b42318]" role="alert">
              {actionError}
            </p>
          )}

          <button
            type="button"
            onClick={onAccept}
            disabled={busy || blocked || needsAccount || undated !== null}
            aria-busy={busy || undefined}
            className="h-[66px] rounded-2xl bg-[#4fc7c7] text-xl font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {CONFIRM_TRANSFER}
          </button>
          <button
            type="button"
            onClick={onDecline}
            disabled={busy}
            className="h-[52px] rounded-2xl border border-[#d8dee4] bg-white text-[17px] font-semibold text-[#292e38] hover:bg-[#f5f7fa] disabled:opacity-60"
          >
            Decline
          </button>
        </section>
      </div>

      <p className="text-[15px] text-[#a0a8b2]">{TRANSFER_CHARGE_NOTE}</p>
    </section>
  );
}

/**
 * 07-E: which of the person's BILLING ACCOUNTS the company is billed to. The rows are the "Billing
 * Accounts" sheet's (`AccountTargetList` - the card each charges, its companies, and the reason a
 * row is shut: "Payment failed", "No card"), in 07-E's panel beside Minty, so the step reads as
 * the review's Change opening in place. *New billing account* opens the billing-account sheet
 * over it (a card and the company and email it bills under); the account it opens comes back
 * here, picked. Confirm only returns to 07-D: the account is sent with Confirm Subscription
 * Transfer. No card is ever picked on its own, or saved to no account.
 */
export function TransferAccountPicker({
  targets,
  accountId,
  busy,
  actionError,
  onPick,
  onAdd,
  onConfirm,
}: {
  targets: ReviewedRequest["targets"];
  accountId: string | null;
  busy: boolean;
  actionError: string | null;
  onPick: (id: string) => void;
  onAdd: () => void;
  onConfirm: () => void;
}) {
  return (
    <section
      aria-label={BILLING_ACCOUNTS}
      className="flex w-full max-w-[477px] flex-col gap-5 rounded-xl bg-white p-7 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]"
    >
      <div>
        <h3 className="text-[15px] font-semibold text-[#21262e]">{BILLING_ACCOUNTS}</h3>
        <p className="mt-1.5 text-[13.5px] text-[#6b7a80]">{TRANSFER_ACCOUNTS_LEAD}</p>
      </div>
      {targets.length > 0 ? (
        <AccountTargetList
          rows={targets}
          picked={accountId}
          busy={busy}
          name="transfer-account"
          onPick={onPick}
        />
      ) : (
        <p className="text-sm text-[#6b7380]">{NEEDS_ACCOUNT}</p>
      )}
      <button type="button" onClick={onAdd} disabled={busy} className={SHEET_ADD}>
        {NEW_BILLING_ACCOUNT}
      </button>
      {actionError && (
        <p role="alert" className={SHEET_ERROR}>
          {actionError}
        </p>
      )}
      <div className={SHEET_SINGLE}>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy || !accountId}
          className={`${SHEET_PRIMARY} min-w-[130px]`}
        >
          Confirm
        </button>
      </div>
    </section>
  );
}
