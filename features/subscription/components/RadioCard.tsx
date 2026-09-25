"use client";

/**
 * One choice in a picker (Figma 08-G's "Payment Methods" rows): a white card that turns teal-
 * edged when picked, holding a hidden radio, an optional mark (the card brand), a bold line and
 * a quiet one, and an optional chip at the end.
 *
 * THE RADIO IS `sr-only` AND THE LABEL IS THE CONTROL: the whole card is what gets clicked, and
 * keyboard focus lands on the radio inside it (arrows move between rows of one `name`, as a
 * radio group does). Playwright must click the label's TEXT - the brand mark intercepts a click
 * aimed at the radio's own box.
 *
 * Extracted from 07-E's card picker, which is its one user. (The billing-account pickers draw
 * onboarding's row instead - `AccountSheet.SheetRow` - as its sheet does.)
 */

import type { ReactNode } from "react";

export function RadioCard({
  name,
  value,
  checked,
  disabled = false,
  onSelect,
  leading,
  title,
  subtitle,
  trailing,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: (value: string) => void;
  /** Before the text - the card's brand mark. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** After the text - a chip saying why a row cannot be picked, or what it is. */
  trailing?: ReactNode;
}) {
  return (
    <label
      className={`flex items-center gap-5 rounded-xl border px-6 py-4 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.06)] ${
        checked ? "border-[#2e9b9b] bg-[#f5ffff]" : "border-[#eef1f4] bg-white"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(value)}
        className="sr-only"
      />
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-[#16202e]">{title}</span>
        {subtitle && <span className="block text-[13px] text-[#6b7380]">{subtitle}</span>}
      </span>
      {trailing}
    </label>
  );
}
