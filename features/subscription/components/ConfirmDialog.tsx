"use client";

/**
 * The confirmation modal's shell (Figma 04-G, section 06 and 06·B): a small white card over the
 * blurred page - the title with a module's name in its colour and Minty beside it, "Entity" and
 * the company (or a lead line of its own, the declined card), the sentences, the secondary
 * button (Go back; grey-edged, or teal for "Try again now" / "Discard changes") and the
 * confirming button in the tone the change calls for (teal to add, orange to change, red to
 * cancel). Escape and the backdrop take the secondary way out - or `onDismiss` where that is
 * not the safe one; while the change is being applied nothing closes it.
 */

import Image from "next/image";
import { useEffect, useId, type ReactNode } from "react";

import type { ConfirmTone, ModalImage } from "@/features/subscription/lib/changeModal";

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

const CONFIRM_TONE: Record<ConfirmTone, string> = {
  teal: "bg-[#4fc7c7]",
  orange: "bg-[#ea9713]",
  red: "bg-[#dc5a5a]",
};

export type BackTone = "grey" | "teal";

const BACK_TONE: Record<BackTone, string> = {
  grey: "border-[#737a87]/30 font-bold text-black hover:bg-gray-50",
  teal: "border-[#18c4c7] text-[#4fc7c7] hover:bg-[#f5ffff]",
};

export function ConfirmDialog({
  title,
  image,
  entityName,
  lead,
  busy,
  confirmLabel,
  confirmTone = "teal",
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, dismiss]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Go back"
        onClick={dismiss}
        disabled={busy}
        className="absolute inset-0 cursor-default bg-white/60 backdrop-blur-[3px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[435px] rounded-[24px] border border-white/40 bg-white p-12 shadow-[0px_4px_8px_0px_rgba(15,23,42,0.08),0px_12px_32px_0px_rgba(0,0,0,0.1)]"
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
            <h2 id={titleId} className="text-[26px] font-bold leading-tight text-black">
              {title}
            </h2>
            {lead !== undefined ? (
              <div className="-mt-1 text-[15px] leading-snug break-words">{lead}</div>
            ) : entityName ? (
              <p className="-mt-1 text-[15px] leading-snug break-words text-[#737a87]">
                Entity
                <br />
                {/* one colour for both lines, as the design's single text node draws them */}
                <span>{entityName}</span>
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
            className="-mr-3 -mt-2 w-auto shrink-0"
          />
        </div>
        <div className="mt-6 flex flex-col gap-4 text-[15px] leading-snug text-[var(--ink-soft)]">
          {children}
        </div>
        {/*
          The design's button row is WIDER than the card's padding: 169px each, a 20px gap,
          and 39px to each edge (435 - 39 - 169 - 20 - 169 - 38). The card's p-12 leaves only
          339px, so the row reaches back out by 9px a side and the two buttons share what is
          left - which lands them on 169px again, without pinning a width that a longer label
          ("Confirm Cancellation") could not wrap inside. One button on its own (`hideBack`) is
          centred at the fixed 169px, as the design draws that case.
        */}
        <div className={`mt-8 flex gap-5 ${hideBack ? "justify-center" : "-mx-[9px]"}`}>
          {!hideBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={busy}
              data-tone={backTone}
              className={`h-[66px] flex-1 rounded-[14px] border bg-white text-lg leading-tight disabled:opacity-60 ${BACK_TONE[backTone]}`}
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
            // the transparent border matters: with `flex-1` the bordered button beside it would
            // otherwise end up 2px wider, both being basis-0 under border-box
            className={`h-[66px] rounded-[14px] border border-transparent text-lg font-bold leading-tight text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60 ${
              hideBack ? "w-[169px]" : "flex-1"
            } ${CONFIRM_TONE[confirmTone]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
