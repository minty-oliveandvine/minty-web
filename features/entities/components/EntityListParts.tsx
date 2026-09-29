/**
 * The select-company page's other pieces: the header (the payments app's header bar - the Minty
 * mark at the left, the title in the middle, the person's initials, which open My Profile, and
 * the ≡ on the right), the doors, the search box, the "+" for a new company, and the states the
 * list can be in (loading, failed, no companies at all, nothing matching the search).
 */

import Image from "next/image";

import { AppHeader } from "@/components/ui/AppHeader";

import {
  ADD_ENTITY,
  CREATE_ENTITY,
  createEntityHref,
  EMPTY_TEXT,
  EMPTY_TITLE,
  NO_MATCH,
  PAGE_TITLE,
  SEARCH_PLACEHOLDER,
} from "@/features/entities/lib/entityRows";

export function SelectCompanyHeader() {
  return <AppHeader title={PAGE_TITLE} showLogo centerTitle />;
}

/**
 * Flask's doors in Flask's box: at least 160 px tall (120 from 640 px), taller than the picture -
 * that is what gives the search box Flask's room above it.
 */
export function DoorsHero() {
  return (
    <div className="mx-auto mb-2 block min-h-[160px] w-80 sm:min-h-[120px] sm:w-60">
      <Image
        className="mx-auto block h-auto w-80 sm:w-60"
        src="/entities/select_company.webp"
        alt=""
        width={1446}
        height={524}
        priority
        unoptimized
      />
    </div>
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
    <div className="sticky top-0 z-30 bg-gray-50 py-2">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER}
          aria-label={SEARCH_PLACEHOLDER}
          autoComplete="off"
          className="w-full rounded-2xl border border-gray-300 bg-white py-3 pl-3 pr-10 text-gray-700 placeholder:text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#54D3DA]"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500">
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
 * The floating "+": a new company, through Minty's /entity/create and the onboarding wizard.
 * Held to the SCREEN's bottom-right corner, clear of a phone's home bar, over the scrolling list.
 */
export function AddEntityButton() {
  return (
    <a
      href={createEntityHref()}
      aria-label={ADD_ENTITY}
      title={ADD_ENTITY}
      className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom,0px))] right-6 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-[#54D3DA] shadow-xl transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#54D3DA]/80 sm:right-8 lg:right-10"
    >
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
        <path
          d="M16.0714 16.0714V10.5H17.9286V16.0714H23.5V17.9286H17.9286V23.5H16.0714V17.9286H10.5V16.0714H16.0714Z"
          fill="white"
        />
      </svg>
    </a>
  );
}

export function EntityListLoading() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading your companies">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[56px] animate-pulse rounded-[12px] bg-white shadow-md" />
      ))}
    </div>
  );
}

export function EntityListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center" role="alert">
      <p className="text-sm text-gray-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="cursor-pointer rounded-xl bg-[#54D3DA] px-5 py-2 text-sm font-medium text-white hover:bg-[#54D3DA]/80"
      >
        Try again
      </button>
    </div>
  );
}

export function EntityListNoMatch() {
  return <p className="py-4 text-center text-sm text-gray-400">{NO_MATCH}</p>;
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
        <h2 className="text-2xl font-bold">{EMPTY_TITLE}</h2>
        <p className="max-w-md text-center">{EMPTY_TEXT}</p>
      </div>
      <div className="mb-6 mt-6 w-full max-w-md px-6">
        <a
          href={createEntityHref()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#54D3DA] py-3 font-medium text-white shadow-md transition-colors hover:bg-[#54D3DA]/80"
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
