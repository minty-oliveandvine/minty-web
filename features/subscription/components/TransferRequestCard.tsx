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
      className="flex min-h-[125px] flex-wrap items-center gap-6 rounded-xl bg-[var(--tile-petty)] px-7 py-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]"
      data-transfer={transfer.id}
    >
      <p className="min-w-[260px] flex-1 text-[25px] font-bold text-black">
        {transfer.entity_name}
      </p>
      <p className="flex-1 text-xl text-black">
        Transfer request received.
        {transfer.from_name ? (
          <span className="block text-base text-[var(--ink-soft)]">from {transfer.from_name}</span>
        ) : null}
      </p>
      <button
        type="button"
        onClick={() => onReview(transfer)}
        className="h-[58px] rounded-[24px] bg-secondary px-6 text-xl font-bold text-white hover:opacity-90"
      >
        Review and accept
      </button>
    </div>
  );
}
