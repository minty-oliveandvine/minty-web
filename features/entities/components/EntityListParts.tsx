/**
 * The select-company page's other pieces: the header (the payments app's header bar - the Minty
 * mark at the left, the title in the middle, the person's initials, which open My Profile, and
 * the ≡ on the right), the question with Minty, the search box, a group's heading, *Create a
 * business*, and the states the list can be in (loading, failed, no companies at all, nothing
 * matching the search).
 */

import Image from "next/image";

import { AppHeader } from "@/components/ui/AppHeader";

import {
  CREATE_BUSINESS,
  CREATE_ENTITY,
  createEntityHref,
  EMPTY_TEXT,
  EMPTY_TITLE,
  NO_MATCH,
  PAGE_TITLE,
  QUESTION,
  SEARCH_PLACEHOLDER,
} from "@/features/entities/lib/entityRows";

export function SelectCompanyHeader() {
  return <AppHeader title={PAGE_TITLE} showLogo centerTitle />;
}

/**
 * Part 15.8's selection header: the question, with a small Minty beside it from 640px - the
 * greeting's character, decorative (the words carry it). It replaced Flask's doors picture, which
 * pushed the list down, on 2026-10-19.
 */
export function SelectionQuestion() {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-display-m font-bold text-ink">{QUESTION}</h2>
      <Image
        className="hidden h-auto w-[80px] shrink-0 sm:block"
        src="/portal/minty-thinking.png"
        alt=""
        width={235}
        height={276}
        priority
        unoptimized
      />
    </div>
  );
}

/** A group's heading over its cards ("Needs you", "Your businesses"). */
export function GroupHeading({ id, children }: { id: string; children: string }) {
  return (
    <h3 id={id} className="text-title-m font-semibold text-ink-2">
      {children}
    </h3>
  );
}

/**
 * The search box, held at the top of the list while the rows scroll under it (the user's call,
 * 2026-09-29) - on the page's own grey, so nothing shows through around it, and above the rows'
 * pills. Its 8 px above and below keep Flask's spacing: 65 px under the doors, 24 over the rows.
 */
export function CompanySearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="sticky top-0 z-30 bg-canvas py-2">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          aria-label={SEARCH_PLACEHOLDER}
          autoComplete="off"
          className="h-11 w-full rounded-lg border border-line-input bg-card pl-3 pr-10 text-body-m text-ink-2 placeholder:text-ink-muted focus:border-line-selected focus:outline-none focus:ring-2 focus:ring-line-selected/25"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-ink-2">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

/**
 * A new company, through Minty's /entity/create and the onboarding wizard: a page-level
 * Secondary button under the list (Part 15.8 - "not floating"; it was a round "+" held to the
 * screen's corner until 2026-10-19). Full width on a phone.
 */
export function CreateBusinessButton() {
  return (
    <a
      href={createEntityHref()}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line-selected bg-card px-4 text-body-m font-semibold text-link transition-colors hover:bg-selected sm:w-auto sm:self-start"
    >
      <span className="material-symbols-rounded" aria-hidden>
        add
      </span>
      {CREATE_BUSINESS}
    </a>
  );
}

export function EntityListLoading() {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label="Loading your companies">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[60px] animate-pulse rounded-lg border border-line bg-sunk" />
      ))}
    </div>
  );
}

export function EntityListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center" role="alert">
      <p className="text-sm text-ink-2">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="h-11 cursor-pointer rounded-lg bg-action px-4 text-body-m font-semibold text-white hover:bg-action-hover active:bg-action-pressed"
      >
        Try again
      </button>
    </div>
  );
}

export function EntityListNoMatch() {
  return <p className="py-4 text-center text-sm text-ink-muted">{NO_MATCH}</p>;
}

/**
 * No company at all (Flask's `entity_list_empty.html`): the empty desk and a way to start one,
 * in the middle of the page.
 */
export function EntityListEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-8 p-5">
        <Image
          className="mx-auto mb-4 block h-auto w-[260px]"
          src="/entities/no_entity.webp"
          alt=""
          width={1296}
          height={729}
          unoptimized
        />
        <h2 className="text-display-m font-bold">{EMPTY_TITLE}</h2>
        <p className="max-w-md text-center">{EMPTY_TEXT}</p>
      </div>
      <div className="mb-6 mt-6 w-full max-w-md px-6">
        <a
          href={createEntityHref()}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-action px-4 text-body-m font-semibold text-white transition-colors hover:bg-action-hover active:bg-action-pressed"
        >
          <svg width="13" height="14" viewBox="0 0 13 14" fill="none" aria-hidden>
            <path
              d="M5.57143 5.69643V0.125H7.42857V5.69643H13V7.55357H7.42857V13.125H5.57143V7.55357H0V5.69643H5.57143Z"
              fill="white"
            />
          </svg>
          <span className="w-fit">{CREATE_ENTITY}</span>
        </a>
      </div>
    </div>
  );
}
