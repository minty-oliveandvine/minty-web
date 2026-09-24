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
 * The person's name in the title, in the design's orange (07-I draws it that way).
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
    body: (who: string | null) => string;
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
    body: (who) => `${who || "They"} has accepted the transfer.`,
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
