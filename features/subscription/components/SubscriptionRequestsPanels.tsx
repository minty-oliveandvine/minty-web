"use client";

/**
 * The recipient's side of a handover, drawn (Figma 07-D/E/F): a request under review - the
 * company's cards as they are, the summary with the card the charge goes to, what accepting
 * charges today, Confirm Subscription Transfer (and Decline, the design's other answer); the
 * card picker - the person's saved cards, Add New Card, Confirm; and "No requests waiting".
 * Everything shown is the hook's (`useSubscriptionRequests`).
 */

import Image from "next/image";

import type { IncomingTransfer, SavedPaymentMethod } from "@/features/subscription/api/payerPortal";
import { PORTAL } from "@/features/subscription/lib/paths";
import type { SummaryView } from "@/features/subscription/lib/subscriptionSummary";
import {
  CONFIRM_TRANSFER,
  NO_REQUESTS,
  NO_REQUESTS_BODY,
  TRANSFER_CHARGE_NOTE,
  expiresLabel,
} from "@/features/subscription/lib/transfer";
import type { ReviewedRequest } from "@/features/subscription/hooks/useSubscriptionRequests";

import {
  PlanLines,
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
        Back to My Profile
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

function CardLabel({ card }: { card: SavedPaymentMethod | null }) {
  if (!card) return <p className="text-xl font-bold text-black">No card yet</p>;
  return (
    <p className="text-xl font-bold text-black" data-payment-method>
      {card.last4 ? `${card.brand_label || "Card"} ${card.last4}` : card.label}
    </p>
  );
}

export function IncomingRequestReview({
  reviewed,
  busy,
  actionError,
  onChangeCard,
  onAccept,
  onDecline,
}: {
  reviewed: ReviewedRequest;
  busy: boolean;
  actionError: string | null;
  onChangeCard: () => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { row, view, viewStatus, charge, trialLines, card } = reviewed;
  const blocked = row.blockers.length > 0;
  const panel: SummaryView["panel"] | null = view?.panel ?? null;
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
              <SummaryModuleCard module={module} />
              {module.tick !== "start_trial" && (
                <span
                  role="checkbox"
                  aria-checked={module.tick === "ticked"}
                  aria-disabled
                  aria-label={`${module.name} subscription`}
                  className={
                    module.tick === "ticked"
                      ? "flex size-10 items-center justify-center rounded-lg bg-[#4fc7c7] text-white"
                      : "size-[34px] rounded-[9px] border-2 border-[#c7cdd4] bg-white"
                  }
                >
                  {module.tick === "ticked" && "✓"}
                </span>
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
          <div className="flex items-start justify-between gap-6">
            <div className="flex flex-col gap-3">
              <p className="text-[15px] text-[#737a87]">Selected plan</p>
              {panel && panel.kind === "simple" ? (
                <PlanLines lines={panel.lines} />
              ) : panel ? (
                <PlanLines lines={panel.current.lines} />
              ) : (
                <p className="text-xl font-bold text-black">…</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <p className="text-[15px] text-[#737a87]">Payment method</p>
              <CardLabel card={card} />
              <button
                type="button"
                onClick={onChangeCard}
                className="text-[15px] text-quiet hover:underline"
              >
                Change
              </button>
            </div>
          </div>
          {panel && panel.kind === "simple" ? (
            <PriceBox price={panel.price} struck={null} greyed={panel.greyed} />
          ) : panel ? (
            <PriceBox price={panel.current.price} struck={panel.current.struck} greyed />
          ) : null}
          <p className="text-center text-xl font-bold text-quiet">No pending changes</p>

          <div className="rounded-xl bg-[#f7f9fa] px-4 py-3.5 text-sm" data-charge>
            {charge.today && <p className="font-semibold text-[#21262e]">{charge.today}</p>}
            {charge.detail && <p className="mt-1 text-[#6b7380]">{charge.detail}</p>}
            {trialLines.map((line) => (
              <p key={line} className="mt-1 text-[#6b7380]">
                {line}
              </p>
            ))}
          </div>

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
          {actionError && (
            <p className="text-sm text-[#b42318]" role="alert">
              {actionError}
            </p>
          )}

          <button
            type="button"
            onClick={onAccept}
            disabled={busy || blocked}
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

export function PaymentMethodPicker({
  cards,
  cardId,
  busy,
  actionError,
  onPick,
  onAdd,
  onConfirm,
}: {
  cards: SavedPaymentMethod[];
  cardId: string | null;
  busy: boolean;
  actionError: string | null;
  onPick: (id: string) => void;
  onAdd: () => void;
  onConfirm: () => void;
}) {
  return (
    <section
      aria-label="Payment Methods"
      className="flex w-full max-w-[477px] flex-col gap-5 rounded-xl bg-white p-7 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]"
    >
      <h3 className="text-[15px] font-semibold text-[#21262e]">Payment Methods</h3>
      <div className="flex flex-col gap-3">
        {cards.map((card) => {
          const picked = card.id === cardId;
          return (
            <label
              key={card.id}
              className={`flex cursor-pointer items-center gap-5 rounded-xl border px-6 py-4 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.06)] ${
                picked ? "border-[#2e9b9b] bg-[#f5ffff]" : "border-[#eef1f4] bg-white"
              }`}
            >
              <input
                type="radio"
                name="card"
                value={card.id}
                checked={picked}
                onChange={() => onPick(card.id)}
                className="sr-only"
              />
              <span
                className={`w-[78px] shrink-0 overflow-hidden text-center font-black italic text-[#1a1f71] ${
                  (card.brand_label || "Card").length > 5 ? "text-[13px]" : "text-2xl"
                }`}
              >
                {card.brand_label || "Card"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-bold text-[#16202e]">
                  {card.last4
                    ? `${card.brand_label || "Card"} ending in ${card.last4}`
                    : card.label}
                </span>
                {card.expiry && (
                  <span className="block text-[13px] text-[#6b7380]">
                    <span className="text-[#a0a8b2]">Expire on</span> {card.expiry}
                  </span>
                )}
              </span>
            </label>
          );
        })}
        {cards.length === 0 && <p className="text-sm text-[#6b7380]">No saved cards yet.</p>}
      </div>
      <a
        href={PORTAL.billing}
        onClick={(e) => {
          e.preventDefault();
          onAdd();
        }}
        className="self-center text-[15px] font-semibold text-[#2e9b9b] hover:underline"
      >
        Add New Card
      </a>
      {actionError && (
        <p className="text-sm text-[#b42318]" role="alert">
          {actionError}
        </p>
      )}
      <button
        type="button"
        onClick={onConfirm}
        disabled={busy || !cardId}
        className="mt-6 h-[44px] w-[96px] self-center rounded-lg bg-[#18c4c7] text-[15px] font-bold text-white hover:opacity-90 disabled:opacity-50"
      >
        Confirm
      </button>
    </section>
  );
}
