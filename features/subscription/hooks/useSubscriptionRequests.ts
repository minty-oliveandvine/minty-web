"use client";

/**
 * The recipient's side of a handover (Figma 07-D/E/F/M): the requests offered to the signed-in
 * person, one of them under review - the company's modules as they are, the BILLING ACCOUNT the
 * bill will go to - and the accept or decline. The screen calls this and renders what it returns.
 *
 * A COMPANY HANDED OVER IS BILLED TO ONE OF THE RECIPIENT'S BILLING ACCOUNTS (the user,
 * 2026-10-01: "payment method should only go through billing account first. must be only attached
 * to the billing account"). 07-E lists their accounts - the same rows Manage Subscriptions'
 * "Billing Accounts" draws, the ones that cannot pay (collection failing, no card) shut with the
 * reason - the oldest that can pay preselected; Confirm Subscription Transfer sends it
 * (`billing_group_id`) and the company is billed to that account's charged card. No card is
 * promoted to a Stripe default, and none is saved loose.
 *
 * A PERSON WITH NO ACCOUNT BELONGS HERE. The API allows a company to be offered to any admin,
 * card or not, because being asked is not being charged; the account is required at the accept,
 * which is the moment the billing actually moves. So 07-E's "New billing account" opens the
 * billing-account sheet in place (`NewAccountDialog` - a card AND the company and email it bills
 * under, which is what opens an account) rather than navigating away and losing the offer; the
 * account it opens comes back selected.
 *
 * The only screen in the portal about companies the viewer does NOT pay for, and the one a
 * person can arrive at with no subscriptions at all - so it has to make sense cold (07-F). The
 * modules come with the transfer as they are (the API moves the company's billing whole), so
 * the cards are drawn, not ticked. ACCEPTING TAKES NO PAYMENT - the API charges nothing for days
 * that have not started and parks the charge until they do - so the screen names no figure and no
 * date. What it still discloses is the TRIALS being inherited, which commit the recipient to a
 * charge at a date of their own.
 *
 * Landings: accept → the list with the company's row landing on 07-M ("Subscription Transfer
 * Completed"); decline → the screen read again (07-F when nothing else waits). `fixture`:
 * dev-only, `?fixture=D|TRIAL|F` (the requests) with the company's cards from the 05·A frame
 * M24 and the recipient's accounts from `RECIPIENT_ACCOUNTS`.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/apiClient";

import { getModulePage, type ModulePage } from "@/features/subscription/api/moduleSettings";
import {
  fetchBillingAccounts,
  listIncomingTransfers,
  respondToTransfer,
  type BillingAccount,
  type BillingAccounts,
  type EntityPaymentMethod,
  type IncomingTransfer,
  type SavedPaymentMethod,
} from "@/features/subscription/api/payerPortal";
import type { OpenedAccount } from "@/features/subscription/hooks/useCardForm";
import {
  ACCOUNTS_LOAD_FAILED,
  transferChoice,
  type MoveTarget,
} from "@/features/subscription/lib/billingAccounts";
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
  /** The person's billing accounts, each with the reason it cannot pay when it cannot. */
  targets: MoveTarget[];
  /** The account the company will be billed to, and the card it charges. */
  accountId: string | null;
  account: BillingAccount | null;
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
  /** 07-E: choosing the billing account the company goes on. */
  step: "review" | "payment";
  /** 07-D "Choose Modules": tick or untick one. Unticked = cancelled for the company. */
  toggleModule: (code: string) => void;
  chooseAccount: () => void;
  pickAccount: (id: string) => void;
  confirmAccount: () => void;
  /** "New billing account": the sheet, over 07-E, while it is open. */
  addingAccount: boolean;
  addAccount: () => void;
  /** The sheet opened one and the person said Done: it joins the list, selected. */
  accountOpened: (opened: OpenedAccount) => void;
  cancelAddAccount: () => void;
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
): Promise<{ page: ModulePage; accounts: BillingAccounts }> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const t = await import("@/features/subscription/__fixtures__/transfers");
    if (t.isRequestsFixture(fixture)) {
      const m = await import("@/features/subscription/__fixtures__/modulePage");
      return { page: m.SUMMARY_FIXTURES.M24, accounts: t.RECIPIENT_ACCOUNTS };
    }
  }
  const [page, accounts] = await Promise.all([getModulePage(entityId), fetchBillingAccounts()]);
  return { page, accounts };
}

/** The account's charged card as the summary's wallet - "the card this company is billed to". */
function walletOf(account: BillingAccount | null, entityId: string): EntityPaymentMethod {
  return {
    has_account: account !== null,
    default_id: account?.default_id ?? null,
    methods: account?.cards ?? [],
    total: account?.cards.length ?? 0,
    entity_id: entityId,
    nominated_id: account?.card?.id ?? null,
  };
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
    accounts: BillingAccounts | null;
  } | null>(null);
  const [step, setStep] = useState<"review" | "payment">("review");
  const [addingAccount, setAddingAccount] = useState(false);
  // 07-D's choice, as the modules the person is DECLINING - empty means the whole company,
  // which is what arriving on the screen means. Keyed by the request it belongs to rather
  // than cleared in an effect: reviewing another request must not inherit this one's
  // choice, and the React compiler forbids setState from an effect.
  const [declined, setDeclined] = useState<{ forId: string; codes: string[] }>({
    forId: "",
    codes: [],
  });
  const [accountId, setAccountId] = useState<string | null>(null);
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

  // Its company: the cards as the open row draws them, and the person's own billing accounts.
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
        setCompany({
          forId: rowId,
          status: "ready",
          page: loaded.page,
          accounts: loaded.accounts,
        });
        // The oldest account that can pay - or none, and 07-E asks for one.
        setAccountId(transferChoice(loaded.accounts).picked);
      } catch {
        if (!live) return;
        setCompany({ forId: rowId, status: "error", page: null, accounts: null });
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
    const { targets } = transferChoice(c?.accounts ?? null);
    // Only an account that can take the company counts as chosen: a stale id (an account
    // that has since gone into dunning, or lost its card) is no choice at all.
    const account =
      targets.find((t) => t.account.id === accountId && t.block === null)?.account ?? null;
    // THE PANEL FOLLOWS THE TICKS. A module unticked here is one the recipient is not
    // taking on, so the plan and the price have to be the ones they will actually be
    // billed - fed in as a pending change, which is the same machinery the open row uses
    // for the same question. It also splits the panel honestly: the company keeps both
    // modules until the outgoing payer's money runs out, and only what was kept after.
    const out = declined.forId === row.id ? declined.codes : [];
    const pending = Object.fromEntries(out.map((code) => [code, false]));
    const view =
      c?.page && c.accounts
        ? buildSummaryView(c.page, null, walletOf(account, row.entity_id), day, pending)
        : null;
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
      targets,
      accountId: account?.id ?? null,
      account,
      card: account?.card ?? null,
      offered: offered.map((m) => m.code),
      taking,
    };
  }, [row, company, accountId, fixtureToday, today, declined]);

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
  const chooseAccount = useCallback(() => {
    setActionError(null);
    setStep("payment");
  }, []);
  // Choosing is local: nothing is posted until Confirm Subscription Transfer carries the account.
  const pickAccount = useCallback((id: string) => setAccountId(id), []);
  const confirmAccount = useCallback(() => {
    if (accountId) setStep("review");
  }, [accountId]);
  /**
   * OPENING AN ACCOUNT HAPPENS HERE, not on the billing page: leaving would answer the request
   * by abandoning it - the offer under review, the company's cards and the ticks all gone.
   */
  const addAccount = useCallback(() => {
    setActionError(null);
    setAddingAccount(true);
  }, []);
  const cancelAddAccount = useCallback(() => setAddingAccount(false), []);
  const accountOpened = useCallback(
    (opened: OpenedAccount) => {
      setAddingAccount(false);
      // Selected straight away: they opened it in the middle of choosing which account pays,
      // so choosing it for them is what they just asked for.
      if (opened.accountId) setAccountId(opened.accountId);
      setStep("payment");
      if (opened.accounts) {
        const accounts = opened.accounts;
        setCompany((c) => (c ? { ...c, accounts } : c));
        return;
      }
      // The sheet could not read the accounts back: read them here, or say so - a list without
      // the account just opened would offer nothing to pick.
      void fetchBillingAccounts().then(
        (accounts) => setCompany((c) => (c ? { ...c, accounts } : c)),
        (err) => setActionError(sentence(err, ACCOUNTS_LOAD_FAILED)),
      );
    },
    [],
  );

  const accept = useCallback(async () => {
    const chosen = reviewed?.account ?? null;
    if (!row || busy || row.blockers.length > 0 || !chosen) return;
    const taking = reviewed?.taking ?? [];
    const offered = reviewed?.offered ?? [];
    setBusy(true);
    setActionError(null);
    try {
      // Sent only when it is a CHOICE. Unchanged, the whole company goes, and omitting the
      // field says exactly that rather than re-listing what the API would read anyway.
      const chose = taking.length < offered.length;
      await respondToTransfer(row.id, true, {
        codes: chose ? taking : undefined,
        billingGroupId: chosen.id,
      });
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
    toggleModule,
    chooseAccount,
    pickAccount,
    confirmAccount,
    addingAccount,
    addAccount,
    accountOpened,
    cancelAddAccount,
    busy,
    actionError,
    accept,
    decline,
    reload,
    backToList,
  };
}
