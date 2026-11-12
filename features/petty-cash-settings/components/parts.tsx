"use client";

/**
 * The pieces Petty Cash Settings' cards are drawn with, in the Settings frames' language (Figma
 * 353:999; there is no frame for this tab): the card (the shell's `SettingsCard`, folding under
 * its heading as Flask's did), a glyph, the searchable picker Flask's page asked with
 * (`picker()` in petty_cash_settings.js) and the busy overlay over a call. Colours are the
 * `set-*` tokens, fields and buttons `components/ui/settingsFields.ts` / `settingsButtons.ts`.
 */

import { useId, useState, type ReactNode } from "react";

import { Glyph as Icon } from "@/components/ui/Glyph";
import { SettingsCard } from "@/components/ui/SettingsShell";

// shared since 2026-11-12 (General's "Add an account" uses the same picker); the old names stay
export { Glyph as Icon } from "@/components/ui/Glyph";
export { settingsInputClass as inputClass } from "@/components/ui/settingsFields";
export { Combo, type ComboRow } from "@/components/ui/Combo";

/**
 * One card of the tab: the shell's white card (grey when read-only; a region named by its title),
 * its line under the title, and a chevron that folds the body (Flask's cards folded).
 */
export function PettyCashCard({
  title,
  lead,
  readOnly = false,
  testId,
  headerAction,
  children,
}: {
  title: string;
  lead: string;
  readOnly?: boolean;
  testId: string;
  /** A button at the title's right, before the fold chevron (Add New Method, owner 2026-11-12). */
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const titleId = useId();
  const bodyId = useId();
  return (
    <div data-settings-card={testId} className="min-w-0">
      <SettingsCard
        title={title}
        titleId={titleId}
        lead={lead}
        readOnly={readOnly}
        action={
          <div className="flex items-center gap-2">
            {open ? headerAction : null}
            <button
              type="button"
              aria-expanded={open}
              aria-controls={bodyId}
              aria-label={open ? `Fold ${title}` : `Show ${title}`}
              onClick={() => setOpen((o) => !o)}
              className="-mt-2.5 -mr-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-set-mute transition-colors hover:bg-set-pill hover:text-set-ink"
            >
              <Icon
                name="expand_more"
                className={`text-[24px] transition-transform duration-200 ease-out ${open ? "" : "-rotate-90"}`}
              />
            </button>
          </div>
        }
      >
        <div id={bodyId} hidden={!open} className="flex min-w-0 flex-col gap-4">
          {children}
        </div>
      </SettingsCard>
    </div>
  );
}

/** Flask's busy overlay (`#xeroLoadingOverlay`): the page held under a scrim, a card saying what is happening. */
export function BusyOverlay({ text }: { text: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[220] flex items-center justify-center bg-white/60 p-4 backdrop-blur-[3px]"
    >
      <div className="flex items-center gap-3 rounded-[14px] border border-set-edge bg-white px-6 py-4 text-sm font-medium text-set-ink-2 shadow-[0_12px_32px_rgba(0,0,0,0.16)]">
        <Icon name="progress_activity" className="animate-spin text-[24px] text-action" />
        <span>{text}</span>
      </div>
    </div>
  );
}
