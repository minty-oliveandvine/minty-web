"use client";

/**
 * The Terms & Conditions gate over every page of this app - Flask's request gate
 * (Minty `blueprints/legal/routes/gate.py`) as this app draws it. While the person owes an
 * acceptance, the page is inert behind `TermsModal`; accepting lifts it and they stay on the
 * page they are on. Since 2026-09-29 Flask's `/entity` hands the browser here whether or not
 * Terms are owed (always, since phase 2), so this is where most people meet them.
 *
 * TWO READS, since the documents moved here (2026-10-12): Flask says WHICH version is owed and
 * what its fingerprint is (`lib/terms.ts`), then this app reads that version's text from its own
 * registry (`lib/legal/client.ts`). The two must agree - see the fail-open note below.
 *
 * - Asked once per token (`lib/terms.ts`), on every page but the open ones (`isOpenPath`: the
 *   landing, where the token arrives, the two static pages, and the legal documents themselves -
 *   this panel must never cover the page it is asking someone to read) - and again after a
 *   client-side move, because the landing stores the token and then moves on without a reload.
 * - FAILS OPEN, as Flask's gate does: a check that errors shows the page and logs loudly. That
 *   now includes a VERSION OR FINGERPRINT MISMATCH - if Flask names a version this app does not
 *   hold, or holds under a different hash, the two are deployed out of step and the only safe
 *   move is to show nobody a document Flask would misrecord. Nobody is locked out either: an
 *   outage is worse than a skipped backstop, and this one is a backstop - entering a company
 *   still passes Flask's own gate, which keeps blocking every Flask page.
 * - The page behind still loads (inert, not hidden): the same trade Flask's Select Company modal
 *   made - the company list is readable behind the panel, entering one is not possible.
 */

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { TermsModal } from "@/components/ui/TermsModal";
import { getAuth } from "@/lib/auth";
import { isOpenPath } from "@/lib/hubPaths";
import { fetchLegalDocument } from "@/lib/legal/client";
import { TERMS, type LegalDocumentBody } from "@/lib/legal/document";
import { fetchTerms, termsSettled, type OwedTerms } from "@/lib/terms";

type Owed = { status: OwedTerms; document: LegalDocumentBody };

export function TermsGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [owed, setOwed] = useState<Owed | null>(null);
  // Bumped to read the Terms again - after a 409, when they changed under the reader.
  const [reading, setReading] = useState(0);

  useEffect(() => {
    if (isOpenPath(pathname)) return;
    const token = getAuth()?.token ?? "";
    if (!token || termsSettled(token)) return;
    const controller = new AbortController();
    const signal = controller.signal;

    const ask = async (): Promise<Owed | null> => {
      const status = await fetchTerms(signal);
      if (!status.owed) return null;
      const document = await fetchLegalDocument(TERMS, status.document.version, signal);
      // The fingerprint Flask would record must be the fingerprint of what we are about to show.
      if (status.document.sha256 && status.document.sha256 !== document.sha256) {
        throw new Error(
          `Terms ${status.document.version}: Flask expects ${status.document.sha256}, this app holds ${document.sha256}`,
        );
      }
      return { status, document };
    };

    ask()
      .then((next) => {
        if (!signal.aborted) setOwed(next);
      })
      .catch((err: unknown) => {
        if (signal.aborted) return;
        console.error(
          "Terms check failed: showing the page WITHOUT the Terms gate (it fails open, as Flask's does).",
          err,
        );
      });
    return () => controller.abort();
  }, [pathname, reading]);

  const blocking = owed !== null && !isOpenPath(pathname);

  return (
    <>
      {/* Always this one wrapper, so the page is never remounted when the gate comes and goes. */}
      <div inert={blocking} aria-hidden={blocking || undefined}>
        {children}
      </div>
      {blocking ? (
        <TermsModal
          // A new version is a new reading: unticked, and locked until read to the end again.
          key={owed.document.version}
          document={owed.document}
          is_update={owed.status.is_update}
          previous_version={owed.status.previous_version}
          onAccepted={() => setOwed(null)}
          onChanged={() => setReading((n) => n + 1)}
        />
      ) : null}
    </>
  );
}
