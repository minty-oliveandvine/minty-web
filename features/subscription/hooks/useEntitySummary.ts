"use client";

/**
 * The open row's data (Figma 05·A): when a company's row opens, its page model and its nominated
 * card are fetched and turned into the summary view (`lib/subscriptionSummary.ts`). Nothing is
 * fetched for a closed row; opening another company drops this one's answer.
 *
 * The card is a nicety: `/api/me/billing/entity-payment-method` reads Stripe, and a failure
 * there (or a 403 for someone who is not the payer) leaves the panel without its payment-method
 * column rather than taking the row down. The page model is not: without it there is nothing
 * to show, and the row says so with a retry.
 *
 * The pending ticks (05·B) live here too, beside the answer they change: `toggleTick` flips a
 * module's tick (or undoes it), the view is rebuilt from the same page model, and the ticks are
 * dropped when the row closes, the company changes, or the answer is fetched again.
 *
 * "Calculating…" (05·B-C, one per destination): while the page model loads the row already
 * shows its cards, drawn from what the list knows of the company (`pageFromList`), and the
 * panel calculates; a tick shows the calculating panel for `CALCULATING_MS` before the changed
 * panel appears - the design's beat, not a wait for anything.
 *
 * `fixture`: dev-only, as the list's - the 05·A frames served from `__fixtures__/modulePage.ts`
 * when the switch names one (`?summary=M44`).
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/apiClient";

import {
  getModulePage,
  type ModuleCode,
  type ModulePage,
} from "@/features/subscription/api/moduleSettings";
import {
  fetchEntityPaymentMethod,
  type EntityPaymentMethod,
  type PortalEntity,
} from "@/features/subscription/api/payerPortal";
import {
  buildSummaryView,
  pageFromList,
  toggleTick,
  type PendingTicks,
  type SummaryView,
} from "@/features/subscription/lib/subscriptionSummary";

/** How long the panel says "Calculating…" after a tick (Figma 05·B-C: "auto-advances after 1.2s"). */
export const CALCULATING_MS = 1200;

export type SummaryStatus = "idle" | "loading" | "ready" | "error";

export type UseEntitySummaryResult = {
  status: SummaryStatus;
  /** The panel is calculating: the page model is loading, or a tick was pressed just now. */
  calculating: boolean;
  view: SummaryView | null;
  /** The company's page model as loaded - what a confirmed change is applied against. */
  page: ModulePage | null;
  error: string | null;
  reload: () => void;
  /** Flip one module's pending tick (a second press undoes it). */
  toggleTick: (code: ModuleCode) => void;
  /**
   * Set the pending ticks of a company outright (the ⋮'s items, 05·D) - by id, because the row
   * may have been opened in the same breath and this hook not yet handed that company.
   */
  setTicksFor: (entityId: string, pending: PendingTicks) => void;
  /** Drop every pending tick. */
  resetTicks: () => void;
};

export const SUMMARY_LOAD_FAILED = "We couldn’t load this subscription.";

/** One shared "nothing pending", so the view is not rebuilt on every render. */
const NO_TICKS: PendingTicks = {};

function sentence(err: unknown): string {
  if (err instanceof ApiError && err.status !== 404 && err.status !== 501) return err.message;
  return SUMMARY_LOAD_FAILED;
}

async function loadSummary(
  entity: PortalEntity,
  fixture: string | null | undefined,
  signal: AbortSignal,
): Promise<{ page: ModulePage; wallet: EntityPaymentMethod | null; today: Date | null }> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/modulePage");
    if (fixture in f.SUMMARY_FIXTURES) {
      const page = f.SUMMARY_FIXTURES[fixture as keyof typeof f.SUMMARY_FIXTURES];
      return { page, wallet: f.WALLET, today: f.TODAY };
    }
  }
  const [page, wallet] = await Promise.all([
    getModulePage(entity.entity_id),
    fetchEntityPaymentMethod(entity.entity_id, signal).catch(() => null),
  ]);
  return { page, wallet, today: null };
}

/** What one fetch answered, for which company and which attempt. */
type Answer = {
  entityId: string;
  generation: number;
  status: "ready" | "error";
  page: ModulePage | null;
  wallet: EntityPaymentMethod | null;
  today: Date;
  error: string | null;
};

export function useEntitySummary(
  entity: PortalEntity | null,
  { fixture, today }: { fixture?: string | null; today?: Date } = {},
): UseEntitySummaryResult {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [generation, setGeneration] = useState(0);
  // Keyed by company and attempt, so a stale set of ticks never survives a new answer.
  const [ticks, setTicks] = useState<{ key: string; pending: PendingTicks } | null>(null);

  const entityId = entity?.entity_id ?? null;

  useEffect(() => {
    if (!entity) return;
    const controller = new AbortController();
    (async () => {
      try {
        const loaded = await loadSummary(entity, fixture, controller.signal);
        if (controller.signal.aborted) return;
        setAnswer({
          entityId: entity.entity_id,
          generation,
          status: "ready",
          page: loaded.page,
          wallet: loaded.wallet,
          today: loaded.today ?? today ?? new Date(),
          error: null,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setAnswer({
          entityId: entity.entity_id,
          generation,
          status: "error",
          page: null,
          wallet: null,
          today: new Date(),
          error: sentence(err),
        });
      }
    })();
    return () => controller.abort();
    // The company is identified by its id: a fresh row object for the same company must not
    // refetch. `entity` (for created_at) and `today` are read from the closure of that fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, fixture, generation]);

  const reload = useCallback(() => setGeneration((g) => g + 1), []);

  // Derived, never set in the effect: no company = idle; an answer for this company and this
  // attempt = what it said; anything else = still loading.
  const current =
    entity && answer && answer.entityId === entity.entity_id && answer.generation === generation
      ? answer
      : null;
  const key = entity ? `${entity.entity_id}#${generation}` : "";
  const pending = ticks && ticks.key === key ? ticks.pending : NO_TICKS;

  // The design's beat after a tick: the panel calculates for a moment, the cards flip at once.
  const [calcUntil, setCalcUntil] = useState<{ key: string; at: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!calcUntil || calcUntil.key !== key) return;
    const wait = calcUntil.at - Date.now();
    if (wait <= 0) return;
    const id = window.setTimeout(() => setNow(Date.now()), wait);
    return () => window.clearTimeout(id);
  }, [calcUntil, key, now]);

  // The view is rebuilt from the answer and the pending ticks. An answer the API should never
  // give (a page model without its cards) fails here, in render, so it is caught here: the row
  // shows its retry rather than the screen coming down. Before the answer, the cards the list
  // already knows, with no panel to draw.
  const built = useMemo((): { view: SummaryView | null; error: string | null } => {
    if (!entity) return { view: null, error: null };
    if (!current?.page) {
      if (current?.status === "error") return { view: null, error: null };
      try {
        const view = buildSummaryView(pageFromList(entity), entity, null, today ?? new Date());
        return { view: view.modules.length > 0 ? view : null, error: null };
      } catch {
        return { view: null, error: null };
      }
    }
    try {
      const view = buildSummaryView(current.page, entity, current.wallet, current.today, pending);
      return { view, error: null };
    } catch {
      return { view: null, error: SUMMARY_LOAD_FAILED };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, entityId, pending]);

  const status: SummaryStatus = !entity
    ? "idle"
    : !current
      ? "loading"
      : built.error
        ? "error"
        : current.status;

  const toggleTickFor = useCallback(
    (code: ModuleCode) => {
      const card = current?.page?.cards.find((c) => c.code === code);
      if (!card || !key) return;
      setTicks((t) => ({ key, pending: toggleTick(t && t.key === key ? t.pending : {}, card) }));
      const at = Date.now() + CALCULATING_MS;
      setCalcUntil({ key, at });
      setNow(Date.now());
    },
    [current, key],
  );
  const resetTicks = useCallback(() => setTicks(null), []);
  const setTicksFor = useCallback(
    (forEntityId: string, pending: PendingTicks) => {
      setTicks({ key: `${forEntityId}#${generation}`, pending });
      const at = Date.now() + CALCULATING_MS;
      setCalcUntil({ key: `${forEntityId}#${generation}`, at });
      setNow(Date.now());
    },
    [generation],
  );

  const calculating =
    status === "loading" ||
    (status === "ready" && calcUntil !== null && calcUntil.key === key && calcUntil.at > now);

  return {
    status,
    calculating,
    view: built.view,
    page: current?.page ?? null,
    error: current?.error ?? built.error,
    reload,
    toggleTick: toggleTickFor,
    setTicksFor,
    resetTicks,
  };
}
