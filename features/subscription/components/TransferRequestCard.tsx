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
      className="flex min-h-[125px] flex-wrap items-center gap-6 rounded-xl bg-[var(--tile-petty)] px-7 py-6"
      data-transfer={transfer.id}
    >
      <p className="min-w-[260px] flex-1 text-display-m font-bold text-ink">
        {transfer.entity_name}
      </p>
      <p className="flex-1 text-xl text-ink">
        Transfer request received.
        {transfer.from_name ? (
          <span className="block text-base text-ink-2">from {transfer.from_name}</span>
        ) : null}
      </p>
      <button
        type="button"
        onClick={() => onReview(transfer)}
        className="h-[58px] rounded-xl bg-action px-6 text-xl font-bold text-white hover:bg-action-hover active:bg-action-pressed"
      >
        Review and accept
      </button>
    </div>
  );
}
