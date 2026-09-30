"use client";

/**
 * A PDF drawn page by page onto canvases by pdf.js - what the Inv# preview shows
 * (`InvoicePreviewDialog`). A port of billing-frontend's `PdfJsCanvasRenderer`
 * (`components/PdfJsCanvasPreview.tsx`), cut to what our own invoice needs:
 *
 * - pdf.js loads with the first PDF shown (`import("pdfjs-dist")`), never with the page, and its
 *   worker is this app's own: `/pdfjs/pdf.worker.min.mjs`, which next.config.ts copies out of the
 *   installed pdfjs-dist - same-origin, never a CDN, never another version's.
 * - The bytes go in as DATA, never as an object URL. pdf.js TRANSFERS the buffer it is handed to
 *   its worker, which empties it on this side - so it is handed a copy, and the caller's bytes
 *   stay whole (for StrictMode's second run, or the same preview drawn again).
 * - No cMaps and no standard-font data: our invoices embed every font they use (fpdf2's TrueType
 *   subsets, Identity-H), which needs neither.
 * - A page is drawn at its true size (96 dpi), never wider than an A4 page's 794px, and narrower
 *   when its box is (a phone). The canvas behind it is sharper by the device pixel ratio, capped
 *   at 2 - an A4 page at 3x would hold some 32 MB of pixels.
 * - A page goes on screen once it is drawn; until the first one is, `placeholder` shows.
 * - A failure is LOUD: the error on the console, and `onError`'s sentence, which the dialog shows
 *   as an alert - never an empty box.
 * - Closing (unmount) or new bytes cancel the drawing and destroy the document and its worker.
 *
 * View-only by design: canvases, no text layer and no link layer - nothing to select, follow or
 * save.
 */

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";

import { INVOICE_PREVIEW_FAILED } from "@/features/subscription/lib/billing";

/** Copied there from node_modules/pdfjs-dist by next.config.ts on every start. */
const WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";
/** CSS pixels per PDF point: a page at its true size - 96 dpi over PDF's 72 points an inch. */
const TRUE_SIZE = 96 / 72;
/** An A4 page at 96 dpi: the widest a page is drawn. */
const MAX_PAGE_WIDTH = 794;
const MAX_PIXEL_RATIO = 2;

const PAGE_CLASS = "block h-auto w-full bg-white shadow-[0px_2px_8px_0px_rgba(0,0,0,0.06)]";

export function PdfPages({
  bytes,
  label,
  placeholder,
  onError,
}: {
  /** The PDF itself. pdf.js is handed a copy - see above. */
  bytes: Uint8Array;
  /** What the document is called: each page is "<label> — page n of N". */
  label: string;
  /** Shown until the first page is drawn. */
  placeholder?: ReactNode;
  /** The pages could not be drawn: the sentence to show. */
  onError: (message: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  // WHICH bytes have a page on screen: new bytes show the placeholder again until theirs does.
  const [drawn, setDrawn] = useState<Uint8Array | null>(null);
  // Not a dependency of the drawing: a parent passing a new function must not redraw it.
  const fail = useEffectEvent((err: unknown) => {
    console.error("The invoice preview could not draw the PDF (pdf.js):", err);
    onError(INVOICE_PREVIEW_FAILED);
  });

  useEffect(() => {
    const pages = host.current;
    if (!pages) return;
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;
        task = pdfjs.getDocument({ data: bytes.slice() });
        const doc = await task.promise;
        const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const natural = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: Math.min(TRUE_SIZE, MAX_PAGE_WIDTH / natural.width),
          });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width * ratio);
          canvas.height = Math.floor(viewport.height * ratio);
          // Its true width at most, the box's on a phone; the height follows the drawing.
          canvas.style.maxWidth = `${viewport.width}px`;
          canvas.className = PAGE_CLASS;
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", `${label} — page ${n} of ${doc.numPages}`);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("The browser gave no 2D canvas to draw the page on.");
          await page.render({
            canvasContext: context,
            viewport,
            transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
          }).promise;
          if (cancelled) return;
          pages.append(canvas);
          if (n === 1) setDrawn(bytes);
        }
      } catch (err) {
        // A cancelled drawing rejects too (the document destroyed under it): that is no failure.
        if (!cancelled) fail(err);
      }
    })();

    return () => {
      cancelled = true;
      pages.replaceChildren();
      // What the document's own destroy() does: cancels the page being drawn, ends the worker.
      void task?.destroy();
    };
  }, [bytes, label]);

  return (
    <>
      {drawn !== bytes && placeholder}
      <div ref={host} className="flex w-full flex-col items-center gap-4" />
    </>
  );
}
