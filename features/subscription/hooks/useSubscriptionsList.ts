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
 * the row shows the change pending until *Confirm Subscription Change*, which asks with the
 * change's section-06 modal (`lib/changeModal.ts` - "Activate …", "You have unlocked …"). Its
 * Confirm, for a change that BILLS anything, opens WHICH BILLING ACCOUNT PAYS for the company
 * (the 08-A "Billing Accounts" sheet, the rows the API would refuse disabled -
 * `nominationChoice`), puts the company on the one picked (`POST /billing/accounts/move`, which
 * also places a card-free trial on its first account) and applies it; for a change that only
 * CANCELS it applies it at once (`api/moduleChanges.ts` - one API action per module). Either lands on its RESULT (05·C,
 * `lib/changeResult.ts`): in the row for what was added, confirmed, restored or started - where
 * Start Trial lands too - or the whole page for a cancellation. Back to Manage Subscriptions
 * leaves for the portal's landing (08-A), as every result frame's hotspot says. When the change
 * finds no card to charge, "Billing Accounts" is asked AGAIN with the API's sentence - a card is
 * only ever added through a billing account ("New billing account", in place), never on a
 * Stripe-hosted page (the user, 2026-10-01).
 *
 * ACTIVATION IS A THIRD WAY IN (the user, 2026-10-08). A company with no SUBSCRIBER shows
 * Activate Subscription in Confirm's slot; it asks in the same modal, opens the same sheet, and
 * then does TWO things in order: `activate-subscription` on the account picked, which gives the
 * company its subscriber, and then the same apply pass as any other change - so it CAN charge,
 * and it lands on the same 05.C result. Two rules hold it together: the activation is sent with
 * NO `codes`, so a lapsed module is bought back exactly once (by `restart-billing` in the apply
 * pass, the one charging path); and a decline afterwards is NOT rolled back - the company keeps
 * its subscriber and its ticks, and 06.B's Try again re-runs only the charge, because activation
 * lives in `confirmAccount` and not in `apply`.
 *
 * The ⋮'s *Cancel subscription* and *Reactivate* (05·D, on a closed row or the open one) are
 * the same ticks - every ACTIVE module unticked, every module that is not ticked - so they open
 * the row, set those ticks and ask exactly as that change's button would: with its modal, and
 * the reactivation (it bills) then with "Billing Accounts".
 *
 * When it fails or gets interrupted (06·B): a charge the bank declined asks with "Payment could
 * not be processed" - Try again now applies the same change again, Done leaves the ticks
 * pending; and leaving the open row with ticks pending (closing it, opening another company,
 * going back) asks "Leave without saving?" first - Discard changes drops the ticks and goes.
 *
 * The panel's *Change* beside the company's card opens the SAME "Billing Accounts" sheet with no
 * change behind it (the user, 2026-09-29): the account the company is on reads "Billed here
 * now", picking another moves the company there (`POST /billing/accounts/move`, nothing
 * charged), the row reads its card again - it is the account's - and a toast says where it is
 * billed now.
 *
 * Everything else is a seam that navigates to the screen that owns the flow (`lib/paths.ts`):
 * *Subscribe* → the activate flow, *Request transfer* → the change-subscriber page, *Review and
 * accept* → the incoming-transfers page, the banner's "here" → the company's billing account.
 *
 * `fixture`: dev-only, as the module page's - `?fixture=A|B|F` serves the design's frames;
 * `?result=RU22` lands the open row on a 05·C frame.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "@/lib/apiClient";
import { isEntityScoped } from "@/lib/auth";
import { redirectToHandoff } from "@/lib/handoff";
import { useToast } from "@/components/ui/Toast";

import {
  applyChange,
  billsAnything,
  needsAccountChoice,
} from "@/features/subscription/api/moduleChanges";
import {
  activateSubscription,
  getModulePage,
  startTrial as postStartTrial,
  type ModuleCode,
  type ModulePage,
} from "@/features/subscription/api/moduleSettings";
import {
  fetchAllPayerSubscriptions,
  fetchBillingAccounts,
  listIncomingTransfers,
  moveCompanyToAccount,
  type BillingAccounts,
  type IncomingTransfer,
  type PortalEntity,
} from "@/features/subscription/api/payerPortal";
import { shortCardName } from "@/features/subscription/lib/billing";
import {
  ACCOUNTS_LOAD_FAILED,
  MOVE_FAILED,
  accountChangeChoice,
  movedNotice,
  nominateLead,
  nominationChoice,
  type MoveTarget,
} from "@/features/subscription/lib/billingAccounts";
import type { OpenedAccount } from "@/features/subscription/hooks/useCardForm";
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
import { BILLING, PORTAL, moduleRoutes } from "@/features/subscription/lib/paths";
import { tickOf, type PendingChange } from "@/features/subscription/lib/subscriptionSummary";
import {
  useEntitySummary,
  type UseEntitySummaryResult,
} from "@/features/subscription/hooks/useEntitySummary";

export const SEARCH_DEBOUNCE_MS = 300;

export const LIST_NOT_WIRED_YET =
  "Your subscriptions aren't served by the subscription service yet - the API lands in Part 2 step 3.";
export const LIST_LOAD_FAILED = "We couldn’t load your subscriptions.";

export type ListStatus = "loading" | "ready" | "error";

export type TrialPrompt = { entity: PortalEntity; code: ModuleCode; moduleName: string };

/** Where the last change landed: the company and its result screen. */
export type ListResult = { entity: PortalEntity; result: ChangeResult };

/**
 * Everything `apply` needs to make a change: the company, the ticks, and the page model the
 * change is read against. Narrower than the modal's prompt ON PURPOSE - an activation whose
 * modal could not be built still has to carry its ticks to the apply pass, and the sheet and
 * the declined dialog hold this rather than the fuller shape for the same reason.
 */
export type ApplyRequest = {
  entity: PortalEntity;
  change: PendingChange;
  page: ModulePage;
  /** The card of the billing account picked to pay for it ("Visa 4242") - what 06·B names. */
  card?: string | null;
};

/** A change asked about and not yet confirmed: an `ApplyRequest` plus the modal's own words. */
export type ChangePrompt = ApplyRequest & {
  modal: ChangeModal;
  /**
   * The company has no SUBSCRIBER, so the act behind this modal is ACTIVATION FIRST. It asks in
   * the same section-06 modal (the user, 2026-10-08: "activate subscription should have the
   * you've chosen modal too") and its Confirm goes to the same Billing Accounts sheet; what
   * lands is `activate-subscription` and THEN the ticked change, applied on the account just
   * picked (the user, same day: the modal said "you've chosen X", so X happens).
   */
  activate?: boolean;
};

/**
 * "Billing Accounts": which account pays for the company - asked by Confirm Subscription Change
 * for a change that bills, or opened on its own by the panel's _Change_. `key` changes when the
 * accounts are replaced (one opened in place), so the sheet is drawn again on its list.
 */
export type AccountStep = {
  data: BillingAccounts;
  targets: MoveTarget[];
  picked: string | null;
  /** The API's refusal of the account picked, as written. */
  error: string | null;
  lead: string;
  key: number;
};

type AccountAsk = {
  entity: PortalEntity;
  /** The change waiting on the pick; null when the pick IS the whole ask (the panel's _Change_). */
  prompt: ApplyRequest | null;
  data: BillingAccounts;
  picked: string | null;
  error: string | null;
  /** Asked again because the change found no card to charge: cardless accounts are shut. */
  needCard: boolean;
  /**
   * "activate" when the pick is CONFIRMING BILLING on a company nobody pays for yet - one
   * request (`activate-subscription`), which places the company and makes the viewer its
   * subscriber. Absent for the two older asks: a change waiting on a card, and the panel's
   * _Change_ (a move).
   */
  intent?: "activate";
  key: number;
};

/** The bank declined the charge of a change: what was being applied, to try again. */
export type DeclinedPrompt = { prompt: ApplyRequest; message: string; autoRetry: boolean };

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
  /** The open row's "Confirm Subscription Change": section 06's modal asks first. */
  confirmChange: (entity: PortalEntity, change: PendingChange) => void;
  /** The asking modal, while it asks. */
  changePrompt: ChangePrompt | null;
  dismissChangePrompt: () => void;
  /** Its Confirm: a change that bills goes on to "Billing Accounts"; one that cancels is applied. */
  applyChangePrompt: () => Promise<void>;
  changeBusy: boolean;
  /**
   * "Activate Subscription" on a row nobody pays for: asks in the SAME section-06 modal a
   * change asks in (the user, 2026-10-08), whose Confirm opens "Billing Accounts" and then
   * confirms billing - which makes the viewer its subscriber. Nothing is charged.
   */
  activateChange: (entity: PortalEntity, change: PendingChange) => void;
  /** "Billing Accounts", while it asks - and, busy, until its Confirm has an answer. */
  accountStep: AccountStep | null;
  /** Its Confirm: put the company on that account, then apply the change. */
  confirmAccount: (accountId: string) => Promise<void>;
  /** An account opened in its place: the company goes on it, then the change is applied. */
  accountOpened: (opened: OpenedAccount) => void;
  /** Closed: nothing is applied; the ticks stay pending. */
  dismissAccountStep: () => void;
  /** "Payment could not be processed", while it asks - and, busy, while Try again now runs. */
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
  /** The panel's _Change_ beside the card: "Billing Accounts" as a move of this company alone. */
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
  const [accountAsk, setAccountAsk] = useState<AccountAsk | null>(null);
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

  // the search field is live; the list follows it a beat later, as minty-payment-request-web's did
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

  // "Billing Accounts" opens on accounts read now, fresh - for a change that bills (which
  // account pays first, the company's own preselected) or on its own from the panel's Change
  // (a move: nothing preselected, since staying is nothing to confirm).
  const openAccounts = useCallback(
    async (entity: PortalEntity, prompt: ChangePrompt | null) => {
      setChangeBusy(true);
      try {
        const data = await fetchBillingAccounts();
        const { picked } = prompt
          ? nominationChoice(data, entity.entity_id)
          : accountChangeChoice(data, entity.entity_id);
        // The asking modal gives way to the sheet only now: a failed read leaves it up, to try
        // its Confirm again.
        setChangePrompt(null);
        setAccountAsk({ entity, prompt, data, picked, error: null, needCard: false, key: 0 });
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : ACCOUNTS_LOAD_FAILED, "error");
      } finally {
        setChangeBusy(false);
      }
    },
    [showToast],
  );

  /**
   * "Activate Subscription" on a row nobody pays for: the same sheet, asked for a different
   * act. Confirming it places the company on the account, records consent and makes the viewer
   * its subscriber - and THEN applies the ticks that put the button there, on that same
   * account (see `confirmAccount`). The ticks travel in `prompt`, which is why this takes one.
   */
  const openActivate = useCallback(
    async (entity: PortalEntity, prompt: ApplyRequest | null) => {
      if (changeBusy) return;
      setChangeBusy(true);
      try {
        const data = await fetchBillingAccounts();
        const { picked } = nominationChoice(data, entity.entity_id, { needCard: true });
        // The modal gives way to the sheet only now, as a change's does: a failed read leaves
        // it up to try its Confirm again.
        setChangePrompt(null);
        setAccountAsk({
          entity,
          // The ticks travel with it: the sheet's Confirm activates AND THEN applies them.
          prompt,
          data,
          picked,
          error: null,
          needCard: true,
          intent: "activate",
          key: 0,
        });
      } catch (err) {
        showToast(err instanceof ApiError ? err.message : ACCOUNTS_LOAD_FAILED, "error");
      } finally {
        setChangeBusy(false);
      }
    },
    [changeBusy, showToast],
  );

  const askChange = useCallback(
    (entity: PortalEntity, change: PendingChange, activate = false) => {
      const before = summary.page;
      if (!before || changeBusy) return;
      const modal = buildChangeModal(before, change.codes);
      if (modal) setChangePrompt({ entity, change, modal, page: before, activate });
    },
    [summary.page, changeBusy],
  );
  const confirmChange = useCallback(
    (entity: PortalEntity, change: PendingChange) => askChange(entity, change),
    [askChange],
  );
  /**
   * "Activate Subscription" on a company nobody pays for: the SAME section-06 modal a change
   * asks in, because the person is choosing the same modules and should read the same words.
   * Its Confirm goes to Billing Accounts and then activates (see `applyChangePrompt`).
   *
   * THE MODAL CAN BE NULL and the button must not go dead with it. `buildChangeModal` answers
   * null when no ticked code carries a seam, and it is a different computation from the
   * `pendingChange` this button is gated on - the two can disagree. A change simply shows no
   * modal in that case; activation still has to happen, so it goes straight to the sheet.
   */
  const activateChange = useCallback(
    (entity: PortalEntity, change: PendingChange) => {
      const before = summary.page;
      if (!before || changeBusy) return;
      if (!buildChangeModal(before, change.codes)) {
        void openActivate(entity, { entity, change, page: before, card: null });
        return;
      }
      askChange(entity, change, true);
    },
    [summary.page, changeBusy, askChange, openActivate],
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

  // No card to charge (the user, 2026-10-01: a payment method only ever goes through a billing
  // account): "Billing Accounts" is asked AGAIN for the same change, with the API's sentence as
  // its error, cardless accounts shut, and "New billing account" the way to add one. Read fresh
  // - the account picked may have just lost its card - and it takes the asking UI's place only
  // once that read is in (never a blank moment). The summary is NOT reloaded: the ticks stay.
  const askAgainForCard = useCallback(
    async (prompt: ApplyRequest, error: string) => {
      const { entity } = prompt;
      let data: BillingAccounts;
      try {
        data = await fetchBillingAccounts();
      } catch (err) {
        // The sheet (if it is the one asking) keeps its rows and says why; whatever else asked
        // gives way to the toast, as any other failure here does.
        const said = err instanceof ApiError ? err.message : ACCOUNTS_LOAD_FAILED;
        showToast(`${error} ${said}`, "error");
        setAccountAsk((ask) => ask && { ...ask, error, needCard: true });
        setChangePrompt(null);
        setDeclined(null);
        return;
      }
      const { picked } = nominationChoice(data, entity.entity_id, { needCard: true });
      setChangePrompt(null);
      setDeclined(null);
      setAccountAsk((ask) => ({
        entity,
        // The card named for 06·B belonged to the account that could not pay.
        prompt: { ...prompt, card: null },
        data,
        picked,
        error,
        needCard: true,
        key: (ask?.key ?? 0) + 1,
      }));
    },
    [showToast],
  );

  // Apply a change: from the asking modal's Confirm (a cancellation), from "Billing Accounts"
  // once the company is on the account picked (a change that bills), or again after a decline.
  // Whatever asked STAYS UP, busy, until the answer takes its place - the result and its modal,
  // 06·B, "Billing Accounts" asked again, a toast - so a payment never runs with nothing on the
  // screen saying so.
  const apply = useCallback(
    async (prompt: ApplyRequest) => {
      const { entity, change, page: before } = prompt;
      const closeAsking = () => {
        setChangePrompt(null);
        setAccountAsk(null);
        setDeclined(null);
      };
      setChangeBusy(true);
      try {
        const applied = await applyChange(entity.entity_id, before, change.codes, {
          cardChosen: Boolean(prompt.card),
        });
        if (applied.needsCard) {
          await askAgainForCard(prompt, applied.needsCard);
          return;
        }
        if (applied.declined) {
          // The bank said no: 06·B asks to try again; the ticks stay pending.
          closeAsking();
          setDeclined({ prompt, ...applied.declined });
          return;
        }
        if (applied.refused) {
          showToast(applied.refused, "error");
          closeAsking();
          summary.reload();
          return;
        }
        const after = await getModulePage(entity.entity_id);
        summary.resetTicks();
        closeAsking();
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
        closeAsking();
        summary.reload();
      } finally {
        setChangeBusy(false);
      }
    },
    [summary, showToast, land, reload, askAgainForCard],
  );
  // The asking modal's Confirm (the user, 2026-09-29, the second time: the modal asks FIRST,
  // then which account pays). A change that bills goes on to "Billing Accounts" and is applied
  // from there; one that only cancels bills nothing and is applied at once.
  const applyChangePrompt = useCallback(async () => {
    if (!changePrompt || changeBusy) return;
    // ACTIVATION goes to Billing Accounts whatever the ticks price at: the company has no
    // subscriber, so confirming billing is the act, and `billsAnything` would send a
    // free-trial-only selection straight past the sheet with nothing to nominate.
    if (changePrompt.activate) {
      await openActivate(changePrompt.entity, changePrompt);
      return;
    }
    if (billsAnything(changePrompt.page, changePrompt.change.codes)) {
      await openAccounts(changePrompt.entity, changePrompt);
      return;
    }
    await apply(changePrompt);
  }, [changePrompt, changeBusy, apply, openAccounts, openActivate]);
  // The account picked: the company goes on it (placed, if it was on none - a card-free trial),
  // THEN the change is applied, so every charge and consent below is that account's. The sheet
  // stays open through both, its Confirm "Confirming…", and `apply` closes it with the answer. A
  // refusal stays in the sheet in the API's words and nothing is applied. The summary is NOT
  // read again in between: a reload drops the pending ticks, which 06·B's Done promises to keep.
  const confirmAccount = useCallback(
    async (accountId: string, accounts?: BillingAccounts) => {
      if (!accountAsk || changeBusy) return;
      const { entity, prompt, intent } = accountAsk;
      setChangeBusy(true);
      // A refusal of the last try is not the answer to this one.
      setAccountAsk((ask) => ask && { ...ask, error: null });

      // ACTIVATION IS A PRELUDE, not a branch that returns. It gives the company its
      // subscriber on the account just picked, and then the ticks that put the button there
      // are applied on that same account by the shared tail below - the user, 2026-10-08: the
      // modal said "you've chosen X", so X happens.
      //
      // `activateSubscription` is sent WITHOUT `codes` on purpose: naming them is its own way
      // to buy a lapsed module back, and `applyChange` below already does that through
      // `restart-billing`. One charging path, so a lapsed module is bought back exactly once.
      if (intent === "activate") {
        try {
          await activateSubscription(entity.entity_id, accountId);
        } catch (err) {
          const error = err instanceof ApiError ? err.message : MOVE_FAILED;
          if (needsAccountChoice(err)) {
            // Pick again, in the API's words: the refusal left the company exactly as
            // subscriber-less as it was, so pressing again is safe.
            setAccountAsk((ask) => ask && { ...ask, picked: accountId, error, needCard: true });
          } else {
            setAccountAsk(null);
            showToast(error, "error");
          }
          setChangeBusy(false);
          return;
        }
        // NOTHING BELOW RUNS ON A FAILED ACTIVATION - that is what stops the apply pass
        // charging a company that never got a subscriber.
        if (!prompt) {
          // No ticks to apply. Unreachable now that both entry points carry them, kept so a
          // third caller degrades to the old behaviour rather than falling through to `apply`
          // with nothing.
          setAccountAsk(null);
          setChangeBusy(false);
          showToast(`Billing confirmed for ${entity.entity_name}. You are its subscriber.`);
          reload();
          return;
        }
        // The card the account charges, read from the sheet's own data: there is no
        // `moveCompanyToAccount` answer here (activation places the company itself), and
        // `accounts` carries a freshly opened account whose card the stale ask has never seen.
        // Naming it is what tells `applyChange` a card was chosen.
        const opened = (accounts ?? accountAsk.data).accounts.find((a) => a.id === accountId);
        // No toast: `apply` lands the result, and the same news twice over it reads as a flow
        // that does not believe in its own result screen. The sheet stays up, busy, until
        // `apply`'s `closeAsking()` replaces it with the answer.
        await apply({
          ...prompt,
          card: opened?.card ? shortCardName(opened.card.brand_label, opened.card.last4) : null,
        });
        return;
      }

      let placed: BillingAccounts;
      try {
        placed = await moveCompanyToAccount(entity.entity_id, accountId);
      } catch (err) {
        const error = err instanceof ApiError ? err.message : MOVE_FAILED;
        setAccountAsk((ask) => ask && { ...ask, picked: accountId, error });
        setChangeBusy(false);
        return;
      }
      if (!prompt) {
        // The panel's Change: the move was the whole ask. The row reads its card again - it is
        // the account's, and no ticks can be pending (the link is drawn only when none are) -
        // and the toast says where the company is billed now.
        setAccountAsk(null);
        setChangeBusy(false);
        summary.reload();
        const said = movedNotice(placed, entity.entity_id);
        if (said) showToast(said);
        return;
      }
      const account =
        placed.accounts.find((a) => a.id === accountId) ??
        (accounts ?? accountAsk.data).accounts.find((a) => a.id === accountId);
      const card = account?.card
        ? shortCardName(account.card.brand_label, account.card.last4)
        : null;
      await apply({ ...prompt, card });
    },
    [accountAsk, changeBusy, apply, summary, showToast, reload],
  );
  // "New billing account" in the sheet opened one: the sheet goes back to its list with the new
  // account in it and picked, and the company goes on it as if it had been picked there.
  const accountOpened = useCallback(
    (opened: OpenedAccount) => {
      if (!accountAsk) return;
      const data = opened.accounts ?? accountAsk.data;
      setAccountAsk({
        ...accountAsk,
        data,
        picked: opened.accountId ?? accountAsk.picked,
        error: null,
        key: accountAsk.key + 1,
      });
      if (opened.accountId) void confirmAccount(opened.accountId, data);
    },
    [accountAsk, confirmAccount],
  );
  const dismissAccountStep = useCallback(() => {
    if (changeBusy) return;
    setAccountAsk(null);
    setChangePrompt(null);
  }, [changeBusy]);
  const accountStep = useMemo<AccountStep | null>(() => {
    if (!accountAsk) return null;
    const { entity, prompt, data, needCard, intent } = accountAsk;
    // Activating needs a card on the account even though it charges nothing: a company
    // confirmed onto an account with nothing to charge looks activated and its trial still
    // expires.
    const targets =
      prompt || intent === "activate"
        ? nominationChoice(data, entity.entity_id, {
            needCard: needCard || intent === "activate",
          }).targets
        : accountChangeChoice(data, entity.entity_id).targets;
    return {
      data,
      targets,
      picked: accountAsk.picked,
      error: accountAsk.error,
      lead: nominateLead(entity.entity_name),
      key: accountAsk.key,
    };
  }, [accountAsk]);
  // Try again now: 06·B stays up, busy, while the same change is applied again - its answer
  // takes the dialog's place, as the first try's did.
  const retryDeclined = useCallback(async () => {
    if (!declined || changeBusy) return;
    await apply(declined.prompt);
  }, [declined, changeBusy, apply]);
  const dismissDeclined = useCallback(() => {
    if (!changeBusy) setDeclined(null);
  }, [changeBusy]);
  /**
   * The result screens' "Back to Manage Subscriptions" - every one of them, row or page, since
   * they share this handler. It LEAVES for the portal's landing (Figma 08-A): all 103 frames of
   * section 05·C carry `▶ Back to Manage Subscriptions → 08-A`, and so does 07-M. This list
   * unmounts on the way, so there is nothing to reset and nothing to reload - the landing does
   * its own read, and coming back here reloads anyway. It lands UNSCOPED (below).
   */
  const dismissResult = useCallback(() => {
    // The portal is the PAYER's, not a company's (the user, 2026-09-29: "Back to Manage
    // Subscriptions ... should reset the token to unscoped"). A token minted inside a company -
    // the module settings page's, which its CTAs bring here - is swapped for an unscoped one on
    // the way. Only Flask mints, so that is a trip through its handoff with no company, back
    // to the same landing; a token already unscoped just goes.
    if (isEntityScoped()) redirectToHandoff(PORTAL.index);
    else router.push(PORTAL.index);
  }, [router]);
  // The panel's Change beside the company's card: which account it is billed on, as a move.
  const changePaymentMethod = useCallback(
    (entity: PortalEntity) => {
      if (!changeBusy) void openAccounts(entity, null);
    },
    [changeBusy, openAccounts],
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
  // The banner is the page's, not a row's, so it names the FIRST company whose payment failed
  // and the billing page opens the account THAT company is on - the card that needs fixing,
  // rather than whichever account happens to be the payer's oldest.
  const updatePaymentMethod = useCallback(() => {
    const failing = entities.find((e) => e.modules.some((m) => m.status === "past_due"));
    router.push(BILLING.account({ entity: failing?.entity_id ?? null }));
  }, [router, entities]);
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
    activateChange,
    accountStep,
    confirmAccount,
    accountOpened,
    dismissAccountStep,
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
