"use client";

/**
 * The pager the portal's three tabs share (billing-frontend/components/profile/Pagination.tsx,
 * with the styling stripped). Page numbers are windowed to five. Render it only when there is
 * more than one page - it is deliberately not self-hiding, so a footer's layout stays the
 * caller's. Located in tests by its `aria-label`s, never by class.
 */

import { Icon } from "@/components/ui/Icon";

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  const size = 5;
  const start = Math.max(1, Math.min(page - Math.floor(size / 2), pages - size + 1));
  const numbers = Array.from({ length: Math.min(size, pages) }, (_, i) => start + i);
  const box =
    "inline-flex h-8 min-w-8 items-center justify-center rounded border border-[var(--border)] px-2 text-sm disabled:opacity-40";

  return (
    <nav className="flex items-center gap-1.5" aria-label="Pagination">
      <button
        type="button"
        className={box}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <Icon name="chevron-left" />
      </button>
      {numbers.map((n) => (
        <button
          key={n}
          type="button"
          className={`${box} ${n === page ? "font-semibold underline" : ""}`}
          onClick={() => onChange(n)}
          aria-current={n === page ? "page" : undefined}
        >
          {n}
        </button>
      ))}
      <button
        type="button"
        className={box}
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        aria-label="Next page"
      >
        <Icon name="chevron-right" />
      </button>
    </nav>
  );
}
