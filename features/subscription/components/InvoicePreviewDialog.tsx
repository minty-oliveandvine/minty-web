"use client";

/**
 * The Inv# preview (08-B): the invoice's own PDF - the document the Invoice PDF column saves,
 * Figma 09-A - drawn page by page (`PdfPages`, pdf.js) in a dialog, to LOOK at. VIEW-ONLY by the
 * user's decision (2026-09-30, "preview is only preview no download"): no Download, Print or Open
 * control, and nothing is saved from here - the Invoice PDF column is the download. The pages are
 * canvases, so there is no browser PDF viewer, with a toolbar of its own, to hand the file to
 * either.
 *
 * On `ModalFrame`, never busy: a preview still on its way closes like any other - Escape, the
 * backdrop or the X. The card is minty-payment-request-web's attachment preview
 * (`lib/fileAttachmentPreview.tsx`, `FileAttachmentPreviewLayer`): a header that stays - the title
 * and the X - over a grey body that scrolls. The keyboard starts on the X and goes back, on
 * closing, to whatever had it when the dialog opened - the Inv# that opened it (`ModalFrame` does
 * neither).
 */

import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";

import { ModalFrame } from "@/features/subscription/components/ModalFrame";
import { PdfPages } from "@/features/subscription/components/PdfPages";
import type { InvoicePreview } from "@/features/subscription/hooks/useBillingPage";
import { INVOICE_PDF_FAILED, PREPARING_INVOICE } from "@/features/subscription/lib/billing";

export function InvoicePreviewDialog({
  preview,
  onClose,
}: {
  preview: InvoicePreview;
  onClose: () => void;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  // The PDF arrived and pdf.js could not draw it (`PdfPages` says so, in a sentence).
  const [drawError, setDrawError] = useState<string | null>(null);
  const title = `Invoice ${preview.reference}`;

  // Into the dialog on opening, and back where it was on closing: the dialog covers the page, and
  // a keyboard left behind it would tab through a page it cannot see.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    return () => opener?.focus();
  }, []);

  const error = preview.status === "error" ? (preview.error ?? INVOICE_PDF_FAILED) : drawError;
  const preparing = (
    <p role="status" className="py-16 text-center text-[15px] text-[#8b93a0]">
      {PREPARING_INVOICE}
    </p>
  );

  return (
    <ModalFrame
      labelledBy={titleId}
      busy={false}
      onDismiss={onClose}
      dismissLabel="Close preview"
      className="flex max-h-[min(92dvh,1180px)] w-full max-w-[860px] flex-col overflow-hidden rounded-[20px] bg-white shadow-[0px_4px_8px_0px_rgba(15,23,42,0.08),0px_12px_32px_0px_rgba(0,0,0,0.1)]"
    >
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#eef1f4] px-6 py-4">
        <h2 id={titleId} className="min-w-0 truncate text-[17px] font-bold text-[#16202e]">
          {title}
        </h2>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-[#8b93a0] hover:bg-[#f5f7fa] hover:text-[#16202e]"
        >
          <Icon name="close" size={20} />
        </button>
      </div>
      {/* The page at its true size fits the card's 860 with 32px a side; a phone's is narrower. */}
      <div className="min-h-0 flex-1 overflow-auto bg-[#f5f6f8] p-3 sm:px-8 sm:py-6">
        {error ? (
          <p role="alert" className="py-16 text-center text-[15px] text-[#b42318]">
            {error}
          </p>
        ) : preview.status === "ready" && preview.bytes ? (
          <PdfPages
            bytes={preview.bytes}
            label={title}
            placeholder={preparing}
            onError={setDrawError}
          />
        ) : (
          preparing
        )}
      </div>
    </ModalFrame>
  );
}
