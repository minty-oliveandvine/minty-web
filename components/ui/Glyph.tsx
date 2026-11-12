/**
 * A Material Symbols glyph at the size its box sets. The font's unlayered `font-size: 24px` beats
 * any utility on the glyph itself, so the glyph inherits and the wrapper is sized. (Petty Cash
 * Settings' `Icon`, shared since 2026-11-12.)
 */
export function Glyph({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 ${className}`} aria-hidden="true">
      <span className="material-symbols-outlined" style={{ fontSize: "inherit" }}>
        {name}
      </span>
    </span>
  );
}
