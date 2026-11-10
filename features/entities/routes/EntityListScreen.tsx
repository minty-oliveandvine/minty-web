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
 * the header stays, the search box stays at the top while the rows scroll under it. A new
 * company is "Create company" in the Minty cat's pop-up at the bottom right (`useContactActions`;
 * a floating "+" there until 2026-11-05) - except on the empty page, whose own button says it.
 *
 * Archived companies (2026-11-10): an admin gets "Archive companies" under the search - the
 * list's manage mode, where each of their companies offers Archive, asked first ("Done" leaves
 * it); a
 * superuser also gets the All / Active / Archived switch above the search, and each archived
 * company's Restore, asked first.
 */

import { useContactActions, type ContactAction } from "@minty/shared/contact";
import { useMemo } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

import { EntityCard } from "@/features/entities/components/EntityCard";
import {
  ArchivedFilterSwitch,
  CompanySearch,
  DoorsHero,
  EntityListEmpty,
  EntityListError,
  EntityListLoading,
  EntityListNoMatch,
  SelectCompanyHeader,
} from "@/features/entities/components/EntityListParts";
import { useEntityList, type UseEntityListArgs } from "@/features/entities/hooks/useEntityList";
import {
  ARCHIVE_COMPANY,
  ARCHIVE_TEXT,
  ARCHIVE_TITLE,
  CREATE_COMPANY,
  createEntityHref,
  MANAGE_ARCHIVE,
  MANAGE_DONE,
  RESTORE,
  RESTORE_TEXT,
  RESTORE_TITLE,
} from "@/features/entities/lib/entityRows";

const NONE: ContactAction[] = [];

export function EntityListScreen(args: UseEntityListArgs) {
  const list = useEntityList(args);
  const empty = list.status === "ready" && !list.hasEntities;
  const create = useMemo<ContactAction[]>(
    () => [{ id: "create-company", label: CREATE_COMPANY, icon: "add", href: createEntityHref() }],
    [],
  );
  useContactActions(empty ? NONE : create);

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
              {list.isSuperuser ? (
                <ArchivedFilterSwitch value={list.archived} onChange={list.setArchived} />
              ) : null}
              <CompanySearch value={list.query} onChange={list.setQuery} />
              {list.status === "ready" && list.canManage ? (
                <div className="-mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={list.toggleManaging}
                    aria-pressed={list.managing}
                    className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-[12px] border border-gray-300 bg-white px-4 text-sm font-semibold text-[#1f2937] transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#18c4c7]"
                  >
                    {list.managing ? MANAGE_DONE : MANAGE_ARCHIVE}
                  </button>
                </div>
              ) : null}
              {list.status === "loading" ? <EntityListLoading /> : null}
              {list.status === "error" ? (
                <EntityListError message={list.error ?? ""} onRetry={list.retry} />
              ) : null}
              {list.status === "ready" ? (
                <ul className="flex flex-col gap-4" aria-label="Your companies">
                  {list.rows.map((row) => (
                    <EntityCard
                      key={row.id}
                      row={row}
                      onRestore={list.isSuperuser ? list.askRestore : undefined}
                      managing={list.managing}
                      onArchive={list.askArchive}
                    />
                  ))}
                </ul>
              ) : null}
              {list.status === "ready" && list.rows.length === 0 ? <EntityListNoMatch /> : null}
            </div>
          )}
        </main>
      </div>
      {list.pending ? (
        <ConfirmDialog
          title={
            list.pending.kind === "archive"
              ? ARCHIVE_TITLE(list.pending.row.name)
              : RESTORE_TITLE(list.pending.row.name)
          }
          image={list.pending.kind === "archive" ? "sad" : "thumbs_up"}
          busy={list.pendingBusy}
          confirmLabel={list.pending.kind === "archive" ? ARCHIVE_COMPANY : RESTORE}
          confirmTone={list.pending.kind === "archive" ? "red" : undefined}
          onConfirm={() => void list.confirmPending()}
          onBack={list.cancelPending}
        >
          <p>{list.pending.kind === "archive" ? ARCHIVE_TEXT : RESTORE_TEXT}</p>
          {list.pendingError ? (
            <p role="alert" className="text-red-600">
              {list.pendingError}
            </p>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
