"use client";

/**
 * The recipient's side of a handover (Figma 07-D/E/F/M): the requests offered to the signed-in
 * person, one of them under review - the company's modules as they are, what accepting charges
 * today, the card it will be charged to - and the accept or decline. The screen calls this and
 * renders what it returns.
 *
 * The only screen in the portal about companies the viewer does NOT pay for, and the one a
 * person can arrive at with no subscriptions at all - so it has to make sense cold (07-F). The
 * modules come with the transfer as they are (the API moves the company's billing whole), so
 * the cards are drawn, not ticked. ACCEPTING USUALLY TAKES A PAYMENT, and the screen says which
 * case it is: a quote for the days the outgoing payer's money does not cover, or "Nothing to pay
 * today" when everything is still on a free trial. The card charged is the person's default;
 * 07-E lets them pick another of their saved cards (made the default) before confirming. Adding
 * a card is the payment-method screen's job (08-K) - a seam until it is built.
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
import { PORTAL } from "@/features/subscription/lib/paths";
import { acceptCharge, inheritedTrialLines } from "@/features/subscription/lib/transfer";
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
  charge: ReturnType<typeof acceptCharge>;
  trialLines: string[];
  /** The person's saved cards, and the one the charge goes to. */
  cards: SavedPaymentMethod[];
  cardId: string | null;
  card: SavedPaymentMethod | null;
};

export type UseSubscriptionRequestsResult = {
  status: RequestsStatus;
  error: string | null;
  requests: IncomingTransfer[];
  /** The request under review, when one is. */
  reviewed: ReviewedRequest | null;
  review: (transfer: IncomingTransfer) => void;
  /** 07-E: choosing the card the charge goes to. */
  step: "review" | "payment";
  changeCard: () => void;
  pickCard: (id: string) => void;
  confirmCard: () => Promise<void>;
  addCard: () => void;
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
  const [step, setStep] = useState<"review" | "payment">("review");
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
    const view =
      c?.page && c.wallet
        ? buildSummaryView(
            c.page,
            null,
            { ...c.wallet, entity_id: row.entity_id, nominated_id: cardId },
            day,
          )
        : null;
    const symbol = c?.page?.summary?.currency ?? null;
    const cards = c?.wallet?.methods ?? [];
    return {
      row,
      view,
      viewStatus: c?.status ?? "loading",
      charge: acceptCharge(row, symbol),
      trialLines: inheritedTrialLines(row.trials ?? [], symbol),
      cards,
      cardId,
      card: cards.find((m) => m.id === cardId) ?? null,
    };
  }, [row, company, cardId, fixtureToday, today]);

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
  const addCard = useCallback(() => router.push(PORTAL.billing), [router]);

  const accept = useCallback(async () => {
    if (!row || busy || row.blockers.length > 0) return;
    setBusy(true);
    setActionError(null);
    try {
      await respondToTransfer(row.id, true);
      router.push(
        `${PORTAL.subscriptions}?entity=${encodeURIComponent(row.entity_id)}&transferred=1`,
      );
    } catch (err) {
      // Retrying is safe: the API adopts an invoice already paid under the request's key.
      setActionError(sentence(err, RESPOND_FAILED));
      setBusy(false);
    }
  }, [row, busy, router]);

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
    addCard,
    busy,
    actionError,
    accept,
    decline,
    reload,
    backToList,
  };
}
