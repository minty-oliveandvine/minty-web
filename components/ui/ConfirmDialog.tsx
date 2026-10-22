"use client";

/**
 * The confirmation modal's shell (Figma 04-G, section 06 and 06·B): a small white card over the
 * blurred page - the title with a module's (or a person's) name in its colour and Minty beside
 * it, "Entity" and the company in teal below it (or a lead line of its own, the declined card),
 * the sentences, the secondary
 * button (Go back; grey-edged, or teal for "Try again now" / "Discard changes") and the
 * confirming button in the tone the change calls for (teal to add, orange to change, red to
 * cancel). Escape and the backdrop take the secondary way out - or `onDismiss` where that is
 * not the safe one; while the change is being applied nothing closes it.
 *
 * Copied to minty-payment-request-web (features/subscription/components/ConfirmDialog.tsx) and ported to Flask (Minty `static/js/minty_dialog.js` + `static/css/minty_dialog.css`) - change all three.
 */

import Image from "next/image";
import { useId, type ReactNode } from "react";

import { ModalFrame } from "@/components/ui/ModalFrame";

/** The Minty pictures a modal can carry (public/portal/). */
export type ModalImage =
  | "celebrating"
  | "surprised"
  | "sad"
  | "super"
  | "payment_failed"
  | "dont"
  | "withdrawn"
  | "thumbs_up"
  | "envelope"
  | "hourglass";

export type ConfirmTone = "teal" | "orange" | "red";

export const MODAL_IMAGE: Record<ModalImage, { src: string; width: number; height: number }> = {
  celebrating: { src: "/portal/celebrating.png", width: 138, height: 144 },
  surprised: { src: "/portal/minty-surprised.png", width: 113, height: 144 },
  sad: { src: "/portal/minty-sad.png", width: 118, height: 144 },
  // 154, not the design's 152: the dialog pins the height (144) and lets the width follow,
  // and super-minty.png is 240x225, so 144 draws 153.6 -> 154. A width the browser does not
  // draw is a one-sided override, which next/image warns about on every open.
  super: { src: "/portal/super-minty.png", width: 154, height: 144 },
  payment_failed: { src: "/portal/minty-payment-failed.png", width: 118, height: 173 },
  dont: { src: "/portal/minty-dont.png", width: 100, height: 130 },
  withdrawn: { src: "/portal/minty-withdrawn.png", width: 112, height: 146 },
  thumbs_up: { src: "/portal/lemon-thumbs-up.png", width: 108, height: 135 },
  envelope: { src: "/portal/rejected-envelope.png", width: 126, height: 127 },
  hourglass: { src: "/portal/hourglass.png", width: 81, height: 127 },
};

/** Minty v2 has two confirming buttons: Primary, and Danger for what cannot be undone. */
export type ConfirmVariant = "primary" | "danger";

const CONFIRM_VARIANT: Record<ConfirmVariant, string> = {
  primary: "bg-action hover:bg-action-hover active:bg-action-pressed",
  danger: "bg-danger-action hover:bg-[var(--mv2-action-danger-hover)]",
};

// There is no orange action any more: an "orange" change is Primary unless the caller says it
// cannot be undone (`confirmVariant`). `data-tone` keeps the tone so callers can tell them apart.
const TONE_VARIANT: Record<ConfirmTone, ConfirmVariant> = {
  teal: "primary",
  orange: "primary",
  red: "danger",
};

export type BackTone = "grey" | "teal";

const BACK_TONE: Record<BackTone, string> = {
  // Both tones are the Secondary button now; the prop (and `data-tone`) is kept for callers.
  grey: "border-line-selected text-link hover:bg-selected",
  teal: "border-line-selected text-link hover:bg-selected",
};

export function ConfirmDialog({
  title,
  image,
  entityName,
  lead,
  busy,
  confirmLabel,
  confirmTone = "teal",
  confirmVariant,
  backLabel = "Go back",
  backTone = "grey",
  hideBack = false,
  onConfirm,
  onBack,
  onDismiss,
  children,
}: {
  title: ReactNode;
  image: ModalImage;
  /** "Entity" and the company; omitted when `lead` takes the slot. */
  entityName?: string | null;
  /** A line of its own in the company's slot (the card that declined). */
  lead?: ReactNode;
  busy: boolean;
  confirmLabel: string;
  confirmTone?: ConfirmTone;
  /** The button's look, when the tone alone does not say whether the change can be undone. */
  confirmVariant?: ConfirmVariant;
  backLabel?: string;
  backTone?: BackTone;
  /** One button only (a result to acknowledge): no secondary. */
  hideBack?: boolean;
  onConfirm: () => void;
  onBack: () => void;
  /** Escape and the backdrop, when the secondary button is not the safe way out. */
  onDismiss?: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const art = MODAL_IMAGE[image];
  const dismiss = onDismiss ?? onBack;

  return (
    <ModalFrame
      labelledBy={titleId}
      busy={busy}
      onDismiss={dismiss}
      className="max-w-[440px] rounded-xl border border-line bg-card p-6 shadow-modal max-sm:max-w-none max-sm:rounded-b-none"
    >
      {/*
          The company sits in the TITLE's column, tight under the last line of it and no wider
          (the design's 194px block under a 200px title) - so a long name wraps inside that
          column rather than running under Minty. The design pins the block at a fixed offset
          instead, which is why a four-line title overlaps it there by 4px; here it follows the
          title, so it is always clear of it however many lines the title takes. Only the
          sentences below and the buttons use the card's full width.
        */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-title-l font-semibold text-ink">
            {title}
          </h2>
          {/*
              CLEAR OF THE TITLE, not tucked under it. This used to be `-mt-1`, which pulled
              the block up against the last line of the title; the design leaves a gap there
              and a company name reads as part of the sentence without one.
            */}
          {lead !== undefined ? (
            <div className="mt-3 text-body-m break-words">{lead}</div>
          ) : entityName ? (
            <p className="mt-3 text-body-m break-words text-ink-2">
              Entity
              <br />
              {/* The COMPANY is coloured, the label above it is not: "Entity" is furniture,
                    the name is the thing the modal is about. (It was one grey for a while -
                    that reading of the design's single text node is superseded.) */}
              <span className="font-semibold text-ink">{entityName}</span>
            </p>
          ) : null}
        </div>
        <Image
          src={art.src}
          alt=""
          width={art.width}
          height={art.height}
          unoptimized
          data-image={image}
          style={{ height: art.height }}
          className="w-auto shrink-0"
        />
      </div>
      <div className="mt-4 flex flex-col gap-3 text-body-m text-ink-2">{children}</div>
      {/*
          Minty v2 modal actions: right-aligned, the way back (Secondary) first and the verb
          after it - one button on its own (`hideBack`) sits on the right too. Below 640px the
          card is a bottom sheet and the row stacks full width with the verb on top.
        */}
      <div className="mt-6 flex justify-end gap-3 max-sm:flex-col-reverse">
        {!hideBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            data-tone={backTone}
            className={`min-h-11 rounded-lg border bg-card px-4 py-2 text-body-m font-semibold leading-tight disabled:opacity-60 max-sm:w-full ${BACK_TONE[backTone]}`}
          >
            {backLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy || undefined}
          data-tone={confirmTone}
          // the transparent border keeps it the same height as the bordered button beside it
          className={`min-h-11 rounded-lg border border-transparent px-4 py-2 text-body-m font-semibold leading-tight text-white disabled:cursor-wait disabled:bg-action-disabled disabled:text-ink-disabled max-sm:w-full ${CONFIRM_VARIANT[confirmVariant ?? TONE_VARIANT[confirmTone]]}`}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalFrame>
  );
}
