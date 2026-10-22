/**
 * One company on the select-company list - Flask's row (`templates/entity/index.html`): the
 * name, then the free-trial badge, one chip per module that is on (in the module's identity
 * wash), the last-opened clock and the chevron. A company in "Needs you" also says WHY and WHAT
 * TO DO, in words, under its name (`needsYou`; it was a "Setup in progress" pill until
 * 2026-10-19), and every card names the person's role there in plain secondary text
 * (`roleLabel`). The whole row leads into the company.
 */

import Image from "next/image";

import type { EntityRow } from "@/features/entities/api/entities";
import {
  enterHref,
  lastAccessedLabel,
  lastOpenedLabel,
  needsYou,
  NOT_OPENED_YET,
  roleLabel,
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
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-bg text-neutral"
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
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white"
        role="img"
        aria-label={lastOpenedLabel(when, row.last_accessed_by)}
      >
        <ClockGlyph />
      </span>
      <span
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden whitespace-nowrap rounded-md border border-line bg-card px-3 py-1.5 text-right shadow-overlay group-hover:block"
        aria-hidden
      >
        <span className="block text-label leading-snug text-ink-2">{when}</span>
        {row.last_accessed_by ? (
          <span className="block text-label leading-snug text-ink-2">
            By {row.last_accessed_by}
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function EntityCard({ row }: { row: EntityRow }) {
  const trial = trialLabel(row);
  const need = needsYou(row);
  const role = roleLabel(row.role);
  return (
    <li>
      <a
        href={enterHref(row)}
        // Phone: name (wrapping, never clipped) + chevron on the first line, the chips under it;
        // from 640px one row.
        className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-2 gap-y-2 rounded-lg border border-line bg-card px-5 py-4 font-semibold text-ink transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-hover sm:flex-nowrap"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="break-words text-title-m font-semibold sm:truncate">{row.name}</span>
          {role ? (
            <span className="text-body-s font-normal text-ink-2" data-role>
              {role}
            </span>
          ) : null}
          {need ? (
            // A failed payment is Danger, the rest Warning (Part 13 status tones) - icon and words.
            <span
              className={`flex items-start gap-1.5 text-body-s font-semibold ${need.tone === "danger" ? "text-danger" : "text-warning"}`}
              data-needs
              data-tone={need.tone}
            >
              <span className="material-symbols-rounded shrink-0" aria-hidden>
                {need.tone === "danger" ? "error" : "warning"}
              </span>
              <span>
                {need.reason} — {need.action}
              </span>
            </span>
          ) : null}
        </span>
        <span className="order-last flex w-full flex-wrap items-center gap-1.5 sm:order-none sm:w-auto sm:shrink-0 sm:flex-nowrap">
          {trial ? <TrialBadge label={trial} /> : null}
          {row.modules.includes("PETTY_CASH") ? (
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-module-pettycash-wash"
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
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-module-payment-wash text-module-payment-ink"
              role="img"
              title="Bills"
              aria-label="Bills module"
            >
              <svg className="h-4 w-4" viewBox="0 -960 960 960" fill="currentColor" aria-hidden>
                <path d="M200-280v-280h80v280h-80Zm240 0v-280h80v280h-80ZM80-120v-80h800v80H80Zm600-160v-280h80v280h-80ZM80-640v-60l400-220 400 220v60H80Zm178-80h444-444Zm0 0h444L480-841 258-720Z" />
              </svg>
            </span>
          ) : null}
          <LastOpened row={row} />
        </span>
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className="shrink-0 text-ink"
          aria-hidden
        >
          <path
            d="M10.8234 9.99945L6.98561 13.8395L8.07324 14.9434L13.0142 9.99945L8.07324 5.05555L6.98561 6.15938L10.8234 9.99945Z"
            fill="currentColor"
          />
        </svg>
      </a>
    </li>
  );
}
