"use client";

/**
 * The billing page, drawn (Figma 08-B and its states) - ONE billing account's profile: the
 * "Next billing" block - the account's name, address and billing email with the way to change
 * them (08-C), and when it next bills, amber with "Due Immediately" when a payment on it has
 * failed (08-K); its cards, the one it charges pinned first with its chip, each with the
 * "Update card" menu (08-W/08-X) - red on the card to fix: expired, or the one charged when a
 * payment failed - "Show more (6)" for the rest (08-J), "No card saved" when there are none
 * (08-H) and the red line when the card being charged has expired (08-I); and its invoices,
 * each previewed from its Inv# (view-only), downloading as our own PDF and giving its billing
 * breakdown - company by company - as a CSV, 10 / 50 / 100 to a page; a declined one red,
 * "Failed 26 Jul" where it would have been paid, with *Retry payment* on the one a retry would
 * charge (08-K). Everything shown is the hook's (`useBillingPage`).
 */

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { fromControl } from "@/features/subscription/components/SubscriptionSummaryRow";
import {
  CHOOSE_ACCOUNT,
  NO_ACCOUNT_BODY,
  NO_ACCOUNT_TITLE,
  OPEN_BILLING_ACCOUNT,
} from "@/features/subscription/lib/billingAccounts";
import {
  BILLING_BREAKDOWN,
  DOWNLOAD_CSV,
  PREPARING_CSV,
} from "@/features/subscription/lib/breakdown";
import {
  ADD_A_PAYMENT_METHOD,
  ADD_PAYMENT_METHOD,
  AMOUNT,
  BILL_TO,
  CHANGE_BILLING_DETAILS,
  DUE_IMMEDIATELY,
  ESTIMATED,
  INVOICE_HISTORY,
  INVOICE_PAGE_SIZES,
  LOADING_INVOICES,
  NEXT_BILLING,
  NEXT_BILL_DATE,
  NO_CARD,
  NO_CARD_BODY,
  NO_INVOICES,
  PAYMENT_FAILED,
  PAYMENT_METHODS,
  RETRY_PAYMENT,
  RETRYING,
  UPDATE_CARD,
  cardNeedsUpdate,
  invoiceRange,
  isInvoicePageSize,
  type CardMenuItem,
  type CardRow,
  type InvoiceLine,
  type InvoicePageSize,
  type NextBilling,
} from "@/features/subscription/lib/billing";

const MENU_LABEL: Record<CardMenuItem, string> = {
  set_default: "Set as default",
  edit: "Edit",
  delete: "Delete",
};

const CHIP: Record<CardRow["chip"], string> = {
  default: "bg-warning-bg text-warning",
  saved: "bg-neutral-bg text-neutral",
  expired: "bg-danger-bg text-danger",
};

const CHIP_LABEL: Record<CardRow["chip"], string> = {
  default: "Default",
  saved: "Saved",
  expired: "Expired",
};

/** An email that breaks after its "@" when it must, never mid-word ("…vinehk.co" / "m"). */
function BreakableEmail({ address }: { address: string }) {
  const at = address.indexOf("@");
  if (at <= 0) return <>{address}</>;
  return (
    <>
      {address.slice(0, at + 1)}
      <wbr />
      {address.slice(at + 1)}
    </>
  );
}

/**
 * The portal's cats are drawn from files with transparent canvas around the artwork - the clock
 * cat is a 477x400 PNG whose cat fills only its top-left 310x306 - and drawn whole they sit small
 * and off to one side of their box. This draws the ARTWORK at `width` and clips the rest, the way
 * the design's frame crops it: the file is used as it is, only positioned.
 */
const CATS = {
  clock: { src: "/portal/minty-clock.png", file: [477, 400], art: [5, 86, 319, 396] },
  thinking: { src: "/portal/minty-thinking.png", file: [235, 276], art: [35, 9, 217, 265] },
} as const;

function CatArt({ cat, width, className = "" }: { cat: keyof typeof CATS; width: number; className?: string }) {
  const { src, file, art } = CATS[cat];
  const [left, top, right, bottom] = art;
  const scale = width / (right - left);
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden ${className}`}
      style={{ width, height: Math.round((bottom - top) * scale) }}
    >
      <Image
        src={src}
        alt=""
        width={file[0]}
        height={file[1]}
        unoptimized
        className="absolute max-w-none"
        style={{ width: file[0] * scale, left: -left * scale, top: -top * scale }}
      />
    </div>
  );
}

/**
 * 08-B's first block: who Minty bills - the account's name, its address (the charged card's)
 * and its billing email - and when it next will. "Change billing details" is 08-C.
 *
 * The top card of 08-B, so it opens the same billing-account picker 08-A's card does (`onPick`):
 * clicking anywhere on it that is not one of its own controls (`fromControl`), with a sr-only
 * keyboard button doing the same, out of sight until focused.
 */
export function NextBillingCard({
  next,
  onChangeDetails,
  onPick,
}: {
  next: NextBilling;
  onChangeDetails?: () => void;
  onPick: () => void;
}) {
  return (
    <section
      aria-label={NEXT_BILLING}
      data-state={next.failed ? "failed" : "ok"}
      onClick={(e) => {
        if (!fromControl(e)) onPick();
      }}
      // THREE COLUMNS from a tablet up, as the design draws them: "Bill to", the date and the
      // amount, and Minty - the cat is a column of its own, not an ornament. The date and amount
      // stay beside "Bill to" however long the name, address or email (it was once a wrapping
      // row, and a long billing email pushed them under it). "Bill to" takes everything the
      // other two leave, with the gaps kept tight to give it room; what still does not fit
      // WRAPS rather than clipping - an email after its "@". Only a phone stacks them, and
      // drops the cat.
      className={`grid cursor-pointer grid-cols-1 gap-x-6 gap-y-5 rounded-xl px-8 py-7 sm:grid-cols-[minmax(0,1fr)_auto_auto] ${
        next.failed ? "bg-warning-bg" : "bg-selected"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 sm:col-span-2">
        <h2 className="text-title-m font-bold text-ink">{NEXT_BILLING}</h2>
        {/* What a click on the card does, for the keyboard - shown only while focused. */}
        <button
          type="button"
          onClick={onPick}
          aria-haspopup="dialog"
          className="sr-only shrink-0 rounded-xl text-body-s font-semibold text-link underline underline-offset-4 focus-visible:not-sr-only focus-visible:px-2 focus-visible:py-1"
        >
          {CHOOSE_ACCOUNT}
        </button>
      </div>
      <div className="min-w-0 [overflow-wrap:anywhere] sm:col-start-1 sm:row-start-2">
        <p className="text-title-m font-bold text-ink">{BILL_TO}</p>
        <p className="mt-2 text-title-m font-semibold text-ink">{next.billTo || "—"}</p>
        {next.addressLines.length > 0 && (
          <address className="mt-3 text-body-l not-italic leading-snug text-ink-muted">
            {next.addressLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        )}
        {next.email && (
          <p className="mt-3 text-body-l text-ink-muted">
            <BreakableEmail address={next.email} />
          </p>
        )}
        {onChangeDetails && (
          <button
            type="button"
            onClick={onChangeDetails}
            className="mt-5 text-body-m text-ink underline underline-offset-4 hover:text-link"
          >
            {CHANGE_BILLING_DETAILS}
          </button>
        )}
      </div>
      <div className="sm:col-start-2 sm:row-start-2">
        {/* The design's two rows: the labels in a column, their values right-aligned beside
            them, and the amount set large in the price teal with "(estimated)" under it -
            the API prices it with the renewal runner itself, but a trial that lapses or a
            module cancelled before the date changes the bill. */}
        <dl className="grid grid-cols-[auto_auto] items-baseline gap-x-6 gap-y-6">
          <dt className="text-title-m font-bold text-ink">{NEXT_BILL_DATE}</dt>
          <dd className="text-right text-title-m font-semibold text-ink">{next.date ?? "—"}</dd>
          <dt className="text-title-m font-bold text-ink">{AMOUNT}</dt>
          <dd className="text-right">
            <span className="block text-[28px] font-bold leading-none tabular-nums text-link">
              {next.amount ?? "—"}
            </span>
            {next.amount && (
              <span className="mt-1.5 block text-body-s text-ink-muted">{ESTIMATED}</span>
            )}
          </dd>
        </dl>
        {/* Which companies failed is the overview's line (08-A); here the block only
            says that the account owes something now. */}
        {next.failed && (
          <div className="mt-4 flex flex-col items-start gap-3">
            <p className="text-title-m font-semibold text-danger">{DUE_IMMEDIATELY}</p>
            <span className="rounded-lg bg-danger-bg px-5 py-2 text-body-m font-semibold text-danger">
              {PAYMENT_FAILED}
            </span>
          </div>
        )}
      </div>
      {/* The third column: the whole block's height, centred, against the right edge. */}
      <CatArt
        cat={next.failed ? "thinking" : "clock"}
        width={next.failed ? 124 : 172}
        className="hidden self-center justify-self-end sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:block"
      />
    </section>
  );
}

/** 08-I: the card everything is charged to has already expired. */
export function ExpiredCardNotice({ text, onAdd }: { text: string; onAdd: () => void }) {
  return (
    <p
      role="alert"
      className="mx-auto flex w-fit items-center gap-3 rounded-xl border border-danger bg-danger-bg px-6 py-3.5 text-body-l text-ink"
    >
      <span aria-hidden className="text-lg text-danger">
        ⚠
      </span>
      {text.replace(/\s*Update your payment method here\.$/, "")}{" "}
      <button type="button" onClick={onAdd} className="font-semibold text-danger underline">
        Update your payment method here.
      </button>
    </p>
  );
}

/** The brand tile beside a card row; the name, since a brand mark is Stripe's to draw. */
function BrandTile({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      className={`flex h-[62px] w-[92px] shrink-0 items-center justify-center rounded-xl border border-line bg-card text-center font-black italic text-[#1a1f71] ${
        label.length > 5 ? "text-body-s" : "text-xl"
      }`}
    >
      {label}
    </span>
  );
}

/** 08-W / 08-X: what "Update card" opens - the items this row actually has. */
function CardMenu({
  row,
  items,
  attention,
  onSelect,
}: {
  row: CardRow;
  items: CardMenuItem[];
  /** Red: the card the payer has to fix (`cardNeedsUpdate`) - expired, or charged and failing. */
  attention: boolean;
  onSelect: (item: CardMenuItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPress = (e: MouseEvent | TouchEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPress);
    document.addEventListener("touchstart", onPress);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPress);
      document.removeEventListener("touchstart", onPress);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${UPDATE_CARD} · ${row.title}`}
        data-attention={attention || undefined}
        className={`h-11 w-[112px] rounded-xl border bg-card text-body-s font-semibold hover:bg-hover ${
          attention
            ? "border-danger text-danger"
            : "border-line text-ink"
        }`}
      >
        {UPDATE_CARD}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-[50px] z-20 w-[164px] overflow-hidden rounded-xl border border-line bg-card py-2 shadow-overlay"
        >
          {items.map((item) => (
            <button
              key={item}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect(item);
              }}
              className={`block min-h-11 w-full px-5 py-2.5 text-left text-body-m hover:bg-hover ${
                item === "delete" ? "text-danger" : "text-ink"
              }`}
            >
              {MENU_LABEL[item]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CardRowView({
  row,
  items,
  attention,
  onSelect,
}: {
  row: CardRow;
  items: CardMenuItem[];
  attention: boolean;
  onSelect: (item: CardMenuItem) => void;
}) {
  return (
    <li className="flex items-center gap-4" data-card={row.card.id} data-chip={row.chip}>
      <BrandTile label={row.card.brand_label || "Card"} />
      <div className="flex flex-1 items-center gap-6 rounded-xl border border-line bg-card px-7 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-body-s text-ink-muted">Payment Method</p>
          <p className="truncate text-body-m font-bold text-ink">{row.title}</p>
        </div>
        <div className="hidden min-w-[110px] sm:block">
          <p className="text-body-s text-ink-muted">Expiry date</p>
          <p
            className={`text-body-m font-bold ${
              row.chip === "expired" ? "text-danger" : "text-ink"
            }`}
          >
            {row.expiry ?? "—"}
          </p>
        </div>
        <span
          data-chip-label
          className={`hidden shrink-0 rounded-lg px-4 py-1.5 text-body-s font-semibold sm:inline ${CHIP[row.chip]}`}
        >
          {CHIP_LABEL[row.chip]}
        </span>
        <CardMenu row={row} items={items} attention={attention} onSelect={onSelect} />
      </div>
    </li>
  );
}

/**
 * A payer with no billing account at all - nothing has ever been billed or put on a card. The
 * page has no account to be the profile of, so it offers to open one.
 */
export function NoAccountPanel({ onOpen }: { onOpen: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-10 text-center"
    >
      <p className="text-title-m font-bold text-ink">{NO_ACCOUNT_TITLE}</p>
      <p className="max-w-[520px] text-body-l text-ink-muted">{NO_ACCOUNT_BODY}</p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-2 h-11 w-[220px] rounded-xl bg-action text-body-m font-semibold text-white hover:bg-action-hover active:bg-action-pressed"
      >
        {OPEN_BILLING_ACCOUNT}
      </button>
    </div>
  );
}

/** 08-H: an account with no card on it. Trials keep running; nothing can be charged. */
export function NoCardPanel({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-10 text-center"
    >
      <p className="text-title-m font-bold text-ink">{NO_CARD}</p>
      <p className="max-w-[520px] text-body-l text-ink-muted">{NO_CARD_BODY}</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 h-11 w-[220px] rounded-xl bg-action text-body-m font-semibold text-white hover:bg-action-hover active:bg-action-pressed"
      >
        {ADD_A_PAYMENT_METHOD}
      </button>
    </div>
  );
}

/**
 * 08-B's second block: this account's cards. Also a top card of the page, so it opens the same
 * billing-account picker as `NextBillingCard` does (`onPick`) - anywhere on it that is not one
 * of its own controls (`fromControl`: "Add a payment method", a card's "Update card" menu).
 */
export function PaymentMethodsPanel({
  rows,
  shown,
  expanded,
  showMore,
  busy,
  actionError,
  menuFor,
  onMenu,
  onToggle,
  onAdd,
  onPick,
  accountFailed = false,
}: {
  rows: CardRow[];
  shown: CardRow[];
  expanded: boolean;
  showMore: string | null;
  busy: boolean;
  actionError: string | null;
  menuFor: (row: CardRow) => CardMenuItem[];
  onMenu: (row: CardRow, item: CardMenuItem) => void;
  onToggle: () => void;
  onAdd: () => void;
  onPick: () => void;
  /** This account's payment failed (08-K): the card it charges is the one to fix. */
  accountFailed?: boolean;
}) {
  return (
    <section
      aria-label={PAYMENT_METHODS}
      aria-busy={busy}
      onClick={(e) => {
        if (!fromControl(e)) onPick();
      }}
      className="flex cursor-pointer flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-body-l font-bold text-ink">{PAYMENT_METHODS}</h2>
        {/* What a click on the card does, for the keyboard - shown only while focused. */}
        <button
          type="button"
          onClick={onPick}
          aria-haspopup="dialog"
          className="sr-only shrink-0 rounded-xl text-body-s font-semibold text-link underline underline-offset-4 focus-visible:not-sr-only focus-visible:px-2 focus-visible:py-1"
        >
          {CHOOSE_ACCOUNT}
        </button>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={onAdd}
            className="h-11 rounded-xl bg-action px-5 text-body-s font-semibold text-white hover:bg-action-hover active:bg-action-pressed"
          >
            {ADD_PAYMENT_METHOD}
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <NoCardPanel onAdd={onAdd} />
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {shown.map((row) => (
              <CardRowView
                key={row.card.id}
                row={row}
                items={menuFor(row)}
                attention={cardNeedsUpdate(row, accountFailed)}
                onSelect={(item) => onMenu(row, item)}
              />
            ))}
          </ul>
          {showMore && (
            <button
              type="button"
              onClick={onToggle}
              className="self-end text-body-m text-ink-2 hover:underline"
            >
              {expanded ? "Show less" : showMore}
            </button>
          )}
          {expanded && (
            <p className="text-body-s text-ink-muted">
              All {rows.length} saved cards. The default card is the one this account charges.
            </p>
          )}
        </>
      )}
      {actionError && (
        <p role="alert" className="text-body-s text-danger">
          {actionError}
        </p>
      )}
    </section>
  );
}

/**
 * 08-B's invoice history and its two downloads, one at a time whichever file: "Invoice PDF"
 * saves the invoice as our own document (Figma 09-A) - a button, since the file is fetched with
 * the bearer and saved, not linked - with "—" where it has none (never sent, or void); "Billing
 * Breakdown · Download csv" saves it company by company. A refusal is the API's sentence under
 * the table. The Inv# PREVIEWS that same PDF (`onPreview`, `InvoicePreviewDialog`) - to look at,
 * never a download - where there is one, and is plain text where there is not.
 */
export function InvoiceHistoryTable({
  invoices,
  amountHeader,
  paging,
  onPage,
  onPerPage,
  onPdf,
  pdfBusy,
  pdfError,
  onPreview,
  onBreakdown,
  breakdownBusy,
  breakdownError,
  onRetry,
  retrying,
  retryNotice,
}: {
  invoices: InvoiceLine[];
  amountHeader: string;
  paging: {
    page: number;
    pages: number;
    total: number;
    perPage: InvoicePageSize;
    loading: boolean;
  };
  onPage: (page: number) => void;
  onPerPage: (perPage: InvoicePageSize) => void;
  /** "Invoice PDF": the invoice as our own document. */
  onPdf: (invoiceId: string) => void;
  /** The invoice whose PDF is being prepared, while it is. */
  pdfBusy: string | null;
  pdfError: string | null;
  /** The Inv#: the invoice's PDF in a preview - to look at, never saved. */
  onPreview: (invoiceId: string) => void;
  /** "Download csv": one invoice, company by company. */
  onBreakdown: (invoiceId: string) => void;
  /** The invoice whose breakdown is being prepared, while it is. */
  breakdownBusy: string | null;
  breakdownError: string | null;
  /** *Retry payment* on a declined invoice's row: collect it now. */
  onRetry: (invoiceId: string) => void;
  /** The invoice being retried, while it is - one at a time. */
  retrying: string | null;
  /** What the last retry said, in the API's words. */
  retryNotice: { tone: "ok" | "error"; text: string } | null;
}) {
  const perPageId = useId();
  const downloading = pdfBusy !== null || breakdownBusy !== null;
  return (
    <section aria-label={INVOICE_HISTORY} className="flex flex-col gap-3">
      <h2 className="text-body-l font-bold text-ink">{INVOICE_HISTORY}</h2>
      {invoices.length === 0 && paging.loading ? (
        <p role="status" className="text-body-l text-ink-muted">
          {LOADING_INVOICES}
        </p>
      ) : invoices.length === 0 ? (
        <p className="text-body-l text-ink-muted">{NO_INVOICES}</p>
      ) : (
        <table
          aria-busy={paging.loading || undefined}
          className={`w-full border-collapse text-left ${paging.loading ? "opacity-60" : ""}`}
        >
          <thead>
            <tr className="text-body-s font-semibold text-ink">
              <th scope="col" className="pb-2">
                Inv#
              </th>
              <th scope="col" className="pb-2">
                {amountHeader}
              </th>
              <th scope="col" className="pb-2">
                Paid date
              </th>
              {/* The two downloads, centred over their icon and link as the design sets them. */}
              <th scope="col" className="pb-2 text-center">
                Invoice PDF
              </th>
              <th scope="col" className="pb-2 text-center">
                {BILLING_BREAKDOWN}
              </th>
              <th scope="col" className="pb-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="text-body-s text-ink">
            {invoices.map((inv) => (
              // A declined charge is red across the row (08-K); the two downloads keep their own
              // colours - they are actions, not what went wrong.
              <tr
                key={inv.id}
                data-failed={inv.failed || undefined}
                className={`border-b border-line-subtle ${inv.failed ? "text-danger" : ""}`}
              >
                <td className="py-3">
                  {/* The Inv# opens the preview where there is a PDF to show. It keeps the row's
                      colour (a button inherits it), so a declined invoice's stays red. */}
                  {inv.hasPdf ? (
                    <button
                      type="button"
                      onClick={() => onPreview(inv.id)}
                      aria-haspopup="dialog"
                      aria-label={`Preview invoice ${inv.reference}`}
                      className="cursor-pointer underline-offset-2 hover:underline focus-visible:underline"
                    >
                      {inv.reference}
                    </button>
                  ) : (
                    inv.reference
                  )}
                </td>
                <td className="py-3 tabular-nums">{inv.amount}</td>
                <td className="py-3">{inv.paid ?? "—"}</td>
                <td className="py-3 text-center">
                  {inv.hasPdf ? (
                    <button
                      type="button"
                      onClick={() => onPdf(inv.id)}
                      disabled={downloading}
                      aria-busy={pdfBusy === inv.id || undefined}
                      aria-label={`Invoice ${inv.reference} (PDF)`}
                      className="inline-flex cursor-pointer text-ink hover:text-link disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                        <path
                          d="M8 1.5v8m0 0 3-3m-3 3-3-3M2 11.5v1.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-1.5"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ) : (
                    <span className="text-ink-disabled">—</span>
                  )}
                </td>
                <td className="py-3 text-center">
                  <button
                    type="button"
                    onClick={() => onBreakdown(inv.id)}
                    disabled={downloading}
                    aria-busy={breakdownBusy === inv.id || undefined}
                    aria-label={`${DOWNLOAD_CSV}: the billing breakdown of invoice ${inv.reference}`}
                    className="text-body-s text-[#18c4c7] hover:underline hover:underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {breakdownBusy === inv.id ? PREPARING_CSV : DOWNLOAD_CSV}
                  </button>
                </td>
                <td className="py-2 pl-3 text-right">
                  {/* Only on the invoice a retry would charge: an abandoned bill stays red, with
                      no button that could only refuse. */}
                  {inv.retryable && (
                    <button
                      type="button"
                      onClick={() => onRetry(inv.id)}
                      disabled={retrying !== null}
                      aria-busy={retrying === inv.id || undefined}
                      aria-label={`${RETRY_PAYMENT}: invoice ${inv.reference}`}
                      className="h-11 whitespace-nowrap rounded-xl bg-danger-action px-5 text-body-s font-semibold text-white hover:bg-[var(--mv2-action-danger-hover)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {retrying === inv.id ? RETRYING : RETRY_PAYMENT}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pdfError && (
        <p role="alert" className="text-body-s text-danger">
          {pdfError}
        </p>
      )}
      {breakdownError && (
        <p role="alert" className="text-body-s text-danger">
          {breakdownError}
        </p>
      )}
      {retryNotice && (
        <p
          role={retryNotice.tone === "ok" ? "status" : "alert"}
          className={`text-body-s ${retryNotice.tone === "ok" ? "text-success" : "text-danger"}`}
        >
          {retryNotice.text}
        </p>
      )}
      {paging.total > 0 && (
        // The payer's pick of 10, 50 or 100 to a page, and the way through them.
        <nav
          aria-label="Invoice pages"
          className="flex w-full flex-wrap items-center justify-between gap-3 text-body-s text-ink-2"
        >
          <div className="flex items-center gap-2">
            <label htmlFor={perPageId}>Rows per page</label>
            <select
              id={perPageId}
              value={paging.perPage}
              onChange={(e) => {
                const size = Number(e.target.value);
                if (isInvoicePageSize(size)) onPerPage(size);
              }}
              className="h-11 rounded-xl border border-line-input bg-card px-2 text-body-s text-ink"
            >
              {INVOICE_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span aria-live="polite">{invoiceRange(paging.page, paging.perPage, paging.total)}</span>
            <button
              type="button"
              onClick={() => onPage(paging.page - 1)}
              disabled={paging.page <= 1}
              aria-label="Previous page"
              className="size-11 rounded-xl border border-line bg-card text-body-m text-ink hover:bg-hover disabled:opacity-40"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => onPage(paging.page + 1)}
              disabled={paging.page >= paging.pages}
              aria-label="Next page"
              className="size-11 rounded-xl border border-line bg-card text-body-m text-ink hover:bg-hover disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
