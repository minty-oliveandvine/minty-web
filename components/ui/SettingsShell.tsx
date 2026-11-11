"use client";

/**
 * A company settings tab's frame (Figma 353:999, owner 2026-11-10): the shared settings page
 * (`components/ui/SettingsPage`) with the tabs this company has - the page's own module list once
 * it is here, the token's claims until then (`lib/moduleClaims.ts`) - and the pieces every tab's
 * content is built from: the white card, the view-only line, the loading state and the dialog.
 */

import { useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { SettingsPage } from "@/components/ui/SettingsPage";
import type { CompanySettingsTab } from "@/lib/hubPaths";
import { getModuleClaims, type ModuleClaims } from "@/lib/moduleClaims";

export function SettingsShell({
  company,
  modules,
  tab,
  children,
}: {
  company: { id: string; name: string };
  /** The company's module codes, once the page has them. */
  modules: string[] | null;
  tab: CompanySettingsTab;
  children: ReactNode;
}) {
  const access = useMemo<ModuleClaims>(
    () =>
      modules
        ? {
            pettyCash: modules.includes("PETTY_CASH"),
            billing: modules.includes("PAYMENT_REQUEST"),
          }
        : getModuleClaims(),
    [modules],
  );
  return (
    <SettingsPage company={company} access={access} tab={tab}>
      {children}
    </SettingsPage>
  );
}

/**
 * The frames' card: white, a hairline edge, radius 14, its title and line, then its body. A card
 * with a title is a region named by it, so a screen reader can list and jump between the cards.
 */
export function SettingsCard({
  title,
  titleId,
  lead,
  readOnly = false,
  action,
  children,
}: {
  title?: ReactNode;
  /** Set when the card's title names a control inside it (SET-G's name field). */
  titleId?: string;
  lead?: ReactNode;
  readOnly?: boolean;
  /** A control at the title's right (Invite). */
  action?: ReactNode;
  children: ReactNode;
}) {
  const ownId = useId();
  const headingId = titleId ?? ownId;
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={`flex min-w-0 flex-col gap-4 rounded-[14px] border border-set-edge p-5 sm:p-6 ${readOnly ? "bg-set-pill" : "bg-white"}`}
    >
      {title || lead || action ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {title ? (
              <h3 id={headingId} className="text-base font-bold text-set-ink">
                {title}
              </h3>
            ) : null}
            {lead ? <p className="text-[13px] text-set-ink-2">{lead}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Why the controls are dead: a quiet line above the cards. */
export function ReadOnlyNotice({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-[12px] border border-set-line bg-set-pill px-4 py-3 text-[13px] text-set-ink-2"
    >
      <span
        className="material-symbols-outlined shrink-0 text-[18px] leading-none text-set-mute"
        aria-hidden
      >
        visibility
      </span>
      <span>{children}</span>
    </div>
  );
}

export function LoadState({
  status,
  error,
  onRetry,
}: {
  status: "loading" | "error";
  error?: string;
  onRetry: () => void;
}) {
  return status === "loading" ? (
    <p className="mt-6 text-center text-sm text-set-mute" role="status">
      Loading…
    </p>
  ) : (
    <div className="mt-6 text-center" role="alert">
      <p className="text-sm text-danger">{error}</p>
      <button
        type="button"
        className="mt-2 min-h-11 text-sm text-set-ink-2 underline"
        onClick={onRetry}
      >
        Try again
      </button>
    </div>
  );
}

/**
 * The frames' dialog (SET-1b, SET-2b): the #111313 scrim at 48%, a white card (radius 16, 460px,
 * full width less the gutter on a phone), its title, its words and its buttons on the right.
 * Escape and the scrim close it unless `busy`; focus starts on the first button and comes back
 * to whatever opened it. Over the sidebar drawer (z-200).
 */
export function SettingsDialog({
  title,
  busy = false,
  onClose,
  actions,
  children,
}: {
  title: string;
  busy?: boolean;
  onClose: () => void;
  actions: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    card.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    return () => opener?.focus?.();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        disabled={busy}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[rgb(17_19_19/0.48)]"
      />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-[460px] flex-col gap-3 rounded-[16px] bg-white px-5 pt-6 pb-5 shadow-[0_12px_32px_rgba(0,0,0,0.16)] sm:px-7 sm:pt-7 sm:pb-6"
      >
        <h2 id={titleId} className="text-lg font-bold text-set-ink">
          {title}
        </h2>
        <div className="text-sm text-set-ink-2">{children}</div>
        <div className="flex flex-wrap justify-end gap-3 pt-3">{actions}</div>
      </div>
    </div>,
    document.body,
  );
}
