"use client";

/**
 * When it fails or gets interrupted (Figma section 06·B), on the `ConfirmDialog` shell:
 *
 * - `PaymentFailedDialog` (A-05, "The bank declined the payment"): the card that declined, the
 *   design's sentences - "We'll automatically retry in a few days." only where that is true
 *   (a suspension's outstanding invoice, which the scheduled retries keep trying) - then "Try
 *   again now" (the same change, applied again) or "Done" (the ticks stay pending on the row).
 * `LeaveDialog` (A-11, "Leaving with changes not confirmed") moved to
 * `components/ui/LeaveDialog.tsx` when the Entity & Integration tab needed it too: a feature may
 * not reach another feature (eslint.config.mjs). This page still shows it - the open row's ticks
 * pending - from there.
 *
 * A transfer declined or expired (A-07 / A-08) belongs to the Subscription & Billing dashboard,
 * section 07's page; they are built with it.
 *
 * Copied to minty-payment-request-web at the same path and ported to Flask (Minty `static/js/minty_dialog.js` + `static/css/minty_dialog.css`) - change all three.
 */

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export const PAYMENT_FAILED_TITLE = "Payment could not be processed";
export const PAYMENT_FAILED_RETRY = "We'll automatically retry in a few days.";
export const PAYMENT_FAILED_BODY =
  "If you've resolved the issue, feel free to try again. You can also use a different payment method to avoid interruption to your service.";
export const TRY_AGAIN_NOW = "Try again now";
export const DONE = "Done";

export function PaymentFailedDialog({
  card,
  autoRetry,
  busy,
  onTryAgain,
  onDone,
}: {
  /** The nominated card as the panel names it ("Visa 4121"), when known. */
  card: string | null;
  /** A scheduled retry is coming (a suspension's invoice): say so. */
  autoRetry: boolean;
  busy: boolean;
  onTryAgain: () => void;
  onDone: () => void;
}) {
  return (
    <ConfirmDialog
      title={<span data-modal="payment_failed">{PAYMENT_FAILED_TITLE}</span>}
      image="payment_failed"
      lead={card ? <p className="text-[#ea9713]">{card}</p> : null}
      busy={busy}
      confirmLabel={DONE}
      confirmTone="teal"
      backLabel={TRY_AGAIN_NOW}
      backTone="teal"
      onConfirm={onDone}
      onBack={onTryAgain}
      onDismiss={onDone}
    >
      {autoRetry && <p>{PAYMENT_FAILED_RETRY}</p>}
      <p>{PAYMENT_FAILED_BODY}</p>
    </ConfirmDialog>
  );
}
