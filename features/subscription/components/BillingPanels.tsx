"use client";

/**
 * The billing page, drawn (Figma 08-B and its states) - ONE billing account's profile: the
 * "Next billing" block - the account's name, address and billing email with the way to change
 * them (08-C), and when it next bills, amber with "Due Immediately" when a payment on it has
 * failed (08-K); its cards, the one it charges pinned first with its chip, each with the
 * "Update card" menu (08-W/08-X), "Show more (6)" for the rest (08-J), "No card saved" when
 * there are none (08-H) and the red line when the card being charged has expired (08-I); and
 * its invoices, each opening Stripe's own hosted page and giving its billing breakdown - company
 * by company - as a CSV, 10 / 50 / 100 to a page. Everything shown is the hook's
 * (`useBillingPage`).
 */

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import {
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
  UPDATE_CARD,
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
  default: "bg-[#fdf2e0] text-[#c98b1b]",
  saved: "bg-[#eff1f4] text-[#6b7380]",
  expired: "bg-[#fdeded] text-[#dc5a5a]",
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
 */
export function NextBillingCard({
  next,
  onChangeDetails,
}: {
  next: NextBilling;
  onChangeDetails?: () => void;
}) {
  return (
    <section
      aria-label={NEXT_BILLING}
      data-state={next.failed ? "failed" : "ok"}
      // THREE COLUMNS from a tablet up, as the design draws them: "Bill to", the date and the
      // amount, and Minty - the cat is a column of its own, not an ornament. The date and amount
      // stay beside "Bill to" however long the name, address or email (it was once a wrapping
      // row, and a long billing email pushed them under it). "Bill to" takes everything the
      // other two leave, with the gaps kept tight to give it room; what still does not fit
      // WRAPS rather than clipping - an email after its "@". Only a phone stacks them, and
      // drops the cat.
      className={`grid grid-cols-1 gap-x-6 gap-y-5 rounded-[20px] px-8 py-7 sm:grid-cols-[minmax(0,1fr)_auto_auto] ${
        next.failed ? "bg-[#fdf6ec]" : "bg-[#e7f6f5]"
      }`}
    >
      <h2 className="text-[17px] font-bold text-[#16202e] sm:col-span-2">{NEXT_BILLING}</h2>
      <div className="min-w-0 [overflow-wrap:anywhere] sm:col-start-1 sm:row-start-2">
        <p className="text-[17px] font-bold text-[#16202e]">{BILL_TO}</p>
        <p className="mt-2 text-[17px] text-[#16202e]">{next.billTo || "—"}</p>
        {next.addressLines.length > 0 && (
          <address className="mt-3 text-[15px] not-italic leading-snug text-[#8b93a0]">
            {next.addressLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        )}
        {next.email && (
          <p className="mt-3 text-[15px] text-[#8b93a0]">
            <BreakableEmail address={next.email} />
          </p>
        )}
        {onChangeDetails && (
          <button
            type="button"
            onClick={onChangeDetails}
            className="mt-5 text-[15px] text-[#16202e] underline underline-offset-4 hover:text-[#2e9b9b]"
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
          <dt className="text-[17px] font-bold text-[#16202e]">{NEXT_BILL_DATE}</dt>
          <dd className="text-right text-[17px] text-[#16202e]">{next.date ?? "—"}</dd>
          <dt className="text-[17px] font-bold text-[#16202e]">{AMOUNT}</dt>
          <dd className="text-right">
            <span className="block text-[28px] font-bold leading-none tabular-nums text-[#4fc7c7]">
              {next.amount ?? "—"}
            </span>
            {next.amount && (
              <span className="mt-1.5 block text-[13px] text-[#a0a8b2]">{ESTIMATED}</span>
            )}
          </dd>
        </dl>
        {/* Which companies failed is the overview's line (08-A); here the block only
            says that the account owes something now. */}
        {next.failed && (
          <div className="mt-4 flex flex-col items-start gap-3">
            <p className="text-[17px] text-[#dc5a5a]">{DUE_IMMEDIATELY}</p>
            <span className="rounded-lg bg-[#fdeded] px-5 py-2 text-[15px] font-semibold text-[#dc5a5a]">
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
      className="mx-auto flex w-fit items-center gap-3 rounded-lg border border-[#f3c2c2] bg-[#fdf3f3] px-6 py-3.5 text-[15px] text-[#21262e]"
    >
      <span aria-hidden className="text-lg text-[#dc5a5a]">
        ⚠
      </span>
      {text.replace(/\s*Update your payment method here\.$/, "")}{" "}
      <button type="button" onClick={onAdd} className="font-semibold text-[#dc5a5a] underline">
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
      className={`flex h-[62px] w-[92px] shrink-0 items-center justify-center rounded-xl border border-[#eef1f4] bg-white text-center font-black italic text-[#1a1f71] shadow-[0px_2px_8px_0px_rgba(0,0,0,0.06)] ${
        label.length > 5 ? "text-[13px]" : "text-xl"
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
  onSelect,
}: {
  row: CardRow;
  items: CardMenuItem[];
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
        className={`h-[38px] w-[112px] rounded-lg border bg-white text-[13px] font-semibold hover:bg-[#f7f9fa] ${
          row.chip === "expired"
            ? "border-[#e3a1a1] text-[#dc5a5a]"
            : "border-[#d8dee4] text-[#292e38]"
        }`}
      >
        {UPDATE_CARD}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-[44px] z-20 w-[164px] overflow-hidden rounded-xl border border-[#eef1f4] bg-white py-2 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.12)]"
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
              className={`block w-full px-5 py-2.5 text-left text-[15px] hover:bg-[#f5f7fa] ${
                item === "delete" ? "text-[#dc5a5a]" : "text-[#292e38]"
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
  onSelect,
}: {
  row: CardRow;
  items: CardMenuItem[];
  onSelect: (item: CardMenuItem) => void;
}) {
  return (
    <li className="flex items-center gap-4" data-card={row.card.id} data-chip={row.chip}>
      <BrandTile label={row.card.brand_label || "Card"} />
      <div className="flex flex-1 items-center gap-6 rounded-xl border border-[#f0f2f5] bg-white px-7 py-4 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.06)]">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-[#a0a8b2]">Payment Method</p>
          <p className="truncate text-[15px] font-bold text-[#16202e]">{row.title}</p>
        </div>
        <div className="hidden min-w-[110px] sm:block">
          <p className="text-[13px] text-[#a0a8b2]">Expiry date</p>
          <p
            className={`text-[15px] font-bold ${
              row.chip === "expired" ? "text-[#dc5a5a]" : "text-[#16202e]"
            }`}
          >
            {row.expiry ?? "—"}
          </p>
        </div>
        <span
          data-chip-label
          className={`hidden shrink-0 rounded-md px-4 py-1.5 text-[13px] font-semibold sm:inline ${CHIP[row.chip]}`}
        >
          {CHIP_LABEL[row.chip]}
        </span>
        <CardMenu row={row} items={items} onSelect={onSelect} />
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
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#c7cdd4] px-6 py-10 text-center"
    >
      <p className="text-[17px] font-bold text-[#16202e]">{NO_ACCOUNT_TITLE}</p>
      <p className="max-w-[520px] text-[15px] text-[#8b93a0]">{NO_ACCOUNT_BODY}</p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-2 h-[44px] w-[220px] rounded-lg bg-[#4fc7c7] text-[15px] font-semibold text-white hover:opacity-90"
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
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#c7cdd4] px-6 py-10 text-center"
    >
      <p className="text-[17px] font-bold text-[#16202e]">{NO_CARD}</p>
      <p className="max-w-[520px] text-[15px] text-[#8b93a0]">{NO_CARD_BODY}</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-2 h-[44px] w-[220px] rounded-lg bg-[#4fc7c7] text-[15px] font-semibold text-white hover:opacity-90"
      >
        {ADD_A_PAYMENT_METHOD}
      </button>
    </div>
  );
}

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
}) {
  return (
    <section aria-label={PAYMENT_METHODS} aria-busy={busy} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[15px] font-bold text-[#16202e]">{PAYMENT_METHODS}</h2>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={onAdd}
            className="h-[38px] rounded-lg bg-[#4fc7c7] px-5 text-[13px] font-semibold text-white hover:opacity-90"
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
                onSelect={(item) => onMenu(row, item)}
              />
            ))}
          </ul>
          {showMore && (
            <button
              type="button"
              onClick={onToggle}
              className="self-end text-[15px] text-[#6b7380] hover:underline"
            >
              {expanded ? "Show less" : showMore}
            </button>
          )}
          {expanded && (
            <p className="text-[13px] text-[#a0a8b2]">
              All {rows.length} saved cards. The default card is the one this account charges.
            </p>
          )}
        </>
      )}
      {actionError && (
        <p role="alert" className="text-[13px] text-[#b42318]">
          {actionError}
        </p>
      )}
    </section>
  );
}

/**
 * 08-B's invoice history. "Invoice PDF" is Stripe's own hosted invoice page - a CAPABILITY URL,
 * so it opens in a new tab with `rel="noopener noreferrer"` and is never logged or rewritten.
 * The design's "Billing Breakdown · Download csv" column belongs to section 09 and waits for it.
 */
export function InvoiceHistoryTable({
  invoices,
  amountHeader,
  paging,
  onPage,
  onPerPage,
  onBreakdown,
  breakdownBusy,
  breakdownError,
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
  /** "Download csv": one invoice, company by company. */
  onBreakdown: (invoiceId: string) => void;
  /** The invoice whose breakdown is being prepared, while it is. */
  breakdownBusy: string | null;
  breakdownError: string | null;
}) {
  const perPageId = useId();
  return (
    <section aria-label={INVOICE_HISTORY} className="flex flex-col gap-3">
      <h2 className="text-[15px] font-bold text-[#16202e]">{INVOICE_HISTORY}</h2>
      {invoices.length === 0 && paging.loading ? (
        <p role="status" className="text-[15px] text-[#8b93a0]">
          {LOADING_INVOICES}
        </p>
      ) : invoices.length === 0 ? (
        <p className="text-[15px] text-[#8b93a0]">{NO_INVOICES}</p>
      ) : (
        <table
          aria-busy={paging.loading || undefined}
          className={`w-full max-w-[860px] border-collapse text-left ${paging.loading ? "opacity-60" : ""}`}
        >
          <thead>
            <tr className="text-[13px] font-semibold text-[#16202e]">
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
            </tr>
          </thead>
          <tbody className="text-[13px] text-[#16202e]">
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-[#eef1f4]">
                <td className="py-3">{inv.reference}</td>
                <td className="py-3 tabular-nums">{inv.amount}</td>
                <td className="py-3">{inv.paid ?? "—"}</td>
                <td className="py-3 text-center">
                  {inv.pdf ? (
                    <a
                      href={inv.pdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Invoice ${inv.reference} (PDF)`}
                      className="inline-flex text-[#16202e] hover:text-[#2e9b9b]"
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
                    </a>
                  ) : (
                    <span className="text-[#c7cdd4]">—</span>
                  )}
                </td>
                <td className="py-3 text-center">
                  <button
                    type="button"
                    onClick={() => onBreakdown(inv.id)}
                    disabled={breakdownBusy !== null}
                    aria-busy={breakdownBusy === inv.id || undefined}
                    aria-label={`${DOWNLOAD_CSV}: the billing breakdown of invoice ${inv.reference}`}
                    className="text-[13px] text-[#18c4c7] hover:underline hover:underline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {breakdownBusy === inv.id ? PREPARING_CSV : DOWNLOAD_CSV}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {breakdownError && (
        <p role="alert" className="text-[13px] text-[#b42318]">
          {breakdownError}
        </p>
      )}
      {paging.total > 0 && (
        // The payer's pick of 10, 50 or 100 to a page, and the way through them.
        <nav
          aria-label="Invoice pages"
          className="flex w-full max-w-[860px] flex-wrap items-center justify-between gap-3 text-[13px] text-[#6b7380]"
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
              className="h-8 rounded-md border border-[#d8dee4] bg-white px-2 text-[13px] text-[#16202e]"
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
              className="h-8 w-8 rounded-md border border-[#d8dee4] bg-white text-[15px] text-[#16202e] hover:bg-[#f5f7fa] disabled:opacity-40"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => onPage(paging.page + 1)}
              disabled={paging.page >= paging.pages}
              aria-label="Next page"
              className="h-8 w-8 rounded-md border border-[#d8dee4] bg-white text-[15px] text-[#16202e] hover:bg-[#f5f7fa] disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </nav>
      )}
    </section>
  );
}
