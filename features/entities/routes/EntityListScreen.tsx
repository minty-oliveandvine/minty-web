"use client";

/**
 * `/entities` - "Select Company", the hub's first page (it replaced Flask's /entity on
 * 2026-09-29), drawn as Part 15.8's context selection since 2026-10-19: the header bar across
 * the top (the Minty mark at the left, the title in the middle, the initials and the ≡ at the
 * right), and under it a centred 640px column - the question with Minty, the search box (from
 * seven companies), the companies that need the person ("Needs you", each saying why and what
 * to do), then the rest ("Your businesses", last used first), and *Create a business*.
 *
 * Under the header the screen scrolls as one, so the scrollbar is the screen's own right edge;
 * the header stays, and the search box stays at the top while the rows scroll under it.
 */

import { EntityCard } from "@/features/entities/components/EntityCard";
import {
  CompanySearch,
  CreateBusinessButton,
  EntityListEmpty,
  EntityListError,
  EntityListLoading,
  EntityListNoMatch,
  GroupHeading,
  SelectCompanyHeader,
  SelectionQuestion,
} from "@/features/entities/components/EntityListParts";
import { useEntityList, type UseEntityListArgs } from "@/features/entities/hooks/useEntityList";
import type { EntityRow } from "@/features/entities/api/entities";
import { NEEDS_YOU, YOUR_BUSINESSES } from "@/features/entities/lib/entityRows";

function Group({ id, title, rows }: { id: string; title: string; rows: EntityRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <GroupHeading id={id}>{title}</GroupHeading>
      <ul className="flex flex-col gap-2" aria-label={title}>
        {rows.map((row) => (
          <EntityCard key={row.id} row={row} />
        ))}
      </ul>
    </section>
  );
}

export function EntityListScreen(args: UseEntityListArgs) {
  const list = useEntityList(args);
  const empty = list.status === "ready" && !list.hasEntities;

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <SelectCompanyHeader />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">
        <main className="mx-auto flex min-h-full w-full max-w-[640px] flex-col pb-16 pt-6">
          {empty ? (
            <EntityListEmpty />
          ) : (
            <div className="flex flex-col gap-4">
              <SelectionQuestion />
              {list.searchable ? <CompanySearch value={list.query} onChange={list.setQuery} /> : null}
              {list.status === "loading" ? <EntityListLoading /> : null}
              {list.status === "error" ? (
                <EntityListError message={list.error ?? ""} onRetry={list.retry} />
              ) : null}
              {list.status === "ready" ? (
                <div className="flex flex-col gap-6">
                  <Group id="entities-needs-you" title={NEEDS_YOU} rows={list.needsYou} />
                  <Group id="entities-yours" title={YOUR_BUSINESSES} rows={list.others} />
                </div>
              ) : null}
              {list.status === "ready" && list.rows.length === 0 ? <EntityListNoMatch /> : null}
              {list.status === "ready" ? (
                <div className="flex flex-col pt-4">
                  <CreateBusinessButton />
                </div>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
