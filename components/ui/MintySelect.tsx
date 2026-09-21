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
    <label htmlFor={id} className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5"
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
