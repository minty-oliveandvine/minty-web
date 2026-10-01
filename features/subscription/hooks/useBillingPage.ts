"use client";

/**
 * The billing page (Figma 08-B and every state the design draws for it) - ONE billing account's
 * profile: who the bill goes to (its name, address and billing email), the cards on it, and its
 * invoices. The screen calls this and renders what it returns.
 *
 * WHICH ACCOUNT is the URL's: `?account=` (from 08-A), or `?entity=` - "the account this company
 * is on", which is what the list's payment-failed banner knows - else the payer's oldest.
 *
 * TWO READS, AND A FAILURE IN THE SECOND DOES NOT TAKE THE PAGE DOWN: the accounts
 * (`/api/me/billing/accounts`) are the page's subject, so their failure is the page's; the
 * account's invoices (`/api/me/invoices?account=`) fill the table, and failing leaves it quiet.
 * They are read apart, so turning a page of the table - 10, 50 or 100 invoices to a page, the
 * payer's pick - reads that page alone, never the accounts (a Stripe read at the API) again.
 *
 * THE DEFAULT CARD IS THE ONE THIS ACCOUNT CHARGES - every company on it - so the page never
 * lets it be removed (08-R tells the payer why, instead of the server refusing after the row
 * already looks gone), "Set as default" switches what the ACCOUNT charges from its next bill,
 * and after every write the accounts are taken from the answer (or re-read) rather than patched
 * locally, so the page cannot drift from what the server holds.
 *
 * *RETRY PAYMENT* on a declined invoice's row (08-K) collects it now, on the account's card
 * (`POST /api/me/invoices/{id}/retry` - the engine's own manual collection, with its budget and
 * deadline); the API offers it only on the invoice a retry would charge. A decline again is 06·B's
 * dialog, with *Try again now*; every other answer is the API's sentence. Either way the account
 * and its invoices are read again quietly, so a paid retry clears the amber block by itself.
 *
 * AN INVOICE'S TWO DOWNLOADS, one at a time whichever file: *Invoice PDF* saves our own document
 * (`GET /api/me/invoices/{id}/pdf`, Figma 09-A) as `Inv-<reference>.pdf`, and *Download csv* its
 * billing breakdown; each has its own busy row and its own refusal, in the API's words.
 *
 * AND ITS INV# PREVIEW (`preview`): the row's reference opens that same PDF in a dialog, read the
 * same way - VIEW-ONLY, the user's call (2026-09-30): nothing is saved from it, the Invoice PDF
 * column is the download. Not a download, so the one-at-a-time rule does not hold it back; its
 * refusal is the API's sentence, in the dialog. Only the latest request may answer - closing the
 * preview, or opening another row's, drops whatever was still on its way.
 *
 * Landings: *+ Add payment method* → 08-Y for this account, which comes back with `?added=` so
 * this page can say what happened (08-N when it is not the default, 08-S when it is); *Edit* →
 * 08-D; *Change billing details* → 08-C; back → 08-A showing this account. A payer with no
 * account at all opens one here, in onboarding's sheet (`opening`), and lands on its page.
 * `fixture`: dev-only, `?fixture=B|H|I|J|N`.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "@/lib/apiClient";

import {
  fetchBillingAccounts,
  fetchInvoiceBreakdown,
  fetchInvoicePdf,
  fetchPayerInvoices,
  removePaymentMethod,
  retryInvoice as requestRetry,
  setAccountDefaultCard,
  type BillingAccount,
  type BillingAccounts,
  type InvoiceBreakdown,
  type InvoiceRow,
  type RetryOutcome,
  type SavedPaymentMethod,
} from "@/features/subscription/api/payerPortal";
import type { OpenedAccount } from "@/features/subscription/hooks/useCardForm";
import {
  BILLING_LOAD_FAILED,
  CARD_ACTION_FAILED,
  INVOICE_PDF_FAILED,
  RETRY_FAILED,
  amountHeader,
  cardMenu,
  cardRows,
  expiredNotice,
  invoiceLines,
  invoicePdfFilename,
  showMoreLabel,
  visibleCards,
  type CardMenuItem,
  type CardRow,
  type InvoiceLine,
  type InvoicePageSize,
  type NextBilling,
} from "@/features/subscription/lib/billing";
import {
  accountBilling,
  accountWallet,
  pickAccount,
} from "@/features/subscription/lib/billingAccounts";
import {
  BREAKDOWN_FAILED,
  breakdownCsv,
  breakdownFilename,
} from "@/features/subscription/lib/breakdown";
import { saveBlob, saveTextFile } from "@/features/subscription/lib/download";
import { BILLING, overviewPath } from "@/features/subscription/lib/paths";

export type BillingStatus = "loading" | "ready" | "error";

/** What the page is asking about, when it is asking (08-R, or a removal being confirmed). */
export type CardPrompt = { kind: "remove" | "remove_default"; row: CardRow };

/** 08-N / 08-S: the card that just came back from the Stripe form. */
export type AddedCard = { card: SavedPaymentMethod; isDefault: boolean };

/**
 * The Inv# preview: which invoice, and its PDF's bytes once they are here - for the dialog to
 * draw, never to save. `error` is the API's sentence when it refused.
 */
export type InvoicePreview = {
  invoiceId: string;
  reference: string;
  status: "loading" | "ready" | "error";
  bytes: Uint8Array | null;
  error: string | null;
};

export type UseBillingPageArgs = {
  /** `?account=` - the billing account this page is the profile of. */
  accountId?: string | null;
  /** `?entity=` - "the account this company is on", when no account is named. */
  entity?: string | null;
  /** `?added=<pm>` - the card the add-card screen just saved. */
  addedId?: string | null;
  fixture?: string | null;
};

export type UseBillingPageResult = {
  status: BillingStatus;
  error: string | null;
  /** The account on show; null when the payer has none. */
  account: BillingAccount | null;
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
  /** The table's paging: the page on show, how many there are, and how many rows to a page. */
  invoicePaging: InvoicePaging;
  goToInvoicePage: (page: number) => void;
  setInvoicesPerPage: (perPage: InvoicePageSize) => void;
  /** "Invoice PDF": the invoice as our own document, saved as `Inv-<reference>.pdf`. */
  downloadInvoicePdf: (invoiceId: string) => Promise<void>;
  /** The invoice whose PDF is being prepared, while it is. */
  pdfBusy: string | null;
  pdfError: string | null;
  /** The Inv# preview on show, when one is: the invoice's PDF, drawn - view-only, never saved. */
  preview: InvoicePreview | null;
  /** The Inv#: the invoice's PDF, read for the preview (the latest request is the one shown). */
  previewInvoice: (invoiceId: string) => Promise<void>;
  closePreview: () => void;
  /** "Billing Breakdown · Download csv": one invoice, company by company, saved as a CSV. */
  downloadBreakdown: (invoiceId: string) => Promise<void>;
  /** The invoice whose breakdown is being prepared, while it is. */
  breakdownBusy: string | null;
  breakdownError: string | null;
  /** *Retry payment* on a failed invoice's row: collect it now, on the account's card. */
  retryInvoice: (invoiceId: string) => Promise<void>;
  /** The invoice being retried, while it is - one at a time. */
  retrying: string | null;
  /** What the last retry said, when it was not a decline (the decline is the dialog). */
  retryNotice: RetryNotice | null;
  /** 06·B's "Payment could not be processed" is up: the card declined again. */
  declined: boolean;
  /** "Try again now" on that dialog: the same invoice, retried again. */
  tryAgain: () => void;
  closeDeclined: () => void;
  addCard: () => void;
  changeDetails: () => void;
  /** The sheet that opens a billing account is up (a payer with none). */
  opening: boolean;
  openAccount: () => void;
  closeOpening: () => void;
  /** Done on the sheet's success card: this page becomes the new account's. */
  accountOpened: (opened: OpenedAccount) => void;
  /** The accounts, for the picker the top cards open (08-A's sheet, reused here). */
  accounts: BillingAccounts | null;
  /** The picker the top cards open: which account's page to show (08-A's own sheet). */
  picking: boolean;
  openPicker: () => void;
  closePicker: () => void;
  confirmPick: (accountId: string) => void;
  back: () => void;
  reload: () => void;
};

/** A retry's outcome under the table, in the API's words: paid, or why it did not happen. */
export type RetryNotice = { tone: "ok" | "error"; text: string };

export type InvoicePaging = {
  page: number;
  pages: number;
  total: number;
  perPage: InvoicePageSize;
  /** The page asked for is still on its way (the rows shown, if any, are the last page's). */
  loading: boolean;
};

/** One page of an account's invoices - which page it answered, and where it sits. */
type InvoicePage = {
  accountId: string;
  page: number;
  perPage: number;
  rows: InvoiceRow[];
  total: number;
  pages: number;
};

/** One of an invoice's downloads, as the page tells it: the row it is preparing, and why not. */
type DownloadState = {
  setBusy: (invoiceId: string | null) => void;
  setError: (error: string | null) => void;
  /** Said when the API gave no sentence of its own (the network failed, say). */
  fallback: string;
};

function sentence(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

async function loadAccounts(fixture: string | null | undefined): Promise<BillingAccounts> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/billing");
    if (f.isBillingFixture(fixture)) return f.accountsFor(f.BILLING_FIXTURES[fixture]);
  }
  return fetchBillingAccounts();
}

async function loadBreakdown(
  fixture: string | null | undefined,
  invoiceId: string,
): Promise<InvoiceBreakdown> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/billing");
    if (f.isBillingFixture(fixture)) return f.BREAKDOWN;
  }
  return fetchInvoiceBreakdown(invoiceId);
}

async function loadInvoicePdf(
  fixture: string | null | undefined,
  invoiceId: string,
): Promise<Blob> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/billing");
    if (f.isBillingFixture(fixture)) return new Blob([f.INVOICE_PDF], { type: "application/pdf" });
  }
  return fetchInvoicePdf(invoiceId);
}

async function sendRetry(
  fixture: string | null | undefined,
  invoiceId: string,
): Promise<RetryOutcome> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/billing");
    if (f.isBillingFixture(fixture)) return f.RETRY_DECLINED;
  }
  return requestRetry(invoiceId);
}

async function loadInvoices(
  fixture: string | null | undefined,
  accountId: string,
  page: number,
  perPage: number,
  signal: AbortSignal,
): Promise<InvoicePage> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/billing");
    if (f.isBillingFixture(fixture)) {
      const rows = f.FIXTURE_INVOICES;
      return {
        accountId,
        page,
        perPage,
        rows: rows.slice((page - 1) * perPage, page * perPage),
        total: rows.length,
        pages: Math.max(1, Math.ceil(rows.length / perPage)),
      };
    }
  }
  // Decoration around the account: a failure leaves the table empty, never the page.
  return fetchPayerInvoices({ signal, accountId, page, perPage })
    .then((r) => ({ accountId, page, perPage, rows: r.invoices, total: r.total, pages: r.pages }))
    .catch(() => ({ accountId, page, perPage, rows: [], total: 0, pages: 1 }));
}

export function useBillingPage({
  accountId = null,
  entity = null,
  addedId = null,
  fixture,
}: UseBillingPageArgs = {}): UseBillingPageResult {
  const router = useRouter();
  const [status, setStatus] = useState<BillingStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BillingAccounts | null>(null);
  const [invoicePage, setInvoicePage] = useState<InvoicePage | null>(null);
  // The page asked for, and for WHICH account - another account starts on its first page.
  const [paging, setPaging] = useState<{ accountId: string | null; page: number }>({
    accountId: null,
    page: 1,
  });
  const [perPage, setPerPage] = useState<InvoicePageSize>(10);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [preview, setPreview] = useState<InvoicePreview | null>(null);
  // Bumped by every preview opened or closed: an answer for an older one is too late.
  const previewRequest = useRef(0);
  const [breakdownBusy, setBreakdownBusy] = useState<string | null>(null);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [retryNotice, setRetryNotice] = useState<RetryNotice | null>(null);
  const [declinedId, setDeclinedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [prompt, setPrompt] = useState<CardPrompt | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [addedDismissed, setAddedDismissed] = useState(false);
  const [opening, setOpening] = useState(false);
  const [picking, setPicking] = useState(false);
  const [generation, setGeneration] = useState(0);

  // The page's subject: the accounts. Which one is shown is derived from the URL below, so
  // switching accounts re-reads nothing but that account's invoices.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const loaded = await loadAccounts(fixture);
        if (controller.signal.aborted) return;
        setData(loaded);
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

  const account = useMemo(
    () => pickAccount(data, { id: accountId, entity }),
    [data, accountId, entity],
  );
  const shownId = account?.id ?? null;
  const page = paging.accountId === shownId ? paging.page : 1;

  // The account's invoices, one page at a time.
  useEffect(() => {
    if (!shownId) return;
    const controller = new AbortController();
    (async () => {
      const got = await loadInvoices(fixture, shownId, page, perPage, controller.signal);
      if (!controller.signal.aborted) setInvoicePage(got);
    })();
    return () => controller.abort();
  }, [fixture, shownId, page, perPage, generation]);

  // Another account's page (or none yet) shows no rows rather than the last account's; the
  // same account's last page stays up while the next one arrives.
  const current = invoicePage && invoicePage.accountId === shownId ? invoicePage : null;
  const invoices = useMemo(() => current?.rows ?? [], [current]);
  const invoicePaging = useMemo(
    (): InvoicePaging => ({
      page,
      pages: current?.pages ?? 1,
      total: current?.total ?? 0,
      perPage,
      loading:
        shownId !== null && (!current || current.page !== page || current.perPage !== perPage),
    }),
    [current, shownId, page, perPage],
  );

  const rows = useMemo(() => cardRows(accountWallet(account)), [account]);
  const shown = useMemo(() => visibleCards(rows, expanded), [rows, expanded]);
  const next = useMemo(() => accountBilling(data, account), [data, account]);
  const lines = useMemo(() => invoiceLines(invoices), [invoices]);

  // 08-N / 08-S: the card the add screen just saved ON THIS ACCOUNT, until the payer says
  // Done. Derived, so "Set as default" simply re-reads it from the fresh accounts.
  const added = useMemo((): AddedCard | null => {
    if (!addedId || addedDismissed || !account) return null;
    const card = account.cards.find((c) => c.id === addedId);
    if (!card) return null;
    return { card, isDefault: card.id === account.default_id };
  }, [addedId, addedDismissed, account]);

  const reload = useCallback(() => {
    setStatus("loading");
    setGeneration((g) => g + 1);
  }, []);

  const toggleExpanded = useCallback(() => setExpanded((e) => !e), []);
  const goToInvoicePage = useCallback(
    (to: number) => {
      const pages = invoicePaging.pages;
      setPaging({ accountId: shownId, page: Math.min(Math.max(1, to), pages) });
    },
    [shownId, invoicePaging.pages],
  );
  // An invoice's two downloads, ONE at a time whichever file: the row being prepared says so, a
  // second click waits for it, and a refusal is the API's sentence under the table.
  const downloading = pdfBusy !== null || breakdownBusy !== null;
  const download = useCallback(
    async (invoiceId: string, state: DownloadState, save: () => Promise<void>) => {
      if (downloading) return;
      state.setBusy(invoiceId);
      state.setError(null);
      try {
        await save();
      } catch (err) {
        state.setError(sentence(err, state.fallback));
      } finally {
        state.setBusy(null);
      }
    },
    [downloading],
  );
  const downloadInvoicePdf = useCallback(
    (invoiceId: string) => {
      // Named here, after the row's reference (its id, should the row be gone): the API names
      // the file too, but CORS keeps its Content-Disposition from the page.
      const reference = invoices.find((inv) => inv.id === invoiceId)?.reference ?? invoiceId;
      return download(
        invoiceId,
        { setBusy: setPdfBusy, setError: setPdfError, fallback: INVOICE_PDF_FAILED },
        async () =>
          saveBlob(invoicePdfFilename(reference), await loadInvoicePdf(fixture, invoiceId)),
      );
    },
    [download, fixture, invoices],
  );
  // The Inv# preview: that same PDF read into memory for the dialog to draw - nothing is saved.
  // Each request takes a number; an answer whose number is no longer the latest (the preview was
  // closed, or another row's opened) is dropped rather than shown over the wrong invoice.
  const previewInvoice = useCallback(
    async (invoiceId: string) => {
      const request = ++previewRequest.current;
      // The dialog's title is the row's reference (its id, should the row be gone).
      const reference = invoices.find((inv) => inv.id === invoiceId)?.reference ?? invoiceId;
      setPreview({ invoiceId, reference, status: "loading", bytes: null, error: null });
      try {
        const pdf = await loadInvoicePdf(fixture, invoiceId);
        const bytes = new Uint8Array(await pdf.arrayBuffer());
        if (request !== previewRequest.current) return;
        setPreview({ invoiceId, reference, status: "ready", bytes, error: null });
      } catch (err) {
        if (request !== previewRequest.current) return;
        setPreview({
          invoiceId,
          reference,
          status: "error",
          bytes: null,
          error: sentence(err, INVOICE_PDF_FAILED),
        });
      }
    },
    [fixture, invoices],
  );
  const closePreview = useCallback(() => {
    previewRequest.current += 1;
    setPreview(null);
  }, []);
  const downloadBreakdown = useCallback(
    (invoiceId: string) =>
      download(
        invoiceId,
        { setBusy: setBreakdownBusy, setError: setBreakdownError, fallback: BREAKDOWN_FAILED },
        async () => {
          const breakdown = await loadBreakdown(fixture, invoiceId);
          saveTextFile(breakdownFilename(breakdown.invoice.reference), breakdownCsv(breakdown));
        },
      ),
    [download, fixture],
  );
  // *Retry payment*: the engine collects this invoice on its account's card - or says why not.
  // A decline is 06·B's dialog (with Try again); every other answer is the API's sentence under
  // the table. Whatever happened, the account and its invoices are read again QUIETLY (no
  // loading state): a paid retry clears the amber block and turns the row into a paid one.
  const retryInvoice = useCallback(
    async (invoiceId: string) => {
      if (retrying) return;
      setRetrying(invoiceId);
      setRetryNotice(null);
      try {
        const outcome = await sendRetry(fixture, invoiceId);
        if (outcome.status === "failed") setDeclinedId(invoiceId);
        else setDeclinedId(null);
        setRetryNotice({ tone: outcome.ok ? "ok" : "error", text: outcome.message });
      } catch (err) {
        setRetryNotice({ tone: "error", text: sentence(err, RETRY_FAILED) });
      } finally {
        setRetrying(null);
        setGeneration((g) => g + 1);
      }
    },
    [retrying, fixture],
  );
  const tryAgain = useCallback(() => {
    if (declinedId) void retryInvoice(declinedId);
  }, [declinedId, retryInvoice]);
  const closeDeclined = useCallback(() => setDeclinedId(null), []);
  // A new page size starts at the first page: "page 3 of 50 rows" is not page 3 of 10.
  const setInvoicesPerPage = useCallback(
    (size: InvoicePageSize) => {
      setPerPage(size);
      setPaging({ accountId: shownId, page: 1 });
    },
    [shownId],
  );
  const dismissPrompt = useCallback(() => setPrompt(null), []);
  const dismissAdded = useCallback(() => setAddedDismissed(true), []);
  // A card goes ON this account (08-Y). With no account to put it on, the only way to add a card
  // is to open one - the sheet - never a card saved to nothing.
  const addCard = useCallback(() => {
    if (account) router.push(BILLING.add(account.id));
    else setOpening(true);
  }, [router, account]);
  const changeDetails = useCallback(() => {
    if (account) router.push(BILLING.details(account.id));
  }, [router, account]);
  const openAccount = useCallback(() => setOpening(true), []);
  const closeOpening = useCallback(() => setOpening(false), []);
  const accountOpened = useCallback(
    (opened: OpenedAccount) => {
      setOpening(false);
      setPicking(false);
      if (opened.accounts) setData(opened.accounts);
      // The page is the account's now: its URL names it, which reads its invoices too. Without an
      // id to name, read everything again.
      if (opened.accountId) router.replace(BILLING.account({ id: opened.accountId }));
      else reload();
    },
    [router, reload],
  );
  const confirmPick = useCallback(
    (id: string) => {
      setPicking(false);
      router.replace(BILLING.account({ id }), { scroll: false });
    },
    [router],
  );
  const back = useCallback(() => router.push(overviewPath(account?.id ?? null)), [router, account]);

  /** Switch the card THIS account charges - from its next bill, for every company on it. */
  const chargeCard = useCallback(
    async (cardId: string) => {
      if (!account || busy) return;
      setBusy(true);
      setActionError(null);
      try {
        setData(await setAccountDefaultCard(account.id, cardId));
      } catch (err) {
        setActionError(sentence(err, CARD_ACTION_FAILED));
      } finally {
        setBusy(false);
      }
    },
    [account, busy],
  );

  const onMenu = useCallback(
    (row: CardRow, item: CardMenuItem) => {
      setActionError(null);
      if (item === "edit") {
        router.push(BILLING.edit(row.card.id, account?.id ?? null));
        return;
      }
      if (item === "set_default") {
        void chargeCard(row.card.id);
        return;
      }
      // The card the account charges cannot go until another one takes its place (08-R).
      setPrompt({ kind: row.isDefault ? "remove_default" : "remove", row });
    },
    [router, account, chargeCard],
  );

  const confirmRemove = useCallback(async () => {
    if (!prompt || prompt.kind !== "remove" || busy || !account) return;
    setBusy(true);
    setActionError(null);
    try {
      await removePaymentMethod(prompt.row.card.id, account.id);
      // The removal answers the flat wallet, not the accounts: read them again.
      setData(await fetchBillingAccounts());
      setPrompt(null);
    } catch (err) {
      // The server's own refusal is shown as written - it knows what the card is still holding.
      setActionError(sentence(err, CARD_ACTION_FAILED));
    } finally {
      setBusy(false);
    }
  }, [prompt, busy, account]);

  const makeAddedDefault = useCallback(async () => {
    if (added) await chargeCard(added.card.id);
  }, [added, chargeCard]);

  return {
    status,
    error,
    account,
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
    invoicePaging,
    goToInvoicePage,
    setInvoicesPerPage,
    downloadInvoicePdf,
    pdfBusy,
    pdfError,
    preview,
    previewInvoice,
    closePreview,
    downloadBreakdown,
    breakdownBusy,
    breakdownError,
    retryInvoice,
    retrying,
    retryNotice,
    declined: declinedId !== null,
    tryAgain,
    closeDeclined,
    addCard,
    changeDetails,
    opening,
    openAccount,
    closeOpening,
    accountOpened,
    accounts: data,
    picking,
    openPicker: useCallback(() => setPicking(true), []),
    closePicker: useCallback(() => setPicking(false), []),
    confirmPick,
    back,
    reload,
  };
}
