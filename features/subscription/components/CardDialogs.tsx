"use client";

/**
 * What the billing page asks or tells about one card, on the `ConfirmDialog` shell: the card
 * that just arrived from the Stripe form (Figma 08-N "A-01 — make it the default?" and 08-S
 * "A-02 — result"), and removal - refused for the card everything is charged to (08-R), asked
 * for otherwise. The card's name is drawn in the design's orange in each one.
 */

import { ConfirmDialog } from "@/features/subscription/components/ConfirmDialog";
import {
  CARD_ADDED,
  CARD_ADDED_DEFAULT,
  CARD_ADDED_NOT_DEFAULT,
  CARD_ADDED_TAIL,
  REMOVE_BODY,
  REMOVE_DEFAULT_TAIL,
  REMOVE_DEFAULT_TITLE,
  REMOVE_TITLE,
  SET_AS_DEFAULT,
  cardTitle,
} from "@/features/subscription/lib/billing";
import type { AddedCard, CardPrompt } from "@/features/subscription/hooks/useBillingPage";

/** "Mastercard 8842" - how the modals name a card, shorter than the row's own line. */
export function shortCardName(brandLabel: string, last4: string | null): string {
  return last4 ? `${brandLabel || "Card"} ${last4}` : brandLabel || "Card";
}

function CardName({ text }: { text: string }) {
  return <span className="text-[#ea9713]">{text}</span>;
}

/** 08-N / 08-S: the card is saved; the only question left is whether it becomes the default. */
export function CardAddedDialog({
  added,
  busy,
  onSetDefault,
  onDone,
}: {
  added: AddedCard;
  busy: boolean;
  onSetDefault: () => void;
  onDone: () => void;
}) {
  const name = shortCardName(added.card.brand_label, added.card.last4);
  return (
    <ConfirmDialog
      title={
        <>
          {CARD_ADDED} <span className="text-[#54d3da]">{CARD_ADDED_TAIL}</span>
        </>
      }
      image="celebrating"
      lead={
        <p className="text-[#8b93a0]">
          <CardName text={name} /> is added successfully.
        </p>
      }
      busy={busy}
      confirmLabel="Done"
      confirmTone="teal"
      backLabel={SET_AS_DEFAULT}
      backTone="teal"
      hideBack={added.isDefault}
      onConfirm={onDone}
      onBack={onSetDefault}
      onDismiss={onDone}
    >
      <p>{added.isDefault ? CARD_ADDED_DEFAULT : CARD_ADDED_NOT_DEFAULT}</p>
    </ConfirmDialog>
  );
}

/**
 * Removal. The default card is REFUSED here rather than at the server (08-R): it is the card
 * every company on the account is charged to, so the page says which one to promote first and
 * offers nothing but the way back.
 */
export function RemoveCardDialog({
  prompt,
  busy,
  error,
  onConfirm,
  onBack,
}: {
  prompt: CardPrompt;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const name = shortCardName(prompt.row.card.brand_label, prompt.row.card.last4);
  if (prompt.kind === "remove_default") {
    return (
      <ConfirmDialog
        title={REMOVE_DEFAULT_TITLE}
        image="dont"
        busy={false}
        confirmLabel="Go back"
        confirmTone="teal"
        hideBack
        onConfirm={onBack}
        onBack={onBack}
      >
        <p>
          <CardName text={name} />
          {REMOVE_DEFAULT_TAIL}
        </p>
      </ConfirmDialog>
    );
  }
  return (
    <ConfirmDialog
      title={REMOVE_TITLE}
      image="surprised"
      lead={
        <p className="text-[#8b93a0]">
          <CardName text={cardTitle(prompt.row.card)} />
        </p>
      }
      busy={busy}
      confirmLabel={busy ? "Removing…" : "Remove"}
      confirmTone="red"
      onConfirm={onConfirm}
      onBack={onBack}
    >
      <p>{REMOVE_BODY}</p>
      {error && (
        <p role="alert" className="text-[#b42318]">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}
