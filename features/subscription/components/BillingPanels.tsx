"use client";

/**
 * The billing page, drawn (Figma 08-B and its states): the "Next billing" block - who the bill
 * goes to and when, amber with "Due Immediately" when a payment has failed (08-K); the saved
 * cards, the default pinned first with its chip, each with the "Update card" menu (08-W/08-X),
 * "Show more (6)" for the rest (08-J), "No card saved" when there are none (08-H) and the red
 * line when the card being charged has expired (08-I); and the invoices already paid, each
 * opening Stripe's own hosted page. Everything shown is the hook's (`useBillingPage`).
 */

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import {
  ADD_A_PAYMENT_METHOD,
  ADD_PAYMENT_METHOD,
  BILL_TO,
  DUE_IMMEDIATELY,
  INVOICE_HISTORY,
  NEXT_BILLING,
  NEXT_BILL_DATE,
  NO_CARD,
  NO_CARD_BODY,
  NO_INVOICES,
  PAYMENT_FAILED,
  PAYMENT_METHODS,
  UPDATE_CARD,
  type CardMenuItem,
  type CardRow,
  type InvoiceLine,
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

/** 08-B's first block: who Minty bills, and when it next will. */
export function NextBillingCard({ next }: { next: NextBilling }) {
  return (
    <section
      aria-label={NEXT_BILLING}
      data-state={next.failed ? "failed" : "ok"}
      className={`flex items-start justify-between gap-6 rounded-[20px] px-8 py-7 ${
        next.failed ? "bg-[#fdf6ec]" : "bg-[#e7f6f5]"
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <h2 className="text-[17px] font-bold text-[#16202e]">{NEXT_BILLING}</h2>
        <div className="flex flex-wrap gap-x-16 gap-y-6">
          <div className="min-w-0">
            <p className="text-[17px] font-bold text-[#16202e]">{BILL_TO}</p>
            <p className="mt-2 truncate text-[17px] text-[#16202e]">{next.billTo || "—"}</p>
            {next.email && <p className="mt-3 truncate text-[15px] text-[#8b93a0]">{next.email}</p>}
          </div>
          <div>
            <div className="flex flex-wrap items-baseline gap-4">
              <p className="text-[17px] font-bold text-[#16202e]">{NEXT_BILL_DATE}</p>
              <p className="text-[17px] text-[#16202e]">{next.date ?? "—"}</p>
            </div>
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
        </div>
      </div>
      <Image
        src={next.failed ? "/portal/minty-thinking.png" : "/portal/minty-clock.png"}
        alt=""
        width={next.failed ? 118 : 163}
        height={next.failed ? 138 : 122}
        unoptimized
        className="hidden shrink-0 sm:block"
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
              All {rows.length} saved cards. The default card is the only one charged.
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
}: {
  invoices: InvoiceLine[];
  amountHeader: string;
}) {
  return (
    <section aria-label={INVOICE_HISTORY} className="flex flex-col gap-3">
      <h2 className="text-[15px] font-bold text-[#16202e]">{INVOICE_HISTORY}</h2>
      {invoices.length === 0 ? (
        <p className="text-[15px] text-[#8b93a0]">{NO_INVOICES}</p>
      ) : (
        <table className="w-full max-w-[860px] border-collapse text-left">
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
              <th scope="col" className="pb-2">
                Invoice PDF
              </th>
            </tr>
          </thead>
          <tbody className="text-[13px] text-[#16202e]">
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-[#eef1f4]">
                <td className="py-3">{inv.reference}</td>
                <td className="py-3 tabular-nums">{inv.amount}</td>
                <td className="py-3">{inv.paid ?? "—"}</td>
                <td className="py-3">
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
