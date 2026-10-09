"use client";

/**
 * Six one-digit boxes for the emailed code. Typing moves on, Backspace on an empty box moves
 * back; a paste or a phone's one-shot autofill (Android sends the whole code as ONE change)
 * spreads across the boxes - a full code from the first box wherever it was dropped. Enter in
 * any box submits (the form's own submit).
 */

import { useRef } from "react";

export const CODE_LENGTH = 6;

export function CodeInput({
  digits,
  onChange,
  disabled,
}: {
  digits: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
}) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  const fillFrom = (start: number, raw: string) => {
    const chars = raw.replace(/\D/g, "").split("");
    if (chars.length === 0) return;
    const next = [...digits];
    for (let n = 0; n < chars.length && start + n < CODE_LENGTH; n += 1) next[start + n] = chars[n];
    onChange(next);
    boxes.current[Math.min(start + chars.length, CODE_LENGTH - 1)]?.focus();
  };

  const setDigit = (i: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    if (cleaned.length > 1) {
      fillFrom(i, cleaned);
      return;
    }
    const next = [...digits];
    next[i] = cleaned.slice(-1);
    onChange(next);
    if (next[i] && i < CODE_LENGTH - 1) boxes.current[i + 1]?.focus();
  };

  return (
    <div
      className="flex justify-between gap-2"
      role="group"
      aria-label="Your 6-digit code"
      aria-required="true"
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          value={d}
          disabled={disabled}
          // A phone's autofill delivers all six digits to the first box at once.
          maxLength={i === 0 ? CODE_LENGTH : 1}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
            if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < CODE_LENGTH - 1) boxes.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
            if (!pasted) return;
            e.preventDefault();
            fillFrom(pasted.length >= CODE_LENGTH ? 0 : i, pasted);
          }}
          className="h-14 w-full min-w-0 max-w-[52px] rounded-lg border border-gray-300 text-center text-xl font-semibold text-ink focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/30 disabled:bg-gray-50"
        />
      ))}
    </div>
  );
}
