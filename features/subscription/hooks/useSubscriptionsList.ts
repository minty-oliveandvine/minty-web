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
 * leaves for the portal's landing (08-A), as every result frame's hotspot says. When a card must
 * be collected first, the browser goes to Stripe and comes back to the module page, as it does
 * from there.
 *
 * The ⋮'s *Cancel subscription* and *Reactivate* (05·D, on a closed row or the open one) are
 * the same ticks - every ACTIVE module unticked, every module that is not ticked - so they open
 * the row, set those ticks and ask with the modal for exactly that change.
 *
 * When it fails or gets interrupted (06·B): a charge the bank declined asks with "Payment could
 * not be processed" - Try again now applies the same change again, Done leaves the ticks
 * pending; and leaving the open row with ticks pending (closing it, opening another company,
 * going back) asks "Leave without saving?" first - Discard changes drops the ticks and goes.
 *
 * Everything else is a seam that navigates to the screen that owns the flow (`lib/paths.ts`):
 * *Subscribe* → the activate flow, *Request transfer* → the change-subscriber page, *Review and
 * accept* → the incoming-transfers page, the banner's "here" and the panel's *Change* → the
 * payment-method screen.
 *
 * `fixture`: dev-only, as the module page's - `?fixture=A|B|F` serves the design's frames;
 * `?result=RU22` lands the open row on a 05·C frame.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
import {
  buildChangeModal,
  menuCodes,
  ticksFor,
  type ChangeModal,
} from "@/features/subscription/lib/changeModal";
import {
  buildChangeResult,
  startedTrialResult,
  transferredResult,
  type ChangeAsked,
  type ChangeResult,
} from "@/features/subscription/lib/changeResult";
import { PORTAL, moduleRoutes } from "@/features/subscription/lib/paths";
import { tickOf, type PendingChange } from "@/features/subscription/lib/subscriptionSummary";
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

/** A change asked about and not yet confirmed: the company, the ticks, the modal's words, and
 * the page model the change is read against. */
export type ChangePrompt = {
  entity: PortalEntity;
  change: PendingChange;
  modal: ChangeModal;
  page: ModulePage;
};

/** The bank declined the charge of a change: what was being applied, to try again. */
export type DeclinedPrompt = { prompt: ChangePrompt; message: string; autoRetry: boolean };

/** A way out of the open row asked about while its ticks are pending: what happens on Discard. */
export type LeavePrompt = { proceed: () => void };

export const NOTHING_TO_CANCEL = "Nothing is active to cancel.";
export const NOTHING_TO_REACTIVATE =
  "Nothing to reactivate here - a module never started has its Start Free Trial button on the row.";

export type UseSubscriptionsListArgs = {
  /** The company to bring into view and open (the module page's *Manage Subscription* lands here). */
  focusEntityId?: string | null;
  fixture?: string | null;
  /** Dev-only: the 05·A frame the open row shows (`?summary=M44`); with a list fixture, M44. */
  summaryFixture?: string | null;
  /** Dev-only: the 05·C frame the open row lands on (`?result=RU22`). */
  resultFixture?: string | null;
  /** Arrived from accepting a handover (`?transferred=1` beside `?entity=`): that row lands on 07-M. */
  transferred?: boolean;
  /**
   * Arrived from a trial started on the module settings page (`?started=<code>` beside
   * `?entity=`): that row lands on "Congratulations!" (RV11). The module names the news
   * because there is no before-and-after to read it from here.
   */
  startedCode?: string | null;
  /**
   * Arrived from a module card's *Activate* / *Resume* / *Reactivate* (`?tick=<code>` beside
   * `?entity=`): that module starts ticked, so the person reads what the change costs and
   * presses *Confirm Subscription Change* themselves. Nothing is posted by arriving.
   */
  tickCode?: string | null;
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
  /** "Payment could not be processed", while it asks. */
  declined: DeclinedPrompt | null;
  retryDeclined: () => Promise<void>;
  dismissDeclined: () => void;
  /** "Leave without saving?", while it asks. */
  leavePrompt: LeavePrompt | null;
  discardAndLeave: () => void;
  stay: () => void;
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
  transferred = false,
  startedCode = null,
  tickCode = null,
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
  // Accepting a handover lands on 07-M (derived below); this remembers it was dismissed.
  const [landingDismissed, setLandingDismissed] = useState(false);
  const [changePrompt, setChangePrompt] = useState<ChangePrompt | null>(null);
  const [changeBusy, setChangeBusy] = useState(false);
  const [declined, setDeclined] = useState<DeclinedPrompt | null>(null);
  const [leavePrompt, setLeavePrompt] = useState<LeavePrompt | null>(null);

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

  // The open row has ticks pending: every way out asks first (06·B's "Leave without saving?").
  const ticksPending = Boolean(summary.view?.pendingChange);
  const guardLeave = useCallback(
    (proceed: () => void) => {
      if (ticksPending) setLeavePrompt({ proceed });
      else proceed();
    },
    [ticksPending],
  );
  const discardAndLeave = useCallback(() => {
    const prompt = leavePrompt;
    setLeavePrompt(null);
    if (!prompt) return;
    summary.resetTicks();
    prompt.proceed();
  }, [leavePrompt, summary]);
  const stay = useCallback(() => setLeavePrompt(null), []);
  useEffect(() => {
    if (!ticksPending) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [ticksPending]);

  const toggleRow = useCallback(
    (entity: PortalEntity) =>
      guardLeave(() => {
        setResult(null);
        setLandingDismissed(true);
        setOpenEntityId((open) => (open === entity.entity_id ? null : entity.entity_id));
      }),
    [guardLeave],
  );
  const closeRow = useCallback(
    () =>
      guardLeave(() => {
        setResult(null);
        setLandingDismissed(true);
        setOpenEntityId(null);
      }),
    [guardLeave],
  );

  // Accepted a handover: the company's row lands on "Subscription Transfer Completed" (07-M)
  // once the list holds it and its page model (for the footer's renewal date) is in. Derived,
  // not set: it shows until Back to Manage Subscriptions (or the row closes) dismisses it.
  const summaryPage = summary.page;
  const landedTransfer = useMemo(
    () =>
      transferred && !landingDismissed && openEntity && summaryPage
        ? { entity: openEntity, result: transferredResult(openEntity, summaryPage) }
        : null,
    [transferred, landingDismissed, openEntity, summaryPage],
  );

  // A trial started on the module settings page: the same row, rebuilt from the page model
  // alone (RV11). `startedTrialResult` is the one that refuses - it answers null unless that
  // module is really trialing and not since cancelled, so a code naming nothing, or a module
  // in any other state, leaves the row as the ordinary summary.
  const landedTrial = useMemo((): ListResult | null => {
    if (!startedCode || landingDismissed || !openEntity || !summaryPage) return null;
    const res = startedTrialResult(openEntity, summaryPage, startedCode, day ?? new Date());
    return res ? { entity: openEntity, result: res } : null;
  }, [startedCode, landingDismissed, openEntity, summaryPage, day]);

  // Arrived from a module card's CTA: tick that module, once, when the row's page model is in.
  // Waiting is the point - the ticks are keyed by company AND read against the cards, so a tick
  // seeded before the answer would be invisible and would burn the "Calculating…" beat. It
  // refuses rather than guesses: `ticksFor` drops a code the company does not have or one whose
  // card has no tick to give (a module never started keeps its Start Free Trial button).
  // The latch is a ref, not state: the React compiler forbids setState inside an effect, and
  // this is bookkeeping the render does not read. Keyed by company and code, so a second
  // arrival for another module seeds again while a re-render never does.
  const tickSeeded = useRef<string | null>(null);
  useEffect(() => {
    if (!tickCode || !openEntity || !summaryPage) return;
    const key = `${openEntity.entity_id}#${tickCode}`;
    if (tickSeeded.current === key) return;
    tickSeeded.current = key;
    const pending = ticksFor(summaryPage, [tickCode as ModuleCode]);
    if (Object.keys(pending).length > 0) summary.setTicksFor(openEntity.entity_id, pending);
    // The company is identified by its id; the page model must have loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickCode, openEntity?.entity_id, summaryPage !== null]);

  // Dev-only: land the open row on the 05·C frame named, as if its change had just been applied.
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
      if (modal) setChangePrompt({ entity, change, modal, page: before });
    },
    [summary.page, changeBusy],
  );

  // The ⋮'s Cancel subscription / Reactivate: open the row, tick what the item ticks, and ask.
  // The page model is read here when the row was closed (the row's own read follows).
  const runMenuChange = useCallback(
    async (entity: PortalEntity, item: "cancel_subscription" | "reactivate") => {
      if (changeBusy) return;
      setResult(null);
      setChangePrompt(null);
      setOpenEntityId(entity.entity_id);
      try {
        const page =
          openEntityId === entity.entity_id && summary.page
            ? summary.page
            : await getModulePage(entity.entity_id);
        const codes = menuCodes(page, item);
        if (codes.length === 0) {
          showToast(item === "cancel_subscription" ? NOTHING_TO_CANCEL : NOTHING_TO_REACTIVATE);
          return;
        }
        summary.setTicksFor(entity.entity_id, ticksFor(page, codes));
        const first = page.cards.find((c) => c.code === codes[0])!;
        const modal = buildChangeModal(page, codes);
        if (modal) {
          setChangePrompt({
            entity,
            change: { code: codes[0], seam: tickOf(first).seam!, codes },
            modal,
            page,
          });
        }
      } catch (err) {
        showToast(sentence(err), "error");
      }
    },
    [changeBusy, openEntityId, summary, showToast],
  );
  // Another company's item while this row's ticks are pending: leaving is asked about first.
  const menuChange = useCallback(
    (entity: PortalEntity, item: "cancel_subscription" | "reactivate") => {
      if (ticksPending && openEntityId !== entity.entity_id) {
        setLeavePrompt({ proceed: () => void runMenuChange(entity, item) });
        return;
      }
      void runMenuChange(entity, item);
    },
    [ticksPending, openEntityId, runMenuChange],
  );
  const dismissChangePrompt = useCallback(() => {
    if (!changeBusy) setChangePrompt(null);
  }, [changeBusy]);

  // Apply a change asked about: from the modal's Confirm, or again after the bank declined.
  const apply = useCallback(
    async (prompt: ChangePrompt) => {
      const { entity, change, page: before } = prompt;
      setChangeBusy(true);
      try {
        const applied = await applyChange(entity.entity_id, before, change.codes);
        if (applied.redirect) {
          leaveTo(applied.redirect);
          return;
        }
        if (applied.declined) {
          // The bank said no: the modal asks to try again; the ticks stay pending.
          setDeclined({ prompt, ...applied.declined });
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
        // READ BOTH AGAIN. `after` is fetched to say what CHANGED and nothing more - the open
        // row keeps its own page model and the list its own rows, and neither had heard. A
        // reactivated module went on offering "Reactivate Subscription" underneath the result
        // until something else happened to reload them. Every other exit from this function
        // already reloads; the successful one was the exception.
        summary.reload();
        reload();
      } catch (err) {
        showToast(sentence(err), "error");
        setChangePrompt(null);
        summary.reload();
      } finally {
        setChangeBusy(false);
      }
    },
    [summary, showToast, land, reload],
  );
  const applyChangePrompt = useCallback(async () => {
    if (!changePrompt || changeBusy) return;
    await apply(changePrompt);
  }, [changePrompt, changeBusy, apply]);
  const retryDeclined = useCallback(async () => {
    if (!declined || changeBusy) return;
    setDeclined(null);
    await apply(declined.prompt);
  }, [declined, changeBusy, apply]);
  const dismissDeclined = useCallback(() => {
    setDeclined(null);
    setChangePrompt(null);
  }, []);
  /**
   * The result screens' "Back to Manage Subscriptions" - every one of them, row or page, since
   * they share this handler. It LEAVES for the portal's landing (Figma 08-A): all 103 frames of
   * section 05·C carry `▶ Back to Manage Subscriptions → 08-A`, and so does 07-M. This list
   * unmounts on the way, so there is nothing to reset and nothing to reload - the landing does
   * its own read, and coming back here reloads anyway.
   */
  const dismissResult = useCallback(() => router.push(PORTAL.index), [router]);
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
    (entity: PortalEntity) => menuChange(entity, "cancel_subscription"),
    [menuChange],
  );
  const reactivate = useCallback(
    (entity: PortalEntity) => menuChange(entity, "reactivate"),
    [menuChange],
  );
  const reviewTransfer = useCallback(
    (transfer: IncomingTransfer) =>
      router.push(`${PORTAL.incoming}?transfer=${encodeURIComponent(transfer.id)}`),
    [router],
  );
  const updatePaymentMethod = useCallback(() => router.push(PORTAL.billing), [router]);
  const back = useCallback(() => guardLeave(() => router.back()), [guardLeave, router]);

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
    declined,
    retryDeclined,
    dismissDeclined,
    leavePrompt,
    discardAndLeave,
    stay,
    result: result ?? landedTransfer ?? landedTrial,
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
