"use client";

/**
 * `/entities` - "Select Company", the hub's first page (it replaced Flask's /entity on
 * 2026-09-29). The whole screen is the page (the user's calls, 2026-09-29 - it was Flask's
 * phone-shaped card fixed in the centre): the header bar across the top (the Minty mark at the
 * left, the title in the middle, the initials and the ≡ at the right), and under it Flask's
 * column in the middle - its widths (640 px from 640, 768 from 1024, 1024 from 1200; the whole
 * width on a phone) and its spacing: the doors, the search box and the companies' rows.
 *
 * Under the header the screen scrolls as one, so the scrollbar is the screen's own right edge;
 * the header stays, the search box stays at the top while the rows scroll under it, and the
 * "+" is held to the bottom-right corner.
 */

import { EntityCard } from "@/features/entities/components/EntityCard";
import {
  AddEntityButton,
  CompanySearch,
  DoorsHero,
  EntityListEmpty,
  EntityListError,
  EntityListLoading,
  EntityListNoMatch,
  SelectCompanyHeader,
} from "@/features/entities/components/EntityListParts";
import { useEntityList, type UseEntityListArgs } from "@/features/entities/hooks/useEntityList";

export function EntityListScreen(args: UseEntityListArgs) {
  const list = useEntityList(args);
  const empty = list.status === "ready" && !list.hasEntities;

  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      <SelectCompanyHeader />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto flex min-h-full w-full flex-col p-6 pb-40 min-[640px]:w-[640px] min-[1024px]:w-[768px] min-[1200px]:w-[1024px]">
          {empty ? (
            <EntityListEmpty />
          ) : (
            <div className="flex flex-col gap-4">
              <DoorsHero />
              <CompanySearch value={list.query} onChange={list.setQuery} />
              {list.status === "loading" ? <EntityListLoading /> : null}
              {list.status === "error" ? (
                <EntityListError message={list.error ?? ""} onRetry={list.retry} />
              ) : null}
              {list.status === "ready" ? (
                <ul className="flex flex-col gap-4" aria-label="Your companies">
                  {list.rows.map((row) => (
                    <EntityCard key={row.id} row={row} />
                  ))}
                </ul>
              ) : null}
              {list.status === "ready" && list.rows.length === 0 ? <EntityListNoMatch /> : null}
            </div>
          )}
        </main>
      </div>
      {empty ? null : <AddEntityButton />}
    </div>
  );
}
