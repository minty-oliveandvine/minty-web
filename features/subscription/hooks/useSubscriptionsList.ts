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
 * company's `start-trial` action with `X-Entity-Id` (the `/api/me/*` surface is read-only). A
 * row's chevron opens it in place (Figma 05·A, "Subscription Summary" - one row at a time;
 * `useEntitySummary` fetches the open company's page model and card); the module page's
 * *Manage Subscription* arrives with `?entity=` and finds that row open. A tick is local (05·B):
 * the row shows the change pending until *Confirm Subscription Change*, which ASKS first -
 * section 06's modal for that change (`lib/changeModal.ts`) - and, confirmed there, applies it
 * (`api/moduleChanges.ts` - one API action per module) and lands on its RESULT (05·C,
 * `lib/changeResult.ts`): in the row for what was added, confirmed, restored or started - where
 * Start Trial lands too - or the whole page for a cancellation. Back to Manage Subscriptions
 * drops the result, closes the row and reloads the list. When a card must be collected first,
 * the browser goes to Stripe and comes back to the module page, as it does from there.
 *
 * Everything else is a seam that navigates to the screen that owns the flow (`lib/paths.ts`):
 * *Subscribe* → the activate flow, the ⋮ items → the confirm flows, *Review and accept* → the
 * incoming-transfers page, the banner's "here" and the panel's *Change* → the payment-method
 * screen.
 *
 * `fixture`: dev-only, as the module page's - `?fixture=A|B|F` serves the design's frames;
 * `?result=RU22` lands the open row on a 05·C frame.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/apiClient";
import { leaveTo } from "@/lib/handoff";
import { useToast } from "@/components/ui/Toast";

import { applyChange } from "@/features/subscription/api/moduleChanges";
import {
  getModulePage,
  startTrial as postStartTrial,
  type ModuleCode,
  type ModulePage,
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
import { buildChangeModal, type ChangeModal } from "@/features/subscription/lib/changeModal";
import {
  buildChangeResult,
  type ChangeAsked,
  type ChangeResult,
} from "@/features/subscription/lib/changeResult";
import { PORTAL, moduleRoutes } from "@/features/subscription/lib/paths";
import type { PendingChange } from "@/features/subscription/lib/subscriptionSummary";
import {
  useEntitySummary,
  type UseEntitySummaryResult,
} from "@/features/subscription/hooks/useEntitySummary";

export const SEARCH_DEBOUNCE_MS = 300;

export const LIST_NOT_WIRED_YET =
  "Your subscriptions aren't served by the subscription service yet - the API lands in Part 2 step 3.";
export const LIST_SERVICE_DARK =
  "The subscription service is switched off (SUBSCRIPTION_ENABLED=0 on minty-billing-api), so nothing is served.";
export const LIST_LOAD_FAILED = "We couldn’t load your subscriptions.";

export type ListStatus = "loading" | "ready" | "error";

export type TrialPrompt = { entity: PortalEntity; code: ModuleCode; moduleName: string };

/** Where the last change landed: the company and its result screen. */
export type ListResult = { entity: PortalEntity; result: ChangeResult };

/** A change asked about and not yet confirmed: the company, the ticks, the modal's words. */
export type ChangePrompt = { entity: PortalEntity; change: PendingChange; modal: ChangeModal };

export type UseSubscriptionsListArgs = {
  /** The company to bring into view and open (the module page's *Manage Subscription* lands here). */
  focusEntityId?: string | null;
  fixture?: string | null;
  /** Dev-only: the 05·A frame the open row shows (`?summary=M44`); with a list fixture, M44. */
  summaryFixture?: string | null;
  /** Dev-only: the 05·C frame the open row lands on (`?result=RU22`). */
  resultFixture?: string | null;
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
  /** The company whose row is open in place, and what its panel shows. */
  openEntityId: string | null;
  summary: UseEntitySummaryResult;
  toggleRow: (entity: PortalEntity) => void;
  closeRow: () => void;
  /** The open row's "Confirm Subscription Change": ask first (section 06's modal). */
  confirmChange: (entity: PortalEntity, change: PendingChange) => void;
  /** The modal, while it asks. */
  changePrompt: ChangePrompt | null;
  dismissChangePrompt: () => void;
  /** The modal's Confirm: apply the change, land on the result. */
  applyChangePrompt: () => Promise<void>;
  changeBusy: boolean;
  /** The result screen of the last change, until Back to Manage Subscriptions. */
  result: ListResult | null;
  dismissResult: () => void;
  changePaymentMethod: (entity: PortalEntity) => void;
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

/** The 05·C frame named by the dev switch, as a result for the company given. */
async function fixtureResult(
  frame: string,
  entity: PortalEntity,
  today: Date,
): Promise<ChangeResult | null> {
  if (process.env.NODE_ENV === "production") return null;
  const f = await import("@/features/subscription/__fixtures__/modulePage");
  if (!f.isResultFrame(frame)) return null;
  const { before, asked, after } = f.RESULT_FIXTURES[frame];
  return buildChangeResult(asked, before, after, entity, today);
}

export function useSubscriptionsList({
  focusEntityId = null,
  fixture,
  summaryFixture,
  resultFixture,
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

  // The module page's Manage Subscription lands with ?entity=: that row opens as the list does.
  const [openEntityId, setOpenEntityId] = useState<string | null>(focusEntityId);

  const [result, setResult] = useState<ListResult | null>(null);
  const [changePrompt, setChangePrompt] = useState<ChangePrompt | null>(null);
  const [changeBusy, setChangeBusy] = useState(false);

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

  const land = useCallback(
    (entity: PortalEntity, asked: ChangeAsked, before: ModulePage, after: ModulePage) => {
      const res = buildChangeResult(asked, before, after, entity, day ?? new Date());
      setResult({ entity, result: res });
      setOpenEntityId(res.layout === "row" ? entity.entity_id : null);
    },
    [day],
  );

  const confirmStartTrial = useCallback(async () => {
    if (!trialPrompt) return;
    const { entity, code } = trialPrompt;
    setTrialBusy(true);
    try {
      // The page model before is read for the result's "what changed"; a company whose row is
      // not open has none loaded yet, so it is fetched (and again after, for the answer).
      const before = await getModulePage(entity.entity_id);
      await postStartTrial(entity.entity_id, code);
      const after = await getModulePage(entity.entity_id);
      setTrialPrompt(null);
      land(entity, { kind: "start_trial", code }, before, after);
      reload();
    } catch (err) {
      showToast(sentence(err), "error");
    } finally {
      setTrialBusy(false);
    }
  }, [trialPrompt, reload, showToast, land]);

  const openEntity = useMemo(
    () => entities.find((e) => e.entity_id === openEntityId) ?? null,
    [entities, openEntityId],
  );
  // A list served from a fixture has no real companies to ask the API about: its open row is
  // served from a 05·A fixture too (the one named, else M44).
  const summary = useEntitySummary(openEntity, {
    fixture: summaryFixture ?? (fixture ? "M44" : null),
    today: day,
  });

  const toggleRow = useCallback((entity: PortalEntity) => {
    setResult(null);
    setOpenEntityId((open) => (open === entity.entity_id ? null : entity.entity_id));
  }, []);
  const closeRow = useCallback(() => {
    setResult(null);
    setOpenEntityId(null);
  }, []);

  // Dev-only: land the open row on the 05·C frame named, as if its change had just been applied.
  const summaryPage = summary.page;
  useEffect(() => {
    if (!resultFixture || !openEntity || !summaryPage) return;
    let live = true;
    void fixtureResult(resultFixture, openEntity, day ?? new Date()).then((res) => {
      if (!live || !res) return;
      setResult({ entity: openEntity, result: res });
      setOpenEntityId(res.layout === "row" ? openEntity.entity_id : null);
    });
    return () => {
      live = false;
    };
    // The company is identified by its id; the page model must have loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultFixture, openEntity?.entity_id, summaryPage !== null]);

  const confirmChange = useCallback(
    (entity: PortalEntity, change: PendingChange) => {
      const before = summary.page;
      if (!before || changeBusy) return;
      const modal = buildChangeModal(before, change.codes);
      if (modal) setChangePrompt({ entity, change, modal });
    },
    [summary.page, changeBusy],
  );
  const dismissChangePrompt = useCallback(() => {
    if (!changeBusy) setChangePrompt(null);
  }, [changeBusy]);

  const applyChangePrompt = useCallback(async () => {
    const before = summary.page;
    if (!changePrompt || !before || changeBusy) return;
    const { entity, change } = changePrompt;
    setChangeBusy(true);
    try {
      {
        const applied = await applyChange(entity.entity_id, before, change.codes);
        if (applied.redirect) {
          leaveTo(applied.redirect);
          return;
        }
        if (applied.refused) {
          showToast(applied.refused, "error");
          setChangePrompt(null);
          summary.reload();
          return;
        }
        const after = await getModulePage(entity.entity_id);
        summary.resetTicks();
        setChangePrompt(null);
        land(entity, { kind: "ticks", codes: change.codes }, before, after);
      }
    } catch (err) {
      showToast(sentence(err), "error");
      setChangePrompt(null);
      summary.reload();
    } finally {
      setChangeBusy(false);
    }
  }, [changePrompt, summary, changeBusy, showToast, land]);
  const dismissResult = useCallback(() => {
    setResult(null);
    setOpenEntityId(null);
    reload();
  }, [reload]);
  const changePaymentMethod = useCallback(
    (entity: PortalEntity) => router.push(moduleRoutes(entity.entity_id).paymentMethod),
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
    openEntityId,
    summary,
    toggleRow,
    closeRow,
    confirmChange,
    changePrompt,
    dismissChangePrompt,
    applyChangePrompt,
    changeBusy,
    result,
    dismissResult,
    changePaymentMethod,
    subscribe,
    requestTransfer,
    cancelSubscription,
    reactivate,
    reviewTransfer,
    updatePaymentMethod,
    back,
  };
}
