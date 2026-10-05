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
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/apiClient";
import { isEntityScoped } from "@/lib/auth";
import { redirectToHandoff } from "@/lib/handoff";

import {
  fetchEntities,
  type EntityListAnswer,
  type EntityRow,
} from "@/features/entities/api/entities";
import { filterRows, LOAD_FAILED, sortRows } from "@/features/entities/lib/entityRows";
import { ENTITIES_BASE_PATH } from "@/features/entities/lib/paths";

export type UseEntityListArgs = { flash?: string | null; fixture?: string | null };

export type EntityListStatus = "loading" | "error" | "ready";

type Loaded = { attempt: number; answer: EntityListAnswer | null; error: string | null };

async function load(
  flash: string | null,
  fixture: string | null,
  signal: AbortSignal,
): Promise<EntityListAnswer> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/entities/__fixtures__/entities");
    if (f.isEntityFixture(fixture)) return f.FIXTURES[fixture];
  }
  return fetchEntities({ flash, signal });
}

export function useEntityList({ flash = null, fixture = null }: UseEntityListArgs = {}) {
  const router = useRouter();
  const { showToast } = useToast();
  // The hand-over is read once: the URL loses it below, and that must not re-read the list.
  const [handOver] = useState(flash);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [query, setQuery] = useState("");
  const told = useRef(false);

  useEffect(() => {
    if (isEntityScoped()) {
      redirectToHandoff(ENTITIES_BASE_PATH);
      return;
    }
    const controller = new AbortController();
    load(attempt === 0 ? handOver : null, fixture, controller.signal)
      .then((answer) => {
        if (!controller.signal.aborted) setLoaded({ attempt, answer, error: null });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // A 401 has already sent the browser for a fresh token; there is nothing to show.
        if (err instanceof ApiError && err.status === 401) return;
        setLoaded({
          attempt,
          answer: null,
          error: err instanceof ApiError ? err.message : LOAD_FAILED,
        });
      });
    return () => controller.abort();
  }, [attempt, handOver, fixture]);

  // Say what Flask flashed on the way here, once; then drop the spent hand-over from the URL.
  useEffect(() => {
    if (!loaded?.answer || told.current) return;
    told.current = true;
    for (const notice of loaded.answer.notices) showToast(notice.message, notice.category);
    if (handOver) router.replace(ENTITIES_BASE_PATH);
  }, [loaded, handOver, router, showToast]);

  const status: EntityListStatus =
    loaded === null || loaded.attempt !== attempt ? "loading" : loaded.error ? "error" : "ready";
  const all = useMemo<EntityRow[]>(
    () => (status === "ready" ? sortRows(loaded?.answer?.entities ?? []) : []),
    [status, loaded],
  );
  const rows = useMemo(() => filterRows(all, query), [all, query]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    status,
    error: status === "error" ? (loaded?.error ?? LOAD_FAILED) : null,
    rows,
    hasEntities: all.length > 0,
    query,
    setQuery,
    retry,
  };
}
