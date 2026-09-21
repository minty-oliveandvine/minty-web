"use client";

/**
 * State and orchestration of the Manage Subscriptions list (Figma section 04). The screen calls
 * this and renders what it returns.
 *
 * Load: every page of `/api/me/subscriptions` (the list scrolls, it does not page) and the
 * transfer requests made to the payer; then each company through `lib/portalRows.ts`. Search
 * (debounced, over the loaded list) and the column sorts happen here, not on the server -
 * "newest entity first" and "by whichever trial expires soonest" are the design's orders and
 * the API has neither.
 *
 * Actions: *Start Trial* is asked for confirmation (frames 04-G/H) and then posted through the
 * company's `start-trial` action with `X-Entity-Id` (the `/api/me/*` surface is read-only); the
 * list reloads. Everything else is a seam that navigates to the screen that owns the flow
 * (`lib/paths.ts`): a row → the company's module page, *Subscribe* → its activate flow, the ⋮
 * items → the confirm flows, *Review and accept* → the incoming-transfers page, the banner's
 * "here" → billing.
 *
 * `fixture`: dev-only, as the module page's - `?fixture=A|B|F` serves the design's frames.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/apiClient";
import { useToast } from "@/components/ui/Toast";

import {
  startTrial as postStartTrial,
  type ModuleCode,
} from "@/features/subscription/api/moduleSettings";
import {
  fetchAllPayerSubscriptions,
  listIncomingTransfers,
  type IncomingTransfer,
  type PortalEntity,
} from "@/features/subscription/api/payerPortal";
import {
  matches,
  nextSort,
  sortEntities,
  toRow,
  type ListSort,
  type SortColumn,
  type SubscriptionRow,
} from "@/features/subscription/lib/portalRows";
import { PORTAL, moduleRoutes, modulesPath } from "@/features/subscription/lib/paths";

export const SEARCH_DEBOUNCE_MS = 300;

export const LIST_NOT_WIRED_YET =
  "Your subscriptions aren't served by the subscription service yet - the API lands in Part 2 step 3.";
export const LIST_SERVICE_DARK =
  "The subscription service is switched off (SUBSCRIPTION_ENABLED=0 on minty-billing-api), so nothing is served.";
export const LIST_LOAD_FAILED = "We couldn’t load your subscriptions.";

export type ListStatus = "loading" | "ready" | "error";

export type TrialPrompt = { entity: PortalEntity; code: ModuleCode; moduleName: string };

export type UseSubscriptionsListArgs = {
  /** The company to bring into view (the module page's *Manage Subscription* lands here). */
  focusEntityId?: string | null;
  fixture?: string | null;
  today?: Date;
};

export type UseSubscriptionsListResult = {
  status: ListStatus;
  error: string | null;
  /** Rows of the main list and of the "Suspended Subscriptions" section, after search and sort. */
  active: SubscriptionRow[];
  suspended: SubscriptionRow[];
  /** Whether the loaded list has anything at all (the empty state) vs the search matched nothing. */
  hasEntities: boolean;
  transfers: IncomingTransfer[];
  paymentFailed: boolean;
  focusEntityId: string | null;
  searchInput: string;
  setSearchInput: (value: string) => void;
  sort: ListSort;
  toggleSort: (column: SortColumn) => void;
  reload: () => void;
  /** The Start Trial confirmation, when one is open. */
  trialPrompt: TrialPrompt | null;
  askStartTrial: (entity: PortalEntity, code: ModuleCode) => void;
  dismissTrialPrompt: () => void;
  confirmStartTrial: () => Promise<void>;
  trialBusy: boolean;
  openRow: (entity: PortalEntity) => void;
  subscribe: (entity: PortalEntity, code: ModuleCode) => void;
  requestTransfer: (entity: PortalEntity) => void;
  cancelSubscription: (entity: PortalEntity) => void;
  reactivate: (entity: PortalEntity) => void;
  reviewTransfer: (transfer: IncomingTransfer) => void;
  updatePaymentMethod: () => void;
  back: () => void;
};

function sentence(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 501) return LIST_NOT_WIRED_YET;
    if (err.status === 404 && err.message === "not_found") return LIST_SERVICE_DARK;
    return err.message;
  }
  return LIST_LOAD_FAILED;
}

async function load(
  fixture: string | null | undefined,
  signal: AbortSignal,
): Promise<{ entities: PortalEntity[]; transfers: IncomingTransfer[]; today: Date | null }> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/subscriptions");
    if (f.isListFixture(fixture)) {
      const { TODAY } = await import("@/features/subscription/__fixtures__/modulePage");
      const { page, transfers } = f.LIST_FIXTURES[fixture];
      return { entities: page.entities, transfers, today: TODAY };
    }
  }
  const [{ entities }, transfers] = await Promise.all([
    fetchAllPayerSubscriptions(signal),
    // a failure here must not take the list down with it - the card is a nicety
    listIncomingTransfers(signal).catch(() => [] as IncomingTransfer[]),
  ]);
  return { entities, transfers, today: null };
}

export function useSubscriptionsList({
  focusEntityId = null,
  fixture,
  today,
}: UseSubscriptionsListArgs = {}): UseSubscriptionsListResult {
  const router = useRouter();
  const { showToast } = useToast();

  const [status, setStatus] = useState<ListStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [entities, setEntities] = useState<PortalEntity[]>([]);
  const [transfers, setTransfers] = useState<IncomingTransfer[]>([]);
  const [fixtureToday, setFixtureToday] = useState<Date | null>(null);
  const [generation, setGeneration] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListSort>(null);

  const [trialPrompt, setTrialPrompt] = useState<TrialPrompt | null>(null);
  const [trialBusy, setTrialBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const loaded = await load(fixture, controller.signal);
        if (controller.signal.aborted) return;
        setEntities(loaded.entities);
        setTransfers(loaded.transfers);
        setFixtureToday(loaded.today);
        setError(null);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(sentence(err));
        setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [fixture, generation]);

  // the search field is live; the list follows it a beat later, as billing-frontend's did
  useEffect(() => {
    const id = window.setTimeout(() => setQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const reload = useCallback(() => {
    setStatus("loading");
    setGeneration((g) => g + 1);
  }, []);

  const day = fixtureToday ?? today;
  const rows = useMemo(() => {
    const now = day ?? new Date();
    const shown = sortEntities(
      entities.filter((e) => matches(e, query)),
      sort,
    ).map((e) => toRow(e, now));
    return {
      active: shown.filter((r) => r.section === "active"),
      suspended: shown.filter((r) => r.section === "suspended"),
    };
  }, [entities, query, sort, day]);

  const paymentFailed = useMemo(
    () => entities.some((e) => e.modules.some((m) => m.status === "past_due")),
    [entities],
  );

  const toggleSort = useCallback((column: SortColumn) => setSort((s) => nextSort(s, column)), []);

  const askStartTrial = useCallback((entity: PortalEntity, code: ModuleCode) => {
    const moduleName = entity.modules.find((m) => m.code === code)?.name ?? code;
    setTrialPrompt({ entity, code, moduleName });
  }, []);
  const dismissTrialPrompt = useCallback(() => {
    if (!trialBusy) setTrialPrompt(null);
  }, [trialBusy]);

  const confirmStartTrial = useCallback(async () => {
    if (!trialPrompt) return;
    setTrialBusy(true);
    try {
      await postStartTrial(trialPrompt.entity.entity_id, trialPrompt.code);
      setTrialPrompt(null);
      reload();
    } catch (err) {
      showToast(sentence(err), "error");
    } finally {
      setTrialBusy(false);
    }
  }, [trialPrompt, reload, showToast]);

  const openRow = useCallback(
    (entity: PortalEntity) => router.push(modulesPath(entity.entity_id)),
    [router],
  );
  const subscribe = useCallback(
    (entity: PortalEntity, code: ModuleCode) =>
      router.push(moduleRoutes(entity.entity_id).activate(code)),
    [router],
  );
  const requestTransfer = useCallback(
    (entity: PortalEntity) =>
      router.push(`${PORTAL.subscriber}?entity=${encodeURIComponent(entity.entity_id)}`),
    [router],
  );
  const cancelSubscription = useCallback(
    (entity: PortalEntity) => router.push(moduleRoutes(entity.entity_id).cancelAll),
    [router],
  );
  const reactivate = useCallback(
    (entity: PortalEntity) => router.push(moduleRoutes(entity.entity_id).reactivateAll),
    [router],
  );
  const reviewTransfer = useCallback(
    (transfer: IncomingTransfer) =>
      router.push(`${PORTAL.incoming}?transfer=${encodeURIComponent(transfer.id)}`),
    [router],
  );
  const updatePaymentMethod = useCallback(() => router.push(PORTAL.billing), [router]);
  const back = useCallback(() => router.back(), [router]);

  return {
    status,
    error,
    active: rows.active,
    suspended: rows.suspended,
    hasEntities: entities.length > 0,
    transfers,
    paymentFailed,
    focusEntityId,
    searchInput,
    setSearchInput,
    sort,
    toggleSort,
    reload,
    trialPrompt,
    askStartTrial,
    dismissTrialPrompt,
    confirmStartTrial,
    trialBusy,
    openRow,
    subscribe,
    requestTransfer,
    cancelSubscription,
    reactivate,
    reviewTransfer,
    updatePaymentMethod,
    back,
  };
}
