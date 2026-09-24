"use client";

/**
 * How a handover ended, told in a modal on the `ConfirmDialog` shell (Figma 07-K/L/I and
 * 06·B's A-08): the request withdrawn, accepted, declined, or expired - the company, one
 * sentence, Done. `withdrawn` follows the payer's own *Withdraw request*; the other three
 * answer to something the OTHER person did (or did not do), and are drawn on the Subscription
 * & Billing dashboard, fed by `transfer_outcomes` on `/api/me/subscriptions`.
 */

import type { ReactNode } from "react";

import type { ModalImage } from "@/features/subscription/lib/changeModal";

import { ConfirmDialog } from "@/features/subscription/components/ConfirmDialog";

export type TransferOutcome = "withdrawn" | "accepted" | "declined" | "expired";

/**
 * The person's name, in the design's orange (07-I draws it that way) - wherever it appears:
 * the declined modal puts it in the TITLE, the accepted one in the body sentence.
 *
 * A SPAN, not a second line: the accessible name of the dialog is the whole `<h2>`, so the
 * name has to stay contiguous with the rest of the sentence - "Sonia Chan declined the
 * transfer", not "Sonia Chandeclined". Same trap the `<br/>` in 06's titles has.
 */
function who_(who: string | null) {
  return <span className="text-[#ea9713]">{who || "They"}</span>;
}

export const OUTCOME: Record<
  TransferOutcome,
  {
    title: (who: string | null) => ReactNode;
    body: (who: string | null) => ReactNode;
    image: ModalImage;
  }
> = {
  withdrawn: {
    title: () => "Transfer request has been withdrawn",
    body: () => "You can send a new request to anyone anytime.",
    image: "withdrawn",
  },
  accepted: {
    title: () => "Transfer has been successful",
    body: (who) => <>{who_(who)} has accepted the transfer.</>,
    image: "thumbs_up",
  },
  declined: {
    title: (who) => <>{who_(who)} declined the transfer</>,
    body: () => "You can send a new request to anyone anytime.",
    image: "envelope",
  },
  expired: {
    title: () => "Transfer request has expired",
    body: () => "You can send a new request to anyone anytime.",
    image: "hourglass",
  },
};

export function TransferOutcomeDialog({
  outcome,
  entityName,
  who = null,
  onDone,
  onClose,
}: {
  outcome: TransferOutcome;
  entityName: string;
  /** The other person's name, where the sentence names them. */
  who?: string | null;
  /** DONE, and only Done: the acknowledgement that records this outcome as seen. */
  onDone: () => void;
  /**
   * The backdrop and Escape. They close the dialog and nothing more, so the outcome comes
   * back next visit.
   *
   * ONLY THE BUTTON COUNTS, because the marker is once-ever: a stray click on the backdrop
   * would otherwise consume the only in-app telling that a handover was declined, on every
   * device, leaving the email sent at the time as the sole record. `ConfirmDialog` keeps
   * `onDismiss` for exactly this - the same reason A-11 uses it so Escape cannot mean
   * "discard my changes".
   */
  onClose: () => void;
}) {
  const copy = OUTCOME[outcome];
  return (
    <ConfirmDialog
      title={<span data-modal={`transfer_${outcome}`}>{copy.title(who)}</span>}
      image={copy.image}
      entityName={entityName}
      busy={false}
      confirmLabel="Done"
      confirmTone="teal"
      hideBack
      onConfirm={onDone}
      onBack={onClose}
      onDismiss={onClose}
    >
      <p>{copy.body(who)}</p>
    </ConfirmDialog>
  );
}
