"use client";

/**
 * The recipient's side of a handover (Figma 07-D/E/F/M): the requests offered to the signed-in
 * person, one of them under review - the company's modules as they are, the card the bill will
 * go to - and the accept or decline. The screen calls this and renders what it returns.
 *
 * A PERSON WITH NO CARD BELONGS HERE. The API allows a company to be offered to any admin,
 * card or not, because being asked is not being charged; the card is required at the accept,
 * which is the moment money actually moves. So the picker's "Add New Card" mounts Stripe's form
 * in place (the `add-card` step) rather than navigating to the billing page and losing the
 * offer.
 *
 * The only screen in the portal about companies the viewer does NOT pay for, and the one a
 * person can arrive at with no subscriptions at all - so it has to make sense cold (07-F). The
 * modules come with the transfer as they are (the API moves the company's billing whole), so
 * the cards are drawn, not ticked. ACCEPTING TAKES NO PAYMENT - the API charges nothing for days
 * that have not started and parks the charge until they do - so the screen names no figure and no
 * date. What it still discloses is the TRIALS being inherited, which commit the recipient to a
 * charge at a date of their own. The card the bill will go to is the person's default; 07-E lets
 * them pick another of their saved cards (made the default), or add one, before confirming.
 *
 * Landings: accept → the list with the company's row landing on 07-M ("Subscription Transfer
 * Completed"); decline → the screen read again (07-F when nothing else waits). `fixture`:
 * dev-only, `?fixture=D|TRIAL|F` (the requests) with the company's cards from the 05·A frame
 * M24.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/apiClient";

import { getModulePage, type ModulePage } from "@/features/subscription/api/moduleSettings";
import {
  fetchPaymentMethods,
  listIncomingTransfers,
  respondToTransfer,
  setDefaultPaymentMethod,
  type IncomingTransfer,
  type PayerPaymentMethods,
  type SavedPaymentMethod,
} from "@/features/subscription/api/payerPortal";
import { useSetupIntent, type SetupIntentState } from "@/features/subscription/hooks/useCardForm";
import { PORTAL } from "@/features/subscription/lib/paths";
import {
  buildSummaryView,
  type SummaryView,
} from "@/features/subscription/lib/subscriptionSummary";

export type RequestsStatus = "loading" | "ready" | "error";

export const REQUESTS_LOAD_FAILED = "That didn’t come through. Mind trying again?";
export const RESPOND_FAILED = "That didn’t go through. Mind trying again?";

export type UseSubscriptionRequestsArgs = {
  /** `?transfer=` - the request to review; the only one when there is one. */
  transferId?: string | null;
  fixture?: string | null;
  today?: Date;
};

export type ReviewedRequest = {
  row: IncomingTransfer;
  /** The company's cards and summary, as the open row draws them; null until read. */
  view: SummaryView | null;
  viewStatus: "loading" | "ready" | "error";
  /** The person's saved cards, and the one the bill will go to. */
  cards: SavedPaymentMethod[];
  cardId: string | null;
  card: SavedPaymentMethod | null;
  /** 07-D: the modules this handover is offering, and which of them are being taken on. */
  offered: string[];
  taking: string[];
};

export type UseSubscriptionRequestsResult = {
  status: RequestsStatus;
  error: string | null;
  requests: IncomingTransfer[];
  /** The request under review, when one is. */
  reviewed: ReviewedRequest | null;
  review: (transfer: IncomingTransfer) => void;
  /** 07-E: choosing the card the charge goes to, and adding one without leaving it. */
  step: "review" | "payment" | "add-card";
  /** 07-D "Choose Modules": tick or untick one. Unticked = cancelled for the company. */
  toggleModule: (code: string) => void;
  changeCard: () => void;
  pickCard: (id: string) => void;
  confirmCard: () => Promise<void>;
  addCard: () => void;
  /** The SetupIntent behind the "add-card" step; only opened once that step is reached. */
  setup: SetupIntentState;
  /** What the card form calls once Stripe has the card: keep it, pick it, go back to 07-E. */
  cardSaved: (methods: PayerPaymentMethods, paymentMethodId: string | null) => void;
  cancelAddCard: () => void;
  busy: boolean;
  actionError: string | null;
  accept: () => Promise<void>;
  decline: () => Promise<void>;
  reload: () => void;
  backToList: () => void;
};

function sentence(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

async function loadRequests(
  fixture: string | null | undefined,
  signal: AbortSignal,
): Promise<{ rows: IncomingTransfer[]; today: Date | null }> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/transfers");
    if (f.isRequestsFixture(fixture)) {
      const { TODAY } = await import("@/features/subscription/__fixtures__/modulePage");
      return { rows: f.REQUESTS_FIXTURES[fixture], today: TODAY };
    }
  }
  return { rows: await listIncomingTransfers(signal), today: null };
}

async function loadCompany(
  entityId: string,
  fixture: string | null | undefined,
): Promise<{ page: ModulePage; wallet: PayerPaymentMethods }> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const t = await import("@/features/subscription/__fixtures__/transfers");
    if (t.isRequestsFixture(fixture)) {
      const m = await import("@/features/subscription/__fixtures__/modulePage");
      return { page: m.SUMMARY_FIXTURES.M24, wallet: t.RECIPIENT_CARDS };
    }
  }
  const [page, wallet] = await Promise.all([getModulePage(entityId), fetchPaymentMethods()]);
  return { page, wallet };
}

export function useSubscriptionRequests({
  transferId = null,
  fixture,
  today,
}: UseSubscriptionRequestsArgs = {}): UseSubscriptionRequestsResult {
  const router = useRouter();
  const [status, setStatus] = useState<RequestsStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<IncomingTransfer[]>([]);
  const [fixtureToday, setFixtureToday] = useState<Date | null>(null);
  const [generation, setGeneration] = useState(0);
  const [reviewId, setReviewId] = useState<string | null>(transferId);
  const [company, setCompany] = useState<{
    forId: string;
    status: "loading" | "ready" | "error";
    page: ModulePage | null;
    wallet: PayerPaymentMethods | null;
  } | null>(null);
  const [step, setStep] = useState<"review" | "payment" | "add-card">("review");
  // 07-D's choice, as the modules the person is DECLINING - empty means the whole company,
  // which is what arriving on the screen means. Keyed by the request it belongs to rather
  // than cleared in an effect: reviewing another request must not inherit this one's
  // choice, and the React compiler forbids setState from an effect.
  const [declined, setDeclined] = useState<{ forId: string; codes: string[] }>({
    forId: "",
    codes: [],
  });
  const [cardId, setCardId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const loaded = await loadRequests(fixture, controller.signal);
        if (controller.signal.aborted) return;
        setRequests(loaded.rows);
        setFixtureToday(loaded.today);
        setError(null);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(sentence(err, REQUESTS_LOAD_FAILED));
        setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [fixture, generation]);

  // The request under review: the one asked for, else the only one.
  const row = useMemo(() => {
    if (requests.length === 0) return null;
    if (reviewId) return requests.find((r) => r.id === reviewId) ?? null;
    return requests.length === 1 ? requests[0] : null;
  }, [requests, reviewId]);

  // Its company: the cards as the open row draws them, and the person's own wallet.
  const rowId = row?.id ?? null;
  const rowEntityId = row?.entity_id ?? null;
  useEffect(() => {
    if (!rowId || !rowEntityId) return;
    let live = true;
    // Nothing is set here: until the answer lands, `reviewed` reads the company as loading.
    (async () => {
      try {
        const loaded = await loadCompany(rowEntityId, fixture);
        if (!live) return;
        setCompany({ forId: rowId, status: "ready", page: loaded.page, wallet: loaded.wallet });
        setCardId(loaded.wallet.default_id);
      } catch {
        if (!live) return;
        setCompany({ forId: rowId, status: "error", page: null, wallet: null });
      }
    })();
    return () => {
      live = false;
    };
  }, [rowId, rowEntityId, fixture, generation]);

  const reviewed = useMemo((): ReviewedRequest | null => {
    if (!row) return null;
    const day = fixtureToday ?? today ?? new Date();
    const c = company && company.forId === row.id ? company : null;
    // THE PANEL FOLLOWS THE TICKS. A module unticked here is one the recipient is not
    // taking on, so the plan and the price have to be the ones they will actually be
    // billed - fed in as a pending change, which is the same machinery the open row uses
    // for the same question. It also splits the panel honestly: the company keeps both
    // modules until the outgoing payer's money runs out, and only what was kept after.
    const out = declined.forId === row.id ? declined.codes : [];
    const pending = Object.fromEntries(out.map((code) => [code, false]));
    const view =
      c?.page && c.wallet
        ? buildSummaryView(
            c.page,
            null,
            { ...c.wallet, entity_id: row.entity_id, nominated_id: cardId },
            day,
            pending,
          )
        : null;
    const cards = c?.wallet?.methods ?? [];
    // EVERY module the company holds, minus the ones unticked here. Built from what the
    // page shows rather than from the ticks: a trial the outgoing payer never confirmed
    // reads as "unticked" and is still part of the company, so sending only the ticked
    // ones would decline it without anybody saying so.
    const offered = (view?.modules ?? []).filter((m) => m.tick !== "start_trial");
    const taking = offered.map((m) => m.code).filter((code) => !out.includes(code));
    return {
      row,
      view,
      viewStatus: c?.status ?? "loading",
      cards,
      cardId,
      card: cards.find((m) => m.id === cardId) ?? null,
      offered: offered.map((m) => m.code),
      taking,
    };
  }, [row, company, cardId, fixtureToday, today, declined]);

  /**
   * Tick or untick one module on 07-D.
   *
   * THE LAST TICKED MODULE CANNOT BE UNTICKED. Taking nothing on is not a handover - it is
   * declining one, which is the other button - so rather than let the screen reach a state
   * it would then have to refuse, the last tick simply does not come off. The API refuses an
   * empty set too; that guard stays, because it answers a request rather than a click.
   */
  const toggleModule = useCallback(
    (code: string) => {
      setActionError(null);
      const offered = reviewed?.offered ?? [];
      setDeclined((d) => {
        const forId = rowId ?? "";
        const codes = d.forId === forId ? d.codes : [];
        if (codes.includes(code)) return { forId, codes: codes.filter((c) => c !== code) };
        const leftAfter = offered.filter((c) => c !== code && !codes.includes(c));
        if (leftAfter.length === 0) return { forId, codes };
        return { forId, codes: [...codes, code] };
      });
    },
    [rowId, reviewed],
  );

  const reload = useCallback(() => {
    setStatus("loading");
    setGeneration((g) => g + 1);
  }, []);

  const review = useCallback((transfer: IncomingTransfer) => {
    setReviewId(transfer.id);
    setStep("review");
    setActionError(null);
  }, []);
  const changeCard = useCallback(() => setStep("payment"), []);
  const pickCard = useCallback((id: string) => setCardId(id), []);
  const confirmCard = useCallback(async () => {
    const wallet = company?.wallet;
    if (!cardId || busy) return;
    if (wallet && wallet.default_id !== cardId) {
      setBusy(true);
      setActionError(null);
      try {
        const updated = await setDefaultPaymentMethod(cardId);
        setCompany((c) => (c ? { ...c, wallet: updated } : c));
      } catch (err) {
        setActionError(sentence(err, RESPOND_FAILED));
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    setStep("review");
  }, [company, cardId, busy]);
  /**
   * ADDING A CARD HAPPENS HERE, not on the billing page. This used to push to `PORTAL.billing`,
   * which answered the request by abandoning it: the offer under review, the company's cards
   * and the quote all went, and coming back meant finding the request again. It also made the
   * screen unusable for the person who most needs it — someone with no card at all, who the
   * API now lets be offered a company precisely so they can say yes and add one.
   */
  const addCard = useCallback(() => {
    setActionError(null);
    setStep("add-card");
  }, []);
  const cancelAddCard = useCallback(() => setStep("payment"), []);

  const setup = useSetupIntent({ enabled: step === "add-card", fixture });

  const cardSaved = useCallback(
    (methods: PayerPaymentMethods, paymentMethodId: string | null) => {
      // The id Stripe confirmed, else the newest card the server now holds. Selected straight
      // away: they added it in the middle of choosing which card to be charged on, so choosing
      // it for them is what they just asked for.
      const id = paymentMethodId ?? methods.methods.at(-1)?.id ?? null;
      setCompany((c) => (c ? { ...c, wallet: methods } : c));
      if (id) setCardId(id);
      setStep("payment");
    },
    [],
  );

  const accept = useCallback(async () => {
    if (!row || busy || row.blockers.length > 0) return;
    const taking = reviewed?.taking ?? [];
    const offered = reviewed?.offered ?? [];
    setBusy(true);
    setActionError(null);
    try {
      // Sent only when it is a CHOICE. Unchanged, the whole company goes, and omitting the
      // field says exactly that rather than re-listing what the API would read anyway.
      const chose = taking.length < offered.length;
      await respondToTransfer(row.id, true, chose ? taking : undefined);
      router.push(
        `${PORTAL.subscriptions}?entity=${encodeURIComponent(row.entity_id)}&transferred=1`,
      );
    } catch (err) {
      // Retrying is safe: the API adopts an invoice already paid under the request's key.
      setActionError(sentence(err, RESPOND_FAILED));
      setBusy(false);
    }
  }, [row, busy, router, reviewed]);

  const decline = useCallback(async () => {
    if (!row || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      await respondToTransfer(row.id, false);
      setReviewId(null);
      setStep("review");
      reload();
    } catch (err) {
      setActionError(sentence(err, RESPOND_FAILED));
    } finally {
      setBusy(false);
    }
  }, [row, busy, reload]);

  const backToList = useCallback(() => router.push(PORTAL.subscriptions), [router]);

  return {
    status,
    error,
    requests,
    reviewed,
    review,
    step,
    changeCard,
    pickCard,
    confirmCard,
    toggleModule,
    addCard,
    setup,
    cardSaved,
    cancelAddCard,
    busy,
    actionError,
    accept,
    decline,
    reload,
    backToList,
  };
}
