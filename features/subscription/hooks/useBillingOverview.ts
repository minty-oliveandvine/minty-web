"use client";

/**
 * The portal's landing (Figma 08-A "Subscription & Billing"): ONE billing account - its name as
 * "Bill to", the payer's next billing date - how many companies are being paid for, how many
 * trials are about to end, and the line per company that needs the payer to know something.
 * The screen calls this and renders what it returns.
 *
 * TWO READS, AND ONLY ONE IS THE PAGE'S. `/api/me/subscriptions` carries every module's state,
 * and the figures and update lines are computed from it (`lib/billing.ts`) - the same answer the
 * Manage Subscriptions list is built from, so the two pages never disagree about how many
 * companies there are. Its failure is the page's. `/api/me/billing/accounts` names the accounts;
 * its failure leaves the card on the payer-level fallback with a retry, rather than taking the
 * overview down with it.
 *
 * WHICH ACCOUNT is the URL's (`?account=`): clicking the card opens a picker, and picking only
 * rewrites the URL - nothing is re-read, nothing about billing changes. With none, the oldest.
 * "Change billing account" is different: it MOVES a company to another account (the API writes
 * it), and says so on the card once it has.
 *
 * "New billing account" is not a page: the picker (and the move's second step) turn into
 * onboarding's form in place, and once the payer says Done on the success card, `accountOpened`
 * takes the accounts the sheet came back with, shows the new one, and says where the company
 * went when it was opened for one.
 *
 * Landings: *Manage Subscription* → the list (04-A); *Go to payment details and invoices* → the
 * shown account's page (08-B). `fixture`: dev-only, `?fixture=A|B|F`.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/apiClient";

import {
  fetchAllPayerSubscriptions,
  fetchBillingAccounts,
  markTransferSeen,
  moveCompanyToAccount,
  type BillingAccount,
  type BillingAccounts,
  type TransferOutcomeRow,
} from "@/features/subscription/api/payerPortal";
import {
  BILLING_LOAD_FAILED,
  nextBilling,
  overview,
  type NextBilling,
  type Overview,
  type PayerAccount,
} from "@/features/subscription/lib/billing";
import type { OpenedAccount } from "@/features/subscription/hooks/useCardForm";
import {
  MOVE_FAILED,
  accountBilling,
  moveFailedNotice,
  movedNotice,
  pickAccount,
} from "@/features/subscription/lib/billingAccounts";
import { BILLING, PORTAL, overviewPath } from "@/features/subscription/lib/paths";

export type OverviewStatus = "loading" | "ready" | "error";

export type UseBillingOverviewArgs = {
  /** `?account=` - the billing account the card shows; none means the payer's oldest. */
  accountId?: string | null;
  fixture?: string | null;
  today?: Date;
};

export type OverviewNotice = { text: string; tone: "ok" | "failed" };

export type UseBillingOverviewResult = {
  status: OverviewStatus;
  error: string | null;
  next: NextBilling;
  overview: Overview;
  /** The Subscription updates: the first five, or - after *Show more* - every one. */
  updatesExpanded: boolean;
  toggleUpdates: () => void;
  /** The accounts, once read. Null while loading, or when they could not be read. */
  accounts: BillingAccounts | null;
  accountsFailed: boolean;
  account: BillingAccount | null;
  notice: OverviewNotice | null;
  /** The picker the card opens: which account to show. */
  picking: boolean;
  openPicker: () => void;
  closePicker: () => void;
  confirmPick: (accountId: string) => void;
  /** "Change billing account": one company to another account. */
  moving: boolean;
  openMove: () => void;
  closeMove: () => void;
  moveBusy: boolean;
  moveError: string | null;
  moveCompany: (entityId: string, accountId: string) => Promise<void>;
  /** Done on the sheet's success card: an account was opened (and a company moved onto it?). */
  accountOpened: (opened: OpenedAccount) => void;
  goToBilling: () => void;
  manageSubscriptions: () => void;
  /**
   * How one of the payer's own offers ended, where they have not been told (07-I / A-07 /
   * A-08). One at a time, oldest first: several can have finished while they were away, and
   * stacking modals is worse than a short queue.
   */
  outcome: TransferOutcomeRow | null;
  /** Done: records it as seen, so it never returns. */
  dismissOutcome: () => void;
  /** The backdrop and Escape: closes it for this visit only. */
  closeOutcome: () => void;
  reload: () => void;
};

async function loadPage(
  fixture: string | null | undefined,
  signal: AbortSignal,
): Promise<{ list: PayerAccount; accounts: BillingAccounts | null; today: Date | null }> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/subscriptions");
    if (f.isListFixture(fixture)) {
      const { TODAY } = await import("@/features/subscription/__fixtures__/modulePage");
      const b = await import("@/features/subscription/__fixtures__/billing");
      return {
        list: f.LIST_FIXTURES[fixture].page,
        accounts: fixture === "B" ? b.ACCOUNTS_NONE : b.ACCOUNTS,
        today: TODAY,
      };
    }
  }
  const [list, accounts] = await Promise.all([
    fetchAllPayerSubscriptions(signal),
    // Not the page's subject: a failure here leaves the card on the payer, with a retry.
    fetchBillingAccounts({ signal }).catch(() => null),
  ]);
  return { list, accounts, today: null };
}

function sentence(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function useBillingOverview({
  accountId = null,
  fixture,
  today,
}: UseBillingOverviewArgs = {}): UseBillingOverviewResult {
  const router = useRouter();
  const [status, setStatus] = useState<OverviewStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<PayerAccount | null>(null);
  const [accounts, setAccounts] = useState<BillingAccounts | null>(null);
  const [fixtureToday, setFixtureToday] = useState<Date | null>(null);
  const [generation, setGeneration] = useState(0);
  const [picking, setPicking] = useState(false);
  const [updatesExpanded, setUpdatesExpanded] = useState(false);
  const [moving, setMoving] = useState(false);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  // The company the last move (or the last new account) was for: moved, or refused and left.
  const [movedHere, setMovedHere] = useState<string | null>(null);
  const [moveFailedHere, setMoveFailedHere] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const loaded = await loadPage(fixture, controller.signal);
        if (controller.signal.aborted) return;
        setList(loaded.list);
        setAccounts(loaded.accounts);
        setFixtureToday(loaded.today);
        setError(null);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(sentence(err, BILLING_LOAD_FAILED));
        setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [fixture, generation]);

  // Which outcomes have been answered in THIS visit. The server marker is what stops them
  // returning tomorrow; this is only so the queue advances without re-reading the page.
  const [dismissed, setDismissed] = useState<string[]>([]);

  const outcome = useMemo(() => {
    const all = list?.transfer_outcomes ?? [];
    return all.find((o) => !dismissed.includes(o.id)) ?? null;
  }, [list, dismissed]);

  /**
   * Take this outcome off the queue. `seen` says whether it also goes on the record.
   *
   * ONLY DONE MARKS IT SEEN. The marker is once-ever, so a backdrop click that consumed it
   * would remove the only in-app telling of a declined handover for good; closing simply
   * defers it to the next visit. Either way it leaves the queue now, so nobody is trapped
   * behind a dialog that will not go.
   *
   * The POST is OPTIMISTIC: the modal closes on the click and the write runs behind it. A
   * failure only means it opens once more, which is the safe direction to fail in.
   */
  const advance = useCallback(
    (seen: boolean) => {
      if (!outcome) return;
      setDismissed((done) => [...done, outcome.id]);
      if (seen) void markTransferSeen(outcome.id).catch(() => {});
    },
    [outcome],
  );
  const dismissOutcome = useCallback(() => advance(true), [advance]);
  const closeOutcome = useCallback(() => advance(false), [advance]);

  const accountsFailed = status === "ready" && accounts === null;
  const account = useMemo(() => pickAccount(accounts, { id: accountId }), [accounts, accountId]);
  const next = useMemo(
    () => (accounts ? accountBilling(accounts, account) : nextBilling(list)),
    [accounts, account, list],
  );
  const summary = useMemo(
    () => overview(list, fixtureToday ?? today ?? new Date()),
    [list, fixtureToday, today],
  );

  // What the card says about a move: made here, or made for a new account the sheet opened (or
  // refused, with the account open all the same). Derived from the accounts, so it names the
  // account the company is on NOW.
  const notice = useMemo((): OverviewNotice | null => {
    if (!accounts) return null;
    if (movedHere) {
      const text = movedNotice(accounts, movedHere);
      if (text) return { text, tone: "ok" };
    }
    if (moveFailedHere) {
      return { text: moveFailedNotice(accounts, moveFailedHere), tone: "failed" };
    }
    return null;
  }, [accounts, movedHere, moveFailedHere]);

  const reload = useCallback(() => {
    setStatus("loading");
    setGeneration((g) => g + 1);
  }, []);

  const confirmPick = useCallback(
    (id: string) => {
      setPicking(false);
      // Only the URL changes: which account is shown is not a fact anybody else needs.
      router.replace(overviewPath(id), { scroll: false });
    },
    [router],
  );

  const moveCompany = useCallback(
    async (entityId: string, targetId: string) => {
      if (moveBusy) return;
      setMoveBusy(true);
      setMoveError(null);
      try {
        const answer = await moveCompanyToAccount(entityId, targetId);
        setAccounts(answer);
        setMovedHere(answer.moved ? answer.moved.entity_id : null);
        setMoveFailedHere(null);
        setMoving(false);
      } catch (err) {
        // The API's refusal names the fix (settle a failed payment first; add a card); shown
        // as written, and the dialog stays open on it.
        setMoveError(sentence(err, MOVE_FAILED));
      } finally {
        setMoveBusy(false);
      }
    },
    [moveBusy],
  );

  const accountOpened = useCallback(
    (opened: OpenedAccount) => {
      setPicking(false);
      setMoving(false);
      setMovedHere(opened.moved);
      setMoveFailedHere(opened.moveFailed);
      // The sheet read the accounts after opening one; if that read failed, read the page
      // again rather than show a picker and a card that do not know the new account.
      if (opened.accounts) setAccounts(opened.accounts);
      else reload();
      if (opened.accountId) router.replace(overviewPath(opened.accountId), { scroll: false });
    },
    [router, reload],
  );

  return {
    status,
    error,
    next,
    overview: summary,
    updatesExpanded,
    toggleUpdates: useCallback(() => setUpdatesExpanded((open) => !open), []),
    accounts,
    accountsFailed,
    account,
    notice,
    picking,
    openPicker: useCallback(() => setPicking(true), []),
    closePicker: useCallback(() => setPicking(false), []),
    confirmPick,
    moving,
    openMove: useCallback(() => {
      setMoveError(null);
      setMoving(true);
    }, []),
    closeMove: useCallback(() => {
      if (!moveBusy) setMoving(false);
    }, [moveBusy]),
    moveBusy,
    moveError,
    moveCompany,
    accountOpened,
    outcome,
    dismissOutcome,
    closeOutcome,
    goToBilling: useCallback(
      () => router.push(BILLING.account({ id: account?.id ?? null })),
      [router, account],
    ),
    manageSubscriptions: useCallback(() => router.push(PORTAL.subscriptions), [router]),
    reload,
  };
}
