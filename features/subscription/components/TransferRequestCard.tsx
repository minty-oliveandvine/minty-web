/**
 * "Transfer Request Received" (Figma 04-A): a company someone wants to hand over to the payer.
 * *Review and accept* opens the incoming-transfers page (a seam until that page is built).
 */

import type { IncomingTransfer } from "@/features/subscription/api/payerPortal";

export function TransferRequestCard({
  transfer,
  onReview,
}: {
  transfer: IncomingTransfer;
  onReview: (transfer: IncomingTransfer) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-card px-5 py-4"
      data-transfer={transfer.id}
    >
      <p className="min-w-[200px] flex-1 text-title-l font-semibold text-ink">
        {transfer.entity_name}
      </p>
      <p className="flex-1 text-body-l text-ink">
        Transfer request received.
        {transfer.from_name ? (
          <span className="block text-body-s text-ink-2">from {transfer.from_name}</span>
        ) : null}
      </p>
      <button
        type="button"
        onClick={() => onReview(transfer)}
        className="h-11 rounded-xl bg-action px-4 text-body-m font-semibold text-white hover:bg-action-hover active:bg-action-pressed"
      >
        Review and accept
      </button>
    </div>
  );
}
