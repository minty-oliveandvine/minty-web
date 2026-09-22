"use client";

/**
 * The confirmation modal's shell (Figma 04-G and section 06): a small white card over the
 * blurred page - the title with a module's name in its colour and Minty beside it, "Entity" and
 * the company, the sentences, Go back and the confirming button in the tone the change calls
 * for (teal to add, orange to change, red to cancel). Escape and the backdrop go back; while
 * the change is being applied nothing closes it.
 */

import Image from "next/image";
import { useEffect, useId, type ReactNode } from "react";

import type { ConfirmTone, ModalImage } from "@/features/subscription/lib/changeModal";

export const MODAL_IMAGE: Record<ModalImage, { src: string; width: number; height: number }> = {
  celebrating: { src: "/portal/celebrating.png", width: 138, height: 144 },
  surprised: { src: "/portal/minty-surprised.png", width: 113, height: 144 },
  sad: { src: "/portal/minty-sad.png", width: 118, height: 144 },
  super: { src: "/portal/super-minty.png", width: 152, height: 144 },
};

const CONFIRM_TONE: Record<ConfirmTone, string> = {
  teal: "bg-[#4fc7c7]",
  orange: "bg-[#ea9713]",
  red: "bg-[#dc5a5a]",
};

export function ConfirmDialog({
  title,
  image,
  entityName,
  busy,
  confirmLabel,
  confirmTone = "teal",
  onConfirm,
  onBack,
  children,
}: {
  title: ReactNode;
  image: ModalImage;
  entityName: string;
  busy: boolean;
  confirmLabel: string;
  confirmTone?: ConfirmTone;
  onConfirm: () => void;
  onBack: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const art = MODAL_IMAGE[image];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onBack]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Go back"
        onClick={onBack}
        disabled={busy}
        className="absolute inset-0 cursor-default bg-white/60 backdrop-blur-[3px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[435px] rounded-[24px] border border-white/40 bg-white p-12 shadow-[0px_4px_8px_0px_rgba(15,23,42,0.08),0px_12px_32px_0px_rgba(0,0,0,0.1)]"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-[26px] font-bold leading-tight text-black">
            {title}
          </h2>
          <Image
            src={art.src}
            alt=""
            width={art.width}
            height={art.height}
            unoptimized
            data-image={image}
            className="-mr-3 -mt-2 h-[144px] w-auto shrink-0"
          />
        </div>
        <p className="mt-7 text-[15px] leading-snug text-[var(--ink-soft)]">
          Entity
          <br />
          <span className="text-black">{entityName}</span>
        </p>
        <div className="mt-6 flex flex-col gap-4 text-[15px] leading-snug text-[var(--ink-soft)]">
          {children}
        </div>
        <div className="mt-8 flex justify-end gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={busy}
            className="h-[66px] w-[169px] rounded-[14px] border border-[#737a87]/30 bg-white text-lg font-bold text-black hover:bg-gray-50 disabled:opacity-60"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
            data-tone={confirmTone}
            className={`h-[66px] w-[169px] rounded-[14px] text-lg font-bold leading-tight text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60 ${CONFIRM_TONE[confirmTone]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
