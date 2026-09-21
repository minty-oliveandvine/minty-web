"use client";

/**
 * "Start Free Trial for {module}?" - asked straight from the list (Figma 04-G / 04-H). A small
 * white card over the blurred page: the module's name in its colour, the company, what a trial
 * means, Minty celebrating, Go back / Confirm. Escape and the backdrop go back.
 */

import Image from "next/image";
import { useEffect, useId } from "react";

import type { ModuleCode } from "@/features/subscription/api/moduleSettings";

const MODULE_COLOUR: Record<ModuleCode, string> = {
  PETTY_CASH: "text-[#ea9713]",
  PAYMENT_REQUEST: "text-info",
};

export function StartTrialDialog({
  entityName,
  code,
  moduleName,
  busy,
  onConfirm,
  onBack,
}: {
  entityName: string;
  code: ModuleCode;
  moduleName: string;
  busy: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const titleId = useId();

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
            Start
            <br />
            Free Trial for
            <br />
            <span className={MODULE_COLOUR[code]}>{moduleName}</span>
          </h2>
          <Image
            src="/portal/celebrating.png"
            alt=""
            width={138}
            height={144}
            unoptimized
            className="-mr-3 -mt-2 shrink-0"
          />
        </div>
        <p className="mt-7 text-[15px] leading-snug text-[var(--ink-soft)]">
          Entity
          <br />
          <span className="text-black">{entityName}</span>
        </p>
        <p className="mt-6 text-[15px] leading-snug text-[var(--ink-soft)]">
          You&apos;re activating the free trial for {moduleName}.
          <br />
          <br />
          You can activate the subscription anytime for uninterrupted access after the trial period.
          You will only be charged after the trial period.
        </p>
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
            className="h-[66px] w-[169px] rounded-[14px] bg-[#4fc7c7] text-lg font-bold text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
