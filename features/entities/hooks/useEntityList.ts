"use client";

/**
 * The select-company list: load it, search it as a person types, and say what Flask flashed
 * on the way here. The screen calls this and renders what it returns.
 *
 * - A person choosing a company is in none. A token minted INSIDE one (the side menu's Select
 *   Entity from a company page) goes back through Flask for an unscoped one first, so the
 *   menu, the profile and every page after this one stop describing the company just left.
 * - `flash` (Flask's signed hand-over, `?flash=`) comes back from the API as `notices` - each
 *   is toasted once, and the parameter is dropped from the URL so a reload says nothing. It is
 *   read ONCE, at mount: dropping it from the URL must not read the list a second time.
 * - Order: "Setup in progress" first, then A→Z (`sortRows`), not Flask's most-recently-opened.
 * - Search is Flask's `filterCompanies`: case-insensitive, anywhere in the name, as typed.
 * - `fixture`: dev-only, `?fixture=LIST|EMPTY` (`__fixtures__/entities.ts`).
 * - Archived companies (2026-11-10): an admin turns on the list's manage mode ("Archive
 *   companies", offered only when they are an admin of a company listed) and archives a company
 *   from its row, asked first (refused while a module is still paid for - the API's sentence
 *   stays in the dialog). Only a
 *   superuser is sent archived companies: their list carries an All / Active / Archived filter
 *   (asked of the API, so a long list is never filtered here) and a Restore on each archived row,
 *   asked first. Either way the list is read again afterwards.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/apiClient";
import { isEntityScoped } from "@/lib/auth";
import { redirectToHandoff } from "@/lib/handoff";

import {
  archiveEntity,
  fetchEntities,
  restoreEntity,
  type ArchivedFilter,
  type EntityListAnswer,
  type EntityRow,
} from "@/features/entities/api/entities";
import {
  ARCHIVED_DONE,
  canArchive,
  filterRows,
  LOAD_FAILED,
  RESTORED,
  sortRows,
} from "@/features/entities/lib/entityRows";
import { ENTITIES_BASE_PATH } from "@/features/entities/lib/paths";

export type UseEntityListArgs = { flash?: string | null; fixture?: string | null };

export type EntityListStatus = "loading" | "error" | "ready";

/** The row whose Archive or Restore is being asked, in its confirm dialog. */
export type PendingAction = { kind: "archive" | "restore"; row: EntityRow };

type Loaded = {
  attempt: number;
  archived: ArchivedFilter;
  answer: EntityListAnswer | null;
  error: string | null;
};

async function load(
  flash: string | null,
  fixture: string | null,
  archived: ArchivedFilter,
  signal: AbortSignal,
): Promise<EntityListAnswer> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/entities/__fixtures__/entities");
    if (f.isEntityFixture(fixture)) return f.FIXTURES[fixture];
  }
  // "all" is the API's own default for a superuser, so the first read asks nothing extra.
  return fetchEntities({ flash, archived: archived === "all" ? undefined : archived, signal });
}

const failure = (err: unknown) =>
  err instanceof ApiError ? err.message : "Something went wrong on my end. Mind trying again?";

export function useEntityList({ flash = null, fixture = null }: UseEntityListArgs = {}) {
  const router = useRouter();
  const { showToast } = useToast();
  // The hand-over is read once: the URL loses it below, and that must not re-read the list.
  const [handOver] = useState(flash);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [query, setQuery] = useState("");
  const [archived, setArchivedState] = useState<ArchivedFilter>("all");
  const [managing, setManaging] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [pendingError, setPendingError] = useState("");
  const told = useRef(false);

  useEffect(() => {
    if (isEntityScoped()) {
      redirectToHandoff(ENTITIES_BASE_PATH);
      return;
    }
    const controller = new AbortController();
    // The hand-over rides only the first read: the filter re-reads without it.
    load(
      attempt === 0 && archived === "all" ? handOver : null,
      fixture,
      archived,
      controller.signal,
    )
      .then((answer) => {
        if (!controller.signal.aborted) setLoaded({ attempt, archived, answer, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // A 401 has already sent the browser for a fresh token; there is nothing to show.
        if (err instanceof ApiError && err.status === 401) return;
        setLoaded({
          attempt,
          archived,
          answer: null,
          error: err instanceof ApiError ? err.message : LOAD_FAILED,
        });
      });
    return () => controller.abort();
  }, [attempt, handOver, fixture, archived]);

  // Say what Flask flashed on the way here, once; then drop the spent hand-over from the URL.
  useEffect(() => {
    if (!loaded?.answer || told.current) return;
    told.current = true;
    for (const notice of loaded.answer.notices) showToast(notice.message, notice.category);
    if (handOver) router.replace(ENTITIES_BASE_PATH);
  }, [loaded, handOver, router, showToast]);

  const status: EntityListStatus =
    loaded === null || loaded.attempt !== attempt || loaded.archived !== archived
      ? "loading"
      : loaded.error
        ? "error"
        : "ready";
  const all = useMemo<EntityRow[]>(
    () => (status === "ready" ? sortRows(loaded?.answer?.entities ?? []) : []),
    [status, loaded],
  );
  const rows = useMemo(() => filterRows(all, query), [all, query]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const setArchived = useCallback((next: ArchivedFilter) => setArchivedState(next), []);
  const isSuperuser = Boolean(loaded?.answer?.is_superuser);
  const canManage = all.some(canArchive);

  return {
    status,
    error: status === "error" ? (loaded?.error ?? LOAD_FAILED) : null,
    rows,
    // A superuser looking at "Archived" with none is a no-match, not the "no company at all" page.
    hasEntities: all.length > 0 || (isSuperuser && archived !== "all"),
    query,
    setQuery,
    retry,
    isSuperuser,
    archived,
    setArchived,
    /** Manage mode: offered when the person is an admin of a listed company; off once none is. */
    canManage,
    managing: managing && canManage,
    toggleManaging: useCallback(() => setManaging((on) => !on), []),
    /** The Archive or Restore being asked, with its dialog's state. */
    pending,
    pendingBusy,
    pendingError,
    askArchive: useCallback((row: EntityRow) => {
      setPendingError("");
      setPending({ kind: "archive", row });
    }, []),
    askRestore: useCallback((row: EntityRow) => {
      setPendingError("");
      setPending({ kind: "restore", row });
    }, []),
    cancelPending: useCallback(() => {
      setPending(null);
      setPendingError("");
    }, []),
    // The refusal stays IN the dialog, so the person can read it and try again or go back.
    confirmPending: useCallback(async () => {
      if (!pending) return;
      setPendingBusy(true);
      setPendingError("");
      try {
        const answer =
          pending.kind === "archive"
            ? await archiveEntity(pending.row.id)
            : await restoreEntity(pending.row.id);
        showToast(
          answer.message || (pending.kind === "archive" ? ARCHIVED_DONE : RESTORED),
          "success",
        );
        setPending(null);
        setAttempt((n) => n + 1);
      } catch (err) {
        setPendingError(failure(err));
      } finally {
        setPendingBusy(false);
      }
    }, [pending, showToast]),
  };
}
