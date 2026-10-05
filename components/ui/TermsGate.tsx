"use client";

/**
 * The Terms & Conditions gate over every page of this app - Flask's request gate
 * (Minty `blueprints/legal/routes/gate.py`) as this app draws it. While the person owes an
 * acceptance, the page is inert behind `TermsModal`; accepting lifts it and they stay on the
 * page they are on. Since 2026-09-29 Flask's `/entity` hands the browser here whether or not
 * Terms are owed (always, since phase 2), so this is where most people meet them.
 *
 * - Asked once per token (`lib/terms.ts`), on every page but the open ones (`isOpenPath`: the
 *   landing, where the token arrives, and the two static pages) - and again after a
 *   client-side move, because the landing stores the token and then moves on without a reload.
 * - FAILS OPEN, as Flask's gate does: a check that errors shows the page and logs loudly. An
 *   outage is worse than a skipped backstop, and this one is a backstop - entering a company
 *   still passes Flask's own gate.
 * - The page behind still loads (inert, not hidden): the trade Flask's Select Company modal
 *   makes too - its list is readable behind the panel, entering a company is not possible.
 */

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { TermsModal } from "@/components/ui/TermsModal";
import { getAuth } from "@/lib/auth";
import { isOpenPath } from "@/lib/hubPaths";
import { fetchTerms, termsSettled, type OwedTerms } from "@/lib/terms";

export function TermsGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [owed, setOwed] = useState<OwedTerms | null>(null);
  // Bumped to read the Terms again - after a 409, when they changed under the reader.
  const [reading, setReading] = useState(0);

  useEffect(() => {
    if (isOpenPath(pathname)) return;
    const token = getAuth()?.token ?? "";
    if (!token || termsSettled(token)) return;
    const controller = new AbortController();
    fetchTerms(controller.signal)
      .then((status) => {
        if (!controller.signal.aborted) setOwed(status.owed ? status : null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
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
          terms={owed}
          onAccepted={() => setOwed(null)}
          onChanged={() => setReading((n) => n + 1)}
        />
      ) : null}
    </>
  );
}
