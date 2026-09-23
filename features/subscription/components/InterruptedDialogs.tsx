"use client";

/**
 * When it fails or gets interrupted (Figma section 06·B), on the `ConfirmDialog` shell:
 *
 * - `PaymentFailedDialog` (A-05, "The bank declined the payment"): the card that declined, the
 *   design's sentences - "We'll automatically retry in a few days." only where that is true
 *   (a suspension's outstanding invoice, which the scheduled retries keep trying) - then "Try
 *   again now" (the same change, applied again) or "Done" (the ticks stay pending on the row).
 * - `LeaveDialog` (A-11, "Leaving with changes not confirmed"): "Leave without saving?" when
 *   the open row has ticks pending and the person closes it, opens another company, or goes
 *   back - "Discard changes" drops the ticks and goes, "Go Back" stays.
 *
 * A transfer declined or expired (A-07 / A-08) belongs to the Subscription & Billing dashboard,
 * section 07's page; they are built with it.
 */

import { ConfirmDialog } from "@/features/subscription/components/ConfirmDialog";

export const PAYMENT_FAILED_TITLE = "Payment could not be processed";
export const PAYMENT_FAILED_RETRY = "We'll automatically retry in a few days.";
export const PAYMENT_FAILED_BODY =
  "If you've resolved the issue, feel free to try again. You can also use a different payment method to avoid interruption to your service.";
export const TRY_AGAIN_NOW = "Try again now";
export const DONE = "Done";

export const LEAVE_TITLE = "Leave without saving?";
export const LEAVE_BODY_1 = "You have unsaved changes.";
export const LEAVE_BODY_2 = "Your changes will be lost if you leave this page.";
export const DISCARD_CHANGES = "Discard changes";
export const GO_BACK_UPPER = "Go Back";

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

export function LeaveDialog({ onDiscard, onStay }: { onDiscard: () => void; onStay: () => void }) {
  return (
    <ConfirmDialog
      title={<span data-modal="leave">{LEAVE_TITLE}</span>}
      image="dont"
      busy={false}
      confirmLabel={GO_BACK_UPPER}
      confirmTone="teal"
      backLabel={DISCARD_CHANGES}
      backTone="teal"
      onConfirm={onStay}
      onBack={onDiscard}
      onDismiss={onStay}
    >
      <p>{LEAVE_BODY_1}</p>
      <p>{LEAVE_BODY_2}</p>
    </ConfirmDialog>
  );
}
