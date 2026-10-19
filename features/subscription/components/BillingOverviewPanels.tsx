"use client";

/**
 * The portal's landing, drawn (Figma 08-A "Subscription & Billing") as a Decision dashboard
 * (Part 15.6b, the owner's visual-anchors brief 2026-10-19): the POSITION HEADER on the
 * subscription header's gradient - the title, one status pill, the next bill as the page's one
 * large amount, who it is billed to (the way to move a company between accounts) and *Manage
 * Subscription* - then a Page banner for each thing that needs the payer, then three plain
 * sections: the modules, the payment method and the invoices. Everything shown is the hook's
 * (`useBillingOverview`).
 */

import Image from "next/image";
import type { ReactNode } from "react";

import { CardBrand } from "@/features/subscription/components/CardBrand";
import { NoAccountPanel, NoCardPanel } from "@/features/subscription/components/BillingPanels";
import { fromControl } from "@/features/subscription/components/SubscriptionSummaryRow";
import type { BillingAccount } from "@/features/subscription/api/payerPortal";
import {
  BILL_TO,
  BILLING_ACCOUNT,
  CHANGE_BILLING_ACCOUNT,
  ESTIMATED,
  GO_TO_BILLING,
  LOADING_INVOICES,
  MANAGE_SUBSCRIPTION,
  NEXT_BILLING_DATE,
  NOTHING_TO_UPDATE,
  NO_INVOICES_YET,
  OVERVIEW_TITLE,
  RECENT_INVOICES,
  SUBSCRIPTION_UPDATES,
  cardExpiry,
  cardTitle,
  moreUpdatesLabel,
  visibleUpdates,
  type AttentionItem,
  type ModuleSummaryRow,
  type NextBilling,
  type Overview,
  type OverviewUpdate,
  type StatusTone,
} from "@/features/subscription/lib/billing";
import { ACCOUNTS_LOAD_FAILED, CHOOSE_ACCOUNT } from "@/features/subscription/lib/billingAccounts";
import type { RecentInvoicesState } from "@/features/subscription/hooks/useBillingOverview";

export const NEXT_BILL = "Next bill";
export const MODULES = "Modules";
export const PAYMENT_METHOD = "Payment method";
export const INVOICES = "Invoices";
export const SEE_ALL_INVOICES = "See all invoices";
export const NO_MODULES = "No module is being paid for or on a trial yet.";
export const RECENT_INVOICES_LABEL = "Latest invoices";

const PILL: Record<StatusTone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  neutral: "bg-neutral-bg text-neutral",
};

/** A status, in words, in its tone's soft pill (Part 13 status tones). */
export function StatusPill({ label, tone }: { label: string; tone: StatusTone }) {
  return (
    <span
      data-tone={tone}
      className={`inline-flex h-7 shrink-0 items-center rounded-full px-3 text-label font-semibold ${PILL[tone]}`}
    >
      {label}
    </span>
  );
}

/** The section headings' one look: plain, on the page, a link at the right when there is one. */
function SectionHeading({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <h2 id={id} className="text-title-l font-semibold text-ink">
        {title}
      </h2>
      {children}
    </div>
  );
}

const SECTION = "flex min-w-0 flex-col gap-4 border-t border-line-subtle pt-6";
const TEXT_LINK =
  "-mx-2 inline-flex min-h-11 items-center rounded-lg px-2 text-body-m font-semibold text-link underline underline-offset-4 hover:bg-selected";

/**
 * The position header: ONE billing account's position on the subscription header's gradient
 * (Part 13's exception asset, `--subscription-header-gradient`). Every word on it is text/primary,
 * the only ink that passes AA on both stops (7.35:1 on #00CBC6, 8.00:1 on #00D5BF); white and
 * the secondary greys do not. The action is the Secondary look, white: Minty Action's own fill
 * would vanish into the gradient.
 *
 * TWO CLICKS, TWO JOBS (the user's call, kept from 08-A's card): CLICKING THE HEADER opens the
 * billing-account sheet - which account it shows, and *New billing account* - and CLICKING THE
 * ACCOUNT'S NAME is "Change billing account", moving a company to another account. The header is
 * a region, not a control, so the keyboard's way to the sheet is a button of its own, out of
 * sight until focused. Clicks on its real controls are theirs (`fromControl`).
 */
export function PositionHeader({
  next,
  pill,
  accountsFailed,
  notice,
  ready,
  onPick,
  onMove,
  onRetry,
  onManage,
}: {
  next: NextBilling;
  pill: { label: string; tone: StatusTone } | null;
  /** The accounts could not be read: the payer-level fallback is shown, with a retry. */
  accountsFailed: boolean;
  /** How a move went, said once under the account line. */
  notice: { text: string; tone: "ok" | "failed" } | null;
  /** The reads are in: the figures and the pill are facts, not placeholders. */
  ready: boolean;
  onPick: () => void;
  onMove: () => void;
  onRetry: () => void;
  onManage: () => void;
}) {
  const pickable = ready && !accountsFailed;
  return (
    <section
      aria-label={BILLING_ACCOUNT}
      onClick={(e) => {
        if (pickable && !fromControl(e)) onPick();
      }}
      className={`flex gap-6 rounded-xl bg-[image:var(--subscription-header-gradient)] p-5 text-ink sm:p-8 ${
        pickable ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-display-m font-bold text-ink">{OVERVIEW_TITLE}</h1>
          {ready && pill && <StatusPill label={pill.label} tone={pill.tone} />}
          {pickable && (
            // What a click on the header does, for the keyboard - shown only while focused.
            <button
              type="button"
              onClick={onPick}
              aria-haspopup="dialog"
              className="sr-only shrink-0 rounded-lg bg-card text-body-s font-semibold text-link underline underline-offset-4 focus-visible:not-sr-only focus-visible:px-2 focus-visible:py-1"
            >
              {CHOOSE_ACCOUNT}
            </button>
          )}
        </div>

        {ready && (
          <>
            {/* The hero: the next bill's amount, the one large figure on the page - or, with no
                amount to show, the date itself. */}
            <div className="flex flex-col gap-1">
              {next.amount ? (
                <>
                  <p className="text-body-m font-semibold text-ink">
                    {NEXT_BILL} <span className="font-normal">{ESTIMATED}</span>
                  </p>
                  <p className="text-display-xl text-ink" translate="no">
                    {next.amount}
                  </p>
                  <p className="text-body-m text-ink">
                    <span>{NEXT_BILLING_DATE}</span>{" "}
                    <span className="font-semibold">{next.date ?? "—"}</span>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-body-m font-semibold text-ink">{NEXT_BILLING_DATE}</p>
                  <p className="text-display-l text-ink">{next.date ?? "—"}</p>
                </>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-body-m text-ink">{BILL_TO}</p>
              {accountsFailed ? (
                <p className="truncate text-title-m font-semibold text-ink">{next.billTo || "—"}</p>
              ) : (
                <button
                  type="button"
                  onClick={onMove}
                  aria-haspopup="dialog"
                  aria-label={`${next.billTo || "No billing account"} · ${CHANGE_BILLING_ACCOUNT}`}
                  className="-mx-2 flex min-h-11 max-w-full items-center gap-1 rounded-lg px-2 text-left text-title-m font-semibold text-ink underline-offset-4 hover:underline"
                >
                  <span className="truncate">{next.billTo || "—"}</span>
                  <span className="material-symbols-rounded shrink-0" aria-hidden>
                    expand_more
                  </span>
                </button>
              )}
            </div>

            {notice && (
              <p
                role={notice.tone === "failed" ? "alert" : "status"}
                className={`rounded-lg bg-card px-3 py-2 text-body-m ${
                  notice.tone === "failed" ? "text-danger" : "text-success"
                }`}
              >
                {notice.text}
              </p>
            )}
            {accountsFailed && (
              <p className="rounded-lg bg-card px-3 py-1 text-body-s text-danger">
                {ACCOUNTS_LOAD_FAILED}{" "}
                <button type="button" onClick={onRetry} className="min-h-11 px-1 font-semibold underline">
                  Try again
                </button>
              </p>
            )}

            <button
              type="button"
              onClick={onManage}
              className="h-11 w-full rounded-lg border border-line-selected bg-card px-4 text-body-m font-semibold text-link hover:bg-selected sm:w-auto sm:self-start"
            >
              {MANAGE_SUBSCRIPTION}
            </button>
          </>
        )}
      </div>
      {/* Minty with the cards: decoration in the header's side area, from 640px only (Part
          13.11 "allowed with care", 120-160). */}
      <Image
        src="/portal/minty-cards.png"
        alt=""
        width={160}
        height={232}
        unoptimized
        className="hidden w-[128px] shrink-0 self-end sm:block lg:w-[144px]"
      />
    </section>
  );
}

/**
 * A Page banner per thing that needs the payer (`attentionItems`): the tone, its icon, the issue
 * and the action in words, and the action as a button. Nothing is drawn when nothing is due.
 */
export function AttentionBanners({
  items,
  onAction,
}: {
  items: AttentionItem[];
  onAction: (href: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-3" aria-label="Needs your attention">
      {items.map((item) => (
        <li
          key={item.kind}
          data-kind={item.kind}
          className={`flex flex-col gap-2 rounded-lg px-4 py-3 text-body-m sm:flex-row sm:items-center sm:gap-3 ${
            item.tone === "danger" ? "bg-danger-bg text-danger" : "bg-warning-bg text-warning"
          }`}
        >
          <p className="flex min-w-0 flex-1 items-start gap-3">
            <span className="material-symbols-rounded shrink-0" aria-hidden>
              {item.tone === "danger" ? "error" : "warning"}
            </span>
            <span>{item.text}</span>
          </p>
          <button
            type="button"
            onClick={() => onAction(item.action.href)}
            className="ml-9 min-h-11 self-start rounded-lg px-1 font-semibold underline underline-offset-2 hover:bg-card/60 sm:ml-0 sm:self-center"
          >
            {item.action.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

const MODULE_CHIP: Record<string, { look: string; glyph: string }> = {
  PETTY_CASH: { look: "bg-module-pettycash-wash text-module-pettycash-ink", glyph: "point_of_sale" },
  PAYMENT_REQUEST: { look: "bg-module-payment-wash text-module-payment-ink", glyph: "request_quote" },
};

/** The module's identity chip: its wash, its ink and its glyph (identity, never status). */
export function ModuleChip({ code, name }: { code: string; name: string }) {
  const chip = MODULE_CHIP[code] ?? { look: "bg-neutral-bg text-neutral", glyph: "widgets" };
  return (
    <span
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full pl-2 pr-3 text-body-m font-semibold ${chip.look}`}
    >
      <span className="material-symbols-rounded" aria-hidden>
        {chip.glyph}
      </span>
      {name}
    </span>
  );
}

function UpdateLine({ update }: { update: OverviewUpdate }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-1" data-tone={update.tone}>
      <span className="w-[150px] shrink-0 truncate text-body-s text-ink-muted">
        {update.entityName}
      </span>
      {update.module && (
        <span className="text-body-s font-bold text-ink">{update.module}</span>
      )}
      <span className={`text-body-s ${update.tone === "failed" ? "font-bold text-danger" : ""}`}>
        {update.text}
      </span>
      {update.emphasis && <span className="text-body-s font-bold text-ink">{update.emphasis}</span>}
    </li>
  );
}

/**
 * The modules: a row per module - its identity chip, then each state it is in across the
 * payer's companies as a pill with the count beside it in plain text - and, under them, the
 * line per company that needs the payer to know something (failures first, then trials).
 */
export function ModulesSection({
  rows,
  overview,
  updatesExpanded,
  onToggleUpdates,
}: {
  rows: ModuleSummaryRow[];
  overview: Overview;
  updatesExpanded: boolean;
  onToggleUpdates: () => void;
}) {
  const more = moreUpdatesLabel(overview.updates);
  return (
    <section aria-labelledby="overview-modules" className={SECTION}>
      <SectionHeading id="overview-modules" title={MODULES} />
      {rows.length === 0 ? (
        <p className="text-body-m text-ink-2">{NO_MODULES}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-subtle rounded-lg border border-line" aria-label={MODULES}>
          {rows.map((row) => (
            <li
              key={row.code}
              data-module={row.code}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-6 sm:px-5"
            >
              <span className="sm:w-48">
                <ModuleChip code={row.code} name={row.name} />
              </span>
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2">
                {row.states.map((state) => (
                  <span key={state.key} className="inline-flex items-center gap-2" data-state={state.key}>
                    <StatusPill label={state.label} tone={state.tone} />
                    <span className="text-body-s text-ink-2">{state.count}</span>
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-title-m text-ink">{SUBSCRIPTION_UPDATES}</h3>
        {overview.updates.length === 0 ? (
          <p className="text-body-s text-ink-muted">{NOTHING_TO_UPDATE}</p>
        ) : (
          <ul className="flex flex-col gap-2" aria-label={SUBSCRIPTION_UPDATES}>
            {visibleUpdates(overview.updates, updatesExpanded).map((update, i) => (
              <UpdateLine
                key={`${update.entityId}-${update.module ?? "failed"}-${i}`}
                update={update}
              />
            ))}
          </ul>
        )}
        {more && (
          <button
            type="button"
            onClick={onToggleUpdates}
            aria-expanded={updatesExpanded}
            className="-mx-2 min-h-11 self-start rounded-lg px-2 text-body-s text-ink-2 hover:underline"
          >
            {updatesExpanded ? "Show less" : more}
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * The card the shown account charges: its network's mark, drawn large, the last four and the
 * expiry - an expired or expiring card says so in a pill. With no account at all, or no card,
 * the billing page's own panels.
 */
export function PaymentMethodSection({
  account,
  hasAccounts,
  accountsFailed,
  onOpenAccount,
  onAdd,
  onOpen,
}: {
  account: BillingAccount | null;
  /** The accounts were read and there is at least one. */
  hasAccounts: boolean;
  accountsFailed: boolean;
  onOpenAccount: () => void;
  onAdd: (accountId: string) => void;
  onOpen: () => void;
}) {
  const card = account?.card ?? null;
  const expiry = card ? cardExpiry(card) : null;
  return (
    <section aria-labelledby="overview-payment" className={SECTION}>
      <SectionHeading id="overview-payment" title={PAYMENT_METHOD} />
      {accountsFailed ? null : !hasAccounts || !account ? (
        <NoAccountPanel onOpen={onOpenAccount} />
      ) : !card ? (
        <NoCardPanel onAdd={() => onAdd(account.id)} />
      ) : (
        <div className="flex items-center gap-4" data-card={card.id}>
          <span className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-line bg-card px-2">
            <CardBrand brand={card.brand} label={card.brand_label} fit="mark" className="w-[72px]" />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-title-m font-semibold text-ink">{cardTitle(card)}</p>
            <p className="flex flex-wrap items-center gap-2 text-body-m text-ink-2">
              {expiry ? `Expires ${expiry}` : null}
              {card.expired ? (
                <StatusPill label="Expired" tone="danger" />
              ) : card.expires_soon ? (
                <StatusPill label="Expiring soon" tone="warning" />
              ) : null}
            </p>
          </div>
        </div>
      )}
      <button type="button" onClick={onOpen} className={`${TEXT_LINK} self-start`}>
        {GO_TO_BILLING} ›
      </button>
    </section>
  );
}

/**
 * The invoices (Part 15.6b's fifth level): the shown account's last three, newest first - the
 * reference and when it was raised (and for which period), the amount as plain text and the
 * status as a pill - then *See all invoices*, the billing page, where each one's PDF and
 * breakdown are. A row stacks on a phone, never scrolling sideways. While the read is out three
 * skeleton rows hold the space; a failed read says so here, with Try again.
 */
export function InvoicesSection({
  invoices,
  onRetry,
  onOpen,
}: {
  invoices: RecentInvoicesState;
  onRetry: () => void;
  onOpen: () => void;
}) {
  return (
    <section
      aria-labelledby="overview-invoices"
      aria-busy={invoices.status === "loading" || undefined}
      className={SECTION}
    >
      <SectionHeading id="overview-invoices" title={INVOICES} />
      {invoices.status === "loading" ? (
        <ul className="flex flex-col gap-2" role="status" aria-label={LOADING_INVOICES}>
          {Array.from({ length: RECENT_INVOICES }).map((_, i) => (
            <li key={i} className="flex animate-pulse flex-col gap-2 rounded-lg border border-line bg-card px-4 py-3">
              <span className="h-5 w-[160px] max-w-full rounded bg-neutral-bg" />
              <span className="h-4 w-[220px] max-w-full rounded bg-sunk" />
            </li>
          ))}
        </ul>
      ) : invoices.status === "error" ? (
        <div role="alert" className="flex flex-col items-start gap-3 text-body-m text-danger">
          {invoices.error}
          <button
            type="button"
            onClick={onRetry}
            className="h-11 rounded-lg border border-line-selected bg-card px-4 text-body-m font-semibold text-link hover:bg-selected"
          >
            Try again
          </button>
        </div>
      ) : invoices.rows.length === 0 ? (
        <p className="text-body-m text-ink-2">{NO_INVOICES_YET}</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label={RECENT_INVOICES_LABEL}>
          {invoices.rows.map((inv) => (
            <li
              key={inv.id}
              data-invoice={inv.id}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 rounded-lg border border-line bg-card px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 basis-[180px] flex-col gap-0.5">
                <p className="break-words text-body-m font-semibold text-ink">{inv.reference}</p>
                <p className="break-words text-body-s text-ink-2">
                  {[inv.date, inv.period].filter(Boolean).join(" · ")}
                </p>
              </div>
              {/* The amount is plain text in every state; only the pill carries the tone. */}
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <span className="text-body-m tabular-nums text-ink">{inv.amount}</span>
                <StatusPill label={inv.status.label} tone={inv.status.tone} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onOpen} className={`${TEXT_LINK} self-start`}>
        {SEE_ALL_INVOICES} ›
      </button>
    </section>
  );
}
