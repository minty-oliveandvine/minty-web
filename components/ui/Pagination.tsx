"use client";

/**
 * The pager the portal's three tabs share (minty-payment-request-web/components/profile/Pagination.tsx,
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
    "inline-flex size-11 items-center justify-center rounded-lg border border-line bg-card px-2 text-body-m text-ink hover:bg-hover disabled:opacity-40 disabled:hover:bg-card";

  return (
    <nav className="flex items-center gap-2" aria-label="Pagination">
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
          className={`${box} ${n === page ? "border-line-selected bg-selected font-semibold text-link hover:bg-selected" : ""}`}
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
