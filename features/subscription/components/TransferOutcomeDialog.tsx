"use client";

/**
 * How a handover ended, told in a modal on the `ConfirmDialog` shell (Figma 07-K/L/I and
 * 06·B's A-08): the request withdrawn, accepted, declined, or expired - the company, one
 * sentence, Done. `withdrawn` follows the payer's own *Withdraw request*; the other three
 * answer to something the OTHER person did (or did not do), which the API tells by email
 * today and no read here reports - they are drawn on the Subscription & Billing dashboard when
 * that page (08) and an outgoing-transfer read exist.
 */

import type { ModalImage } from "@/features/subscription/lib/changeModal";

import { ConfirmDialog } from "@/features/subscription/components/ConfirmDialog";

export type TransferOutcome = "withdrawn" | "accepted" | "declined" | "expired";

export const OUTCOME: Record<
  TransferOutcome,
  { title: (who: string | null) => string; body: (who: string | null) => string; image: ModalImage }
> = {
  withdrawn: {
    title: () => "Transfer request has been withdrawn",
    body: () => "You can send a new request to anyone anytime.",
    image: "withdrawn",
  },
  accepted: {
    title: () => "Transfer has been successful",
    body: (who) => `${who || "They"} has accepted the transfer.`,
    image: "thumbs_up",
  },
  declined: {
    title: (who) => `${who || "They"} declined the transfer`,
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
}: {
  outcome: TransferOutcome;
  entityName: string;
  /** The other person's name, where the sentence names them. */
  who?: string | null;
  onDone: () => void;
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
      onBack={onDone}
    >
      <p>{copy.body(who)}</p>
    </ConfirmDialog>
  );
}
