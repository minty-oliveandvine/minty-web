"use client";

/**
 * A labelled native <select>. The onboarding app's MintySelect is a custom listbox; the
 * skeletal version keeps its props (label, options, value, onChange) over the native control,
 * which is keyboard- and screen-reader-complete for free. The design pass may replace the
 * inside; the props are the contract.
 */

import { useId } from "react";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export function MintySelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  name,
}: {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-label font-semibold text-ink">{label}</span>
      <select
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 rounded-lg border border-line-input bg-card px-3 text-body-m text-ink focus:border-line-selected focus:outline-none focus:ring-2 focus:ring-line-selected/25 disabled:cursor-not-allowed disabled:bg-sunk"
      >
        {placeholder !== undefined && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
