/**
 * One company on the select-company list - Flask's row (`templates/entity/index.html`), moved
 * as it looks: the "Setup in progress" pill over its top edge, the name, then the free-trial
 * badge, one badge per module that is on, the last-opened clock and the chevron. The whole row
 * leads into the company.
 *
 * In the list's manage mode (2026-11-10, "Archive companies") a row is not a link: just its name,
 * and Archive on each company not archived yet (`canArchive`) - a superuser's mode only, asked
 * first by the screen. Out of manage mode the row is unchanged, so a phone keeps the whole width for the name.
 *
 * An archived company (a superuser's list only) is not a link: it never opens until it is
 * restored. It carries a Neutral "Archived" pill where "Setup in progress" would sit, and a
 * Restore button in place of the clock and chevron.
 */

import Image from "next/image";

import type { EntityRow } from "@/features/entities/api/entities";
import {
  ARCHIVE,
  ARCHIVE_COMPANY,
  ARCHIVED,
  canArchive,
  enterHref,
  isArchived,
  isSettingUp,
  lastAccessedLabel,
  lastOpenedLabel,
  NOT_OPENED_YET,
  RESTORE,
  SETUP_IN_PROGRESS,
  trialLabel,
} from "@/features/entities/lib/entityRows";

const CLOCK_PATH =
  "m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z";

function ClockGlyph() {
  return (
    <svg className="h-4 w-4" viewBox="0 -960 960 960" fill="currentColor" aria-hidden>
      <path d={CLOCK_PATH} />
    </svg>
  );
}

/**
 * The free-trial badge: the design's own tag artwork (Figma "Group 345", the SVG Flask kept as
 * a symbol) in its pill, every measure the @2x spec's times 28/63 - the ratio that makes the
 * pill exactly as tall as the module badges beside it.
 */
function TrialBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex h-[28px] shrink-0 items-center justify-center rounded-[14.889px] bg-[rgba(79,199,199,0.15)] pb-[4.222px] pl-[11.778px] pr-[6.444px] pt-[4.222px]"
      role="img"
      title={label}
      aria-label={label}
    >
      <Image
        className="block h-[19.556px] w-[68.444px]"
        src="/entities/free-trial-tag.svg"
        alt=""
        width={154}
        height={44}
        unoptimized
      />
    </span>
  );
}

function LastOpened({ row }: { row: EntityRow }) {
  const when = lastAccessedLabel(row.last_accessed_at);
  if (!when) {
    return (
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-gray-400"
        role="img"
        title={NOT_OPENED_YET}
        aria-label={NOT_OPENED_YET}
      >
        <ClockGlyph />
      </span>
    );
  }
  return (
    <span className="group relative inline-flex">
      <span
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-500 text-white"
        role="img"
        aria-label={lastOpenedLabel(when, row.last_accessed_by)}
      >
        <ClockGlyph />
      </span>
      <span
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden whitespace-nowrap rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-right shadow-md group-hover:block"
        aria-hidden
      >
        <span className="block text-[12px] leading-snug text-gray-500">{when}</span>
        {row.last_accessed_by ? (
          <span className="block text-[12px] leading-snug text-gray-500">
            By {row.last_accessed_by}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function ManageCard({ row, onArchive }: { row: EntityRow; onArchive?: (row: EntityRow) => void }) {
  return (
    <li className="relative">
      <div className="flex min-h-[56px] w-full flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#f6f6f8] bg-white px-4 py-3 font-semibold text-[#1f2937] shadow-md">
        <span className="min-w-0 flex-1 truncate text-[17px]">{row.name}</span>
        {onArchive && canArchive(row) ? (
          <button
            type="button"
            onClick={() => onArchive(row)}
            aria-label={`${ARCHIVE_COMPANY} ${row.name}`}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-[12px] border border-red-200 px-4 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18c4c7]"
          >
            {ARCHIVE}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function ArchivedCard({
  row,
  onRestore,
}: {
  row: EntityRow;
  onRestore?: (row: EntityRow) => void;
}) {
  return (
    <li className="relative" data-archived="">
      <span className="absolute -top-2 left-3 z-10 rounded-full bg-gray-100 px-2.5 py-0.5 text-[12px] font-medium text-gray-600 shadow-sm">
        {ARCHIVED}
      </span>
      <div className="flex min-h-[56px] w-full flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#f6f6f8] bg-white px-4 py-3 font-semibold text-gray-500 shadow-md">
        <span className="min-w-0 flex-1 truncate text-[17px]">{row.name}</span>
        {onRestore ? (
          <button
            type="button"
            onClick={() => onRestore(row)}
            aria-label={`${RESTORE} ${row.name}`}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center rounded-[12px] border border-gray-300 px-4 text-sm font-semibold text-[#1f2937] transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18c4c7]"
          >
            {RESTORE}
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function EntityCard({
  row,
  onRestore,
  managing = false,
  onArchive,
}: {
  row: EntityRow;
  /** A superuser's Restore on an archived row; without it an archived row offers nothing. */
  onRestore?: (row: EntityRow) => void;
  /** The list's manage mode: the row is its name and, for an admin, Archive. */
  managing?: boolean;
  onArchive?: (row: EntityRow) => void;
}) {
  if (isArchived(row)) return <ArchivedCard row={row} onRestore={onRestore} />;
  if (managing) return <ManageCard row={row} onArchive={onArchive} />;
  const trial = trialLabel(row);
  return (
    // The pill hangs off this wrapper, not the link, so it is hidden with the card it labels.
    <li className="relative">
      {isSettingUp(row) ? (
        <span className="absolute -top-2 left-3 z-10 rounded-full bg-[#E6F9FA] px-2.5 py-0.5 text-[11px] font-medium text-[#1FA9B1] shadow-sm">
          {SETUP_IN_PROGRESS}
        </span>
      ) : null}
      <a
        href={enterHref(row)}
        className="flex min-h-[56px] w-full items-center justify-between gap-2 rounded-[12px] border border-[#f6f6f8] bg-white px-4 py-3 font-semibold text-[#1f2937] shadow-md transition-[background-color,transform,box-shadow] hover:-translate-y-0.5 hover:bg-gray-50 hover:shadow-lg"
      >
        <span className="min-w-0 flex-1 truncate text-[17px]">{row.name}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {trial ? <TrialBadge label={trial} /> : null}
          {row.modules.includes("PETTY_CASH") ? (
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF3D6]"
              role="img"
              title="Petty Cash"
              aria-label="Petty Cash module"
            >
              <Image
                className="h-4 w-4 object-contain"
                src="/entities/cash_reg.webp"
                alt=""
                width={678}
                height={569}
                unoptimized
              />
            </span>
          ) : null}
          {row.modules.includes("PAYMENT_REQUEST") ? (
            // The sidebar's Payment Request icon (@minty/shared SideMenu), its own disc included.
            <span
              className="inline-flex h-7 w-7"
              role="img"
              title="Bills"
              aria-label="Bills module"
            >
              <Image
                className="h-7 w-7"
                src="/menu/payment-request.svg"
                alt=""
                width={76}
                height={76}
                unoptimized
              />
            </span>
          ) : null}
          <LastOpened row={row} />
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M10.8234 9.99945L6.98561 13.8395L8.07324 14.9434L13.0142 9.99945L8.07324 5.05555L6.98561 6.15938L10.8234 9.99945Z"
              fill="#1F2937"
            />
          </svg>
        </span>
      </a>
    </li>
  );
}
