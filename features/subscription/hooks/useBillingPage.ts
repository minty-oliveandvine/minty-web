"use client";

/**
 * The billing page (Figma 08-B and every state the design draws for it): who the bill goes to,
 * the cards saved on the account, and the invoices already paid. The screen calls this and
 * renders what it returns.
 *
 * THREE READS, ONE PAGE, AND A FAILURE IN ONE DOES NOT TAKE THE OTHERS DOWN: the cards
 * (`/api/me/billing/payment-methods`) are the page's subject, so their failure is the page's;
 * the companies (`/api/me/subscriptions`) name who is billed and whether a payment has failed
 * (08-K), and the invoices (`/api/me/invoices`) fill the table - either one missing leaves its
 * own block quiet rather than replacing the page with an error.
 *
 * THE DEFAULT CARD IS THE ONE CHARGED, so the page never lets it be removed (08-R tells the
 * payer why, instead of the server refusing after the row already looks gone), and after every
 * write the wallet is taken from the answer rather than patched locally - `set_default`,
 * `remove` and `update` each return the whole list precisely so the page cannot drift.
 *
 * Landings: *+ Add payment method* → 08-Y, which comes back with `?added=<card>` so this page
 * can say what happened (08-N when it is not the default, 08-S when it is); *Edit* → 08-D;
 * *Invoice PDF* → Stripe's hosted page, in a new tab. `fixture`: dev-only, `?fixture=B|H|I|J|N`.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/apiClient";

import {
  fetchAllPayerSubscriptions,
  fetchPayerInvoices,
  fetchPaymentMethods,
  removePaymentMethod,
  setDefaultPaymentMethod,
  type InvoiceRow,
  type PayerPaymentMethods,
  type SavedPaymentMethod,
} from "@/features/subscription/api/payerPortal";
import {
  BILLING_LOAD_FAILED,
  CARD_ACTION_FAILED,
  amountHeader,
  cardMenu,
  cardRows,
  expiredNotice,
  invoiceLines,
  nextBilling,
  showMoreLabel,
  visibleCards,
  type CardMenuItem,
  type CardRow,
  type InvoiceLine,
  type NextBilling,
  type PayerAccount,
} from "@/features/subscription/lib/billing";
import { BILLING, PORTAL } from "@/features/subscription/lib/paths";

export type BillingStatus = "loading" | "ready" | "error";

/** What the page is asking about, when it is asking (08-R, or a removal being confirmed). */
export type CardPrompt = { kind: "remove" | "remove_default"; row: CardRow };

/** 08-N / 08-S: the card that just came back from the Stripe form. */
export type AddedCard = { card: SavedPaymentMethod; isDefault: boolean };

export type UseBillingPageArgs = {
  /** `?added=<pm>` - the card the add-card screen just saved. */
  addedId?: string | null;
  fixture?: string | null;
};

export type UseBillingPageResult = {
  status: BillingStatus;
  error: string | null;
  next: NextBilling;
  rows: CardRow[];
  shown: CardRow[];
  expanded: boolean;
  toggleExpanded: () => void;
  showMore: string | null;
  expired: string | null;
  menuFor: (row: CardRow) => CardMenuItem[];
  onMenu: (row: CardRow, item: CardMenuItem) => void;
  prompt: CardPrompt | null;
  dismissPrompt: () => void;
  confirmRemove: () => Promise<void>;
  added: AddedCard | null;
  makeAddedDefault: () => Promise<void>;
  dismissAdded: () => void;
  busy: boolean;
  actionError: string | null;
  invoices: InvoiceLine[];
  invoiceHeader: string;
  addCard: () => void;
  back: () => void;
  reload: () => void;
};

function sentence(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

async function loadWallet(fixture: string | null | undefined): Promise<PayerPaymentMethods> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/billing");
    if (f.isBillingFixture(fixture)) return f.BILLING_FIXTURES[fixture];
  }
  return fetchPaymentMethods();
}

async function loadRest(
  fixture: string | null | undefined,
  signal: AbortSignal,
): Promise<{ list: PayerAccount | null; invoices: InvoiceRow[] }> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/billing");
    if (f.isBillingFixture(fixture)) {
      const s = await import("@/features/subscription/__fixtures__/subscriptions");
      return { list: s.subscriptionsPage(), invoices: f.INVOICES };
    }
  }
  // Both are decoration around the cards: whichever fails leaves its own block empty.
  const [list, invoices] = await Promise.all([
    fetchAllPayerSubscriptions(signal).catch(() => null),
    fetchPayerInvoices({ signal, perPage: 10 })
      .then((r) => r.invoices)
      .catch(() => [] as InvoiceRow[]),
  ]);
  return { list, invoices };
}

export function useBillingPage({
  addedId = null,
  fixture,
}: UseBillingPageArgs = {}): UseBillingPageResult {
  const router = useRouter();
  const [status, setStatus] = useState<BillingStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<PayerPaymentMethods | null>(null);
  const [list, setList] = useState<PayerAccount | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState<CardPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addedDismissed, setAddedDismissed] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [cards, rest] = await Promise.all([
          loadWallet(fixture),
          loadRest(fixture, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setWallet(cards);
        setList(rest.list);
        setInvoices(rest.invoices);
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

  const rows = useMemo(() => cardRows(wallet), [wallet]);
  const shown = useMemo(() => visibleCards(rows, expanded), [rows, expanded]);
  const next = useMemo(() => nextBilling(list), [list]);
  const lines = useMemo(() => invoiceLines(invoices), [invoices]);

  // 08-N / 08-S: the card the add screen just saved, until the payer says Done. Derived, so a
  // reload after "Set as default" simply re-reads it from the fresh wallet.
  const added = useMemo((): AddedCard | null => {
    if (!addedId || addedDismissed || !wallet) return null;
    const card = wallet.methods.find((m) => m.id === addedId);
    if (!card) return null;
    return { card, isDefault: card.id === wallet.default_id || card.is_default };
  }, [addedId, addedDismissed, wallet]);

  const reload = useCallback(() => {
    setStatus("loading");
    setGeneration((g) => g + 1);
  }, []);

  const toggleExpanded = useCallback(() => setExpanded((e) => !e), []);
  const dismissPrompt = useCallback(() => setPrompt(null), []);
  const dismissAdded = useCallback(() => setAddedDismissed(true), []);
  const addCard = useCallback(() => router.push(BILLING.add), [router]);
  const back = useCallback(() => router.push(PORTAL.index), [router]);

  const setDefault = useCallback(
    async (row: CardRow) => {
      if (busy) return;
      setBusy(true);
      setActionError(null);
      try {
        setWallet(await setDefaultPaymentMethod(row.card.id));
      } catch (err) {
        setActionError(sentence(err, CARD_ACTION_FAILED));
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const onMenu = useCallback(
    (row: CardRow, item: CardMenuItem) => {
      setActionError(null);
      if (item === "edit") {
        router.push(BILLING.edit(row.card.id));
        return;
      }
      if (item === "set_default") {
        void setDefault(row);
        return;
      }
      // The card everything is charged to cannot go until another one takes its place (08-R).
      setPrompt({ kind: row.isDefault ? "remove_default" : "remove", row });
    },
    [router, setDefault],
  );

  const confirmRemove = useCallback(async () => {
    if (!prompt || prompt.kind !== "remove" || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      setWallet(await removePaymentMethod(prompt.row.card.id));
      setPrompt(null);
    } catch (err) {
      // The server's own refusal is shown as written - it knows what the card is still holding.
      setActionError(sentence(err, CARD_ACTION_FAILED));
    } finally {
      setBusy(false);
    }
  }, [prompt, busy]);

  const makeAddedDefault = useCallback(async () => {
    if (!added || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      setWallet(await setDefaultPaymentMethod(added.card.id));
    } catch (err) {
      setActionError(sentence(err, CARD_ACTION_FAILED));
    } finally {
      setBusy(false);
    }
  }, [added, busy]);

  return {
    status,
    error,
    next,
    rows,
    shown,
    expanded,
    toggleExpanded,
    showMore: showMoreLabel(rows),
    expired: expiredNotice(rows),
    menuFor: cardMenu,
    onMenu,
    prompt,
    dismissPrompt,
    confirmRemove,
    added,
    makeAddedDefault,
    dismissAdded,
    busy,
    actionError,
    invoices: lines,
    invoiceHeader: amountHeader(invoices),
    addCard,
    back,
    reload,
  };
}
