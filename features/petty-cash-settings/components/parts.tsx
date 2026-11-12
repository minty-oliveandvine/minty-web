"use client";

/**
 * The pieces Petty Cash Settings' cards are drawn with, in the Settings frames' language (Figma
 * 353:999; there is no frame for this tab): the card (the shell's `SettingsCard`, folding under
 * its heading as Flask's did), a glyph, the searchable picker Flask's page asked with
 * (`picker()` in petty_cash_settings.js) and the busy overlay over a call. Colours are the
 * `set-*` tokens, fields and buttons `components/ui/settingsFields.ts` / `settingsButtons.ts`.
 */

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { SettingsCard } from "@/components/ui/SettingsShell";
import {
  SETTINGS_INPUT,
  SETTINGS_INPUT_BAD,
  SETTINGS_INPUT_OK,
} from "@/components/ui/settingsFields";

/**
 * A Material Symbols glyph at the size its box sets. The font's unlayered `font-size: 24px` beats
 * any utility on the glyph itself, so the glyph inherits and the wrapper is sized.
 */
export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 ${className}`} aria-hidden="true">
      <span className="material-symbols-outlined" style={{ fontSize: "inherit" }}>
        {name}
      </span>
    </span>
  );
}

/** A field's own problem as it is typed: the red edge (`SETTINGS_INPUT_BAD`) or the usual one. */
export function inputClass(invalid: boolean): string {
  return `${SETTINGS_INPUT} ${invalid ? SETTINGS_INPUT_BAD : SETTINGS_INPUT_OK}`;
}

/**
 * One card of the tab: the shell's white card (grey when read-only; a region named by its title),
 * its line under the title, and a chevron that folds the body (Flask's cards folded).
 */
export function PettyCashCard({
  title,
  lead,
  readOnly = false,
  testId,
  children,
}: {
  title: string;
  lead: string;
  readOnly?: boolean;
  testId: string;
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
        }
      >
        <div id={bodyId} hidden={!open} className="flex min-w-0 flex-col gap-4">
          {children}
        </div>
      </SettingsCard>
    </div>
  );
}

/** One row of a picker's list: pickable, or a line of information (`info`). */
/** `sub`: a second, smaller line under the label (the Xero pickers' code); `divided`: a rule above it (Flask's "+ Add ... as a new contact"). */
export type ComboRow = {
  key: string;
  label: string;
  info?: boolean;
  selected?: boolean;
  muted?: boolean;
  sub?: string;
  divided?: boolean;
};

/**
 * Flask's searchable picker (`picker()` in petty_cash_settings.js): focus or a click lists
 * everything, typing filters, ↑/↓ move, Enter or a click picks, Escape and leaving the box close
 * it - and the box shows the current choice again (`onBlur`). Enter with the list closed is left
 * to the form, so it submits.
 */
export function Combo({
  id,
  value,
  placeholder,
  disabled = false,
  rows,
  onText,
  onPick,
  onBlur,
  rotateChevron = false,
  invalid = false,
  describedBy,
  required = false,
}: {
  id: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  /** The rows for what is typed ("" when the list opens on focus). */
  rows: (query: string) => ComboRow[];
  onText: (text: string) => void;
  onPick: (key: string) => void;
  onBlur: () => void;
  rotateChevron?: boolean;
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
}) {
  const listId = `${id}-suggestions`;
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const list = useRef<HTMLDivElement>(null);
  const shown = query === null ? [] : rows(query);
  const pickable = shown.filter((r) => !r.info);
  const open = shown.length > 0;

  useEffect(() => {
    if (active < 0) return;
    list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  function openList(q: string) {
    setQuery(q);
    setActive(-1);
  }

  function choose(key: string) {
    setQuery(null);
    setActive(-1);
    onPick(key);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    const count = pickable.length;
    if (e.key === "ArrowDown" && count) {
      e.preventDefault();
      setActive((a) => (a + 1) % count);
    } else if (e.key === "ArrowUp" && count) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? count - 1 : a - 1));
    } else if (e.key === "Enter") {
      if (active >= 0 && pickable[active]) {
        e.preventDefault();
        choose(pickable[active].key);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery(null);
      onBlur();
    }
  }

  return (
    <div className="relative min-w-0">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onFocus={(e) => {
          // a focus given back after a change (a contact just created) leaves the list shut
          if (e.currentTarget.dataset.quietFocus) {
            delete e.currentTarget.dataset.quietFocus;
            return;
          }
          openList("");
        }}
        onClick={() => {
          if (!open) openList("");
        }}
        onChange={(e) => {
          onText(e.target.value);
          openList(e.target.value.trim());
        }}
        onBlur={() => {
          setQuery(null);
          onBlur();
        }}
        onKeyDown={onKey}
        className={`${inputClass(invalid)} cursor-pointer pr-11 placeholder:text-set-mute disabled:cursor-not-allowed disabled:text-set-ink-2`}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-set-mute"
      >
        <Icon
          name="expand_more"
          className={`text-[22px] transition-transform ${rotateChevron && open ? "rotate-180" : ""}`}
        />
      </span>
      <div
        id={listId}
        ref={list}
        role="listbox"
        hidden={!open}
        className="absolute inset-x-0 top-[calc(100%+0.25rem)] z-50 max-h-60 overflow-y-auto rounded-[12px] border border-set-edge bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
      >
        {shown.map((row) => {
          if (row.info) {
            return (
              <div key={row.key} className="px-3.5 py-2.5 text-sm text-set-mute">
                {row.label}
              </div>
            );
          }
          const i = pickable.indexOf(row);
          return (
            <div
              key={row.key}
              id={`${listId}-${i}`}
              role="option"
              data-index={i}
              aria-selected={row.selected ? true : undefined}
              onMouseDown={(e) => {
                // mousedown, so the box's blur cannot close the list first
                e.preventDefault();
                choose(row.key);
              }}
              className={`flex min-h-11 cursor-pointer flex-col justify-center px-3.5 py-2 text-sm [overflow-wrap:anywhere] transition-colors hover:bg-set-pill ${
                row.selected
                  ? "bg-set-ok-bg font-semibold text-set-tab-ink"
                  : i === active
                    ? "bg-set-pill"
                    : ""
              } ${row.selected ? "" : row.muted ? "text-set-ink-2" : "text-set-ink"} ${row.divided ? "border-t border-set-line" : ""}`}
            >
              {row.sub ? (
                <>
                  <span className="block font-medium">{row.label}</span>
                  <span className="block text-xs font-normal text-set-mute">{row.sub}</span>
                </>
              ) : (
                row.label
              )}
            </div>
          );
        })}
      </div>
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
