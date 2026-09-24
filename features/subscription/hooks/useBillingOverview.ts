"use client";

/**
 * The portal's landing (Figma 08-A "Subscription & Billing"): where the bill goes and when, how
 * many companies are being paid for, how many trials are about to end, and the line per company
 * that needs the payer to know something. The screen calls this and renders what it returns.
 *
 * ONE READ: `/api/me/subscriptions`, which carries the payer, the billing anchor and every
 * module's state. The figures and the update lines are computed from it (`lib/billing.ts`), not
 * asked for separately - the same answer the Manage Subscriptions list is built from, so the
 * two pages can never disagree about how many companies there are.
 *
 * Landings: *Manage Subscription* → the list (04-A); *Go to payment details and invoices* →
 * the billing page (08-B). "Back to the entity dashboard" is a plain link to Minty, drawn by
 * the screen as the list's empty state draws its own. `fixture`: dev-only, `?fixture=A|B|F`
 * (the list's own frames).
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/apiClient";

import {
  fetchAllPayerSubscriptions,
  markTransferSeen,
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
import { PORTAL } from "@/features/subscription/lib/paths";

export type OverviewStatus = "loading" | "ready" | "error";

export type UseBillingOverviewArgs = {
  fixture?: string | null;
  today?: Date;
};

export type UseBillingOverviewResult = {
  status: OverviewStatus;
  error: string | null;
  next: NextBilling;
  overview: Overview;
  goToBilling: () => void;
  manageSubscriptions: () => void;
  /**
   * How one of the payer's own offers ended, where they have not been told (07-I / A-07 /
   * A-08). One at a time, oldest first: several can have finished while they were away, and
   * stacking modals is worse than a short queue.
   */
  outcome: TransferOutcomeRow | null;
  dismissOutcome: () => void;
  reload: () => void;
};

async function loadAccount(
  fixture: string | null | undefined,
  signal: AbortSignal,
): Promise<{ account: PayerAccount; today: Date | null }> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/subscriptions");
    if (f.isListFixture(fixture)) {
      const { TODAY } = await import("@/features/subscription/__fixtures__/modulePage");
      return { account: f.LIST_FIXTURES[fixture].page, today: TODAY };
    }
  }
  return { account: await fetchAllPayerSubscriptions(signal), today: null };
}

export function useBillingOverview({
  fixture,
  today,
}: UseBillingOverviewArgs = {}): UseBillingOverviewResult {
  const router = useRouter();
  const [status, setStatus] = useState<OverviewStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<PayerAccount | null>(null);
  const [fixtureToday, setFixtureToday] = useState<Date | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const loaded = await loadAccount(fixture, controller.signal);
        if (controller.signal.aborted) return;
        setAccount(loaded.account);
        setFixtureToday(loaded.today);
        setError(null);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : BILLING_LOAD_FAILED);
        setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [fixture, generation]);

  // Which outcomes have been answered in THIS visit. The server marker is what stops them
  // returning tomorrow; this is only so the queue advances without re-reading the page.
  const [dismissed, setDismissed] = useState<string[]>([]);

  const outcome = useMemo(() => {
    const all = account?.transfer_outcomes ?? [];
    return all.find((o) => !dismissed.includes(o.id)) ?? null;
  }, [account, dismissed]);

  const dismissOutcome = useCallback(() => {
    if (!outcome) return;
    // OPTIMISTIC, and deliberately so. The modal closes on the click and the POST runs
    // behind it; a failure only means it opens once more next visit, which is the safe
    // direction. Trapping somebody behind a dialog that will not close is not.
    setDismissed((seen) => [...seen, outcome.id]);
    void markTransferSeen(outcome.id).catch(() => {});
  }, [outcome]);

  const next = useMemo(() => nextBilling(account), [account]);
  const summary = useMemo(
    () => overview(account, fixtureToday ?? today ?? new Date()),
    [account, fixtureToday, today],
  );

  return {
    status,
    error,
    next,
    overview: summary,
    outcome,
    dismissOutcome,
    goToBilling: useCallback(() => router.push(PORTAL.billing), [router]),
    manageSubscriptions: useCallback(() => router.push(PORTAL.subscriptions), [router]),
    reload: useCallback(() => {
      setStatus("loading");
      setGeneration((g) => g + 1);
    }, []),
  };
}
