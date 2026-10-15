/**
 * A published legal document as a page - a port of Minty's `templates/legal/document.html`,
 * deleted when the documents moved here (2026-10-12). Used by `/terms`, `/terms/<version>`,
 * `/privacy` and `/privacy/<version>`.
 *
 * Four parts, all load-bearing:
 *
 *   1. the version and its effective date, as the registry spells them;
 *   2. "Superseded" on an archived version, so nobody mistakes an old agreement for the live one;
 *   3. the draft notice while the wording is not final (an unpinned fingerprint);
 *   4. THE FINGERPRINT AT THE FOOT. Minty's `blueprints/legal/routes/admin.py` tells whoever
 *      reads a person's consent history to check that row's `document_hash` against the document
 *      itself - this line is how, without database access. Do not remove it.
 *
 * The markup comes from `lib/legal/render.ts`, which HTML-escapes the Markdown before applying
 * any of the four constructs it understands, so `dangerouslySetInnerHTML` cannot inject anything
 * a legal document did not say. That renderer is the whole reason this is safe.
 *
 * No chrome: these pages are open paths (lib/hubPaths.ts), read by people who are held at the
 * Terms gate or have not signed up at all, so there is no sidebar, no company and nothing to
 * navigate - just the document, centred and capped, as Flask's page was.
 */

import type { LegalDocumentBody } from "@/lib/legal/document";

export function LegalDocumentPage({ document }: { document: LegalDocumentBody }) {
  return (
    <main className="mx-auto max-w-[820px] min-w-0 px-5 pt-8 pb-16">
      <div className="mb-6 border-b border-[var(--border)] pb-3 text-sm text-muted">
        Version <strong className="font-semibold">{document.version}</strong>
        {document.effective_date ? ` · Effective ${document.effective_date}` : ""}
        {document.is_current ? (
          ""
        ) : (
          <>
            {" · "}
            <strong className="font-semibold">Superseded</strong> — this is an archived version,
            kept so earlier agreements stay readable
          </>
        )}
      </div>

      {document.is_pinned ? null : (
        <div className="mb-6 rounded-md border border-[#fcd34d] bg-[#fffbeb] px-4 py-3 text-[0.9rem]">
          <strong className="font-semibold">Draft.</strong> This wording is not final and its
          fingerprint has not been pinned, so it must not be relied on outside local testing.
        </div>
      )}

      <div
        className="[&_h1]:mb-4 [&_h1]:text-[1.75rem] [&_h1]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2.5 [&_h2]:text-[1.15rem] [&_h2]:font-semibold [&_li]:mb-1.5 [&_li]:leading-relaxed [&_p]:mb-3 [&_p]:leading-[1.65] [&_ul]:mb-4 [&_ul]:ml-5 [&_ul]:list-disc"
        dangerouslySetInnerHTML={{ __html: document.html }}
      />

      <div className="mt-12 border-t border-[var(--border)] pt-4 text-xs break-all text-quiet">
        Document fingerprint (SHA-256): {document.sha256}
      </div>
    </main>
  );
}
