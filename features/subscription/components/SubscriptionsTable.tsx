"use client";

/**
 * The list itself (Figma 04-A): a section title with the count, the column heads with their
 * sort arrows, and one card per company - name, a cell per module, the expand chevron and the
 * ⋮ menu. Suspended companies (nothing running) sit in their own section below, greyed. The
 * open company (one at a time) renders as its Subscription Summary row (Figma 05·A) in place,
 * and the company whose change just landed as its result row (Figma 05·C).
 */

import { useEffect, useRef } from "react";

import { Icon } from "@/components/ui/Icon";

import type { ModuleCode } from "@/features/subscription/api/moduleSettings";
import type { PortalEntity } from "@/features/subscription/api/payerPortal";
import type {
  ListSort,
  MenuItem,
  SortColumn,
  SubscriptionRow,
} from "@/features/subscription/lib/portalRows";
import { pluralEntities } from "@/features/subscription/lib/portalRows";

import { ChangeResultRow } from "@/features/subscription/components/ChangeResultView";
import { ModuleCellView } from "@/features/subscription/components/ModuleCellView";
import { RowMenu } from "@/features/subscription/components/RowMenu";
import {
  SubscriptionSummaryRow,
  type SummaryRowHandlers,
} from "@/features/subscription/components/SubscriptionSummaryRow";
import type { ChangeResult } from "@/features/subscription/lib/changeResult";
import type { PendingChange, SummaryView } from "@/features/subscription/lib/subscriptionSummary";

export type RowHandlers = {
  /** The chevron: open this company's row in place, or close it if it is the open one. */
  onToggle: (entity: PortalEntity) => void;
  onStartTrial: (entity: PortalEntity, code: ModuleCode) => void;
  onSubscribe: (entity: PortalEntity, code: ModuleCode) => void;
  onMenu: (entity: PortalEntity, item: MenuItem) => void;
  onTick: (entity: PortalEntity, code: ModuleCode) => void;
  onConfirmChange: (entity: PortalEntity, change: PendingChange) => void;
  onChangePaymentMethod: (entity: PortalEntity) => void;
  onRetrySummary: () => void;
  /** The result row's "Back to Manage Subscriptions". */
  onResultBack: () => void;
};

/** The company whose change just landed, and its result (row layout). */
export type ResultRow = { entityId: string; result: ChangeResult };

/** The open row: which company, and what its panel shows so far. */
export type OpenRow = {
  entityId: string;
  status: "loading" | "ready" | "error";
  view: SummaryView | null;
  error: string | null;
};

const GRID = "grid grid-cols-[minmax(200px,1.3fr)_1fr_1fr_auto] items-center gap-6";

function SortHead({
  column,
  label,
  sort,
  onToggle,
  strong,
}: {
  column: SortColumn;
  label: string;
  sort: ListSort;
  onToggle: (column: SortColumn) => void;
  strong?: boolean;
}) {
  const active = sort?.column === column;
  const direction = active ? sort?.direction : null;
  return (
    <button
      type="button"
      onClick={() => onToggle(column)}
      aria-label={`Sort by ${label}`}
      aria-pressed={active}
      data-direction={direction ?? "none"}
      className={`flex items-center gap-1.5 ${
        strong ? "text-[25px] font-bold text-ink" : "text-lg text-[#6b7380]"
      }`}
    >
      {label}
      <Icon
        name={direction === "asc" ? "chevron-up" : "chevron-down"}
        size={24}
        className={active ? "text-[#2e9b9b]" : "text-[#6b7380]"}
      />
    </button>
  );
}

function Row({ row, focused, on }: { row: SubscriptionRow; focused: boolean; on: RowHandlers }) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "center" });
  }, [focused]);

  const suspended = row.section === "suspended";
  return (
    <li
      ref={ref}
      data-entity={row.entity.entity_id}
      className={`${GRID} min-h-[125px] rounded-xl px-7 py-5 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)] ${
        suspended ? "bg-[#f5f5f5]" : "bg-white"
      } ${focused ? "ring-2 ring-secondary" : ""}`}
    >
      <p className="min-w-0 truncate text-[25px] font-bold text-black">{row.entity.entity_name}</p>
      {row.cells.map((cell) => (
        <ModuleCellView
          key={cell.code}
          cell={cell}
          entityName={row.entity.entity_name}
          onStartTrial={(code) => on.onStartTrial(row.entity, code)}
          onSubscribe={(code) => on.onSubscribe(row.entity, code)}
        />
      ))}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => on.onToggle(row.entity)}
          aria-label={`Open ${row.entity.entity_name}`}
          aria-expanded={false}
          className="flex size-10 items-center justify-center rounded-md text-[#8c949e] hover:bg-gray-100"
        >
          <Icon name="chevron-down" size={24} />
        </button>
        <RowMenu
          entityName={row.entity.entity_name}
          items={row.menu}
          onSelect={(item) => on.onMenu(row.entity, item)}
        />
      </div>
    </li>
  );
}

function Rows({
  rows,
  focusEntityId,
  open,
  result,
  on,
}: {
  rows: SubscriptionRow[];
  focusEntityId: string | null;
  open: OpenRow | null;
  result: ResultRow | null;
  on: RowHandlers;
}) {
  return (
    <>
      {rows.map((row) =>
        result && result.entityId === row.entity.entity_id ? (
          <ChangeResultRow
            key={row.entity.entity_id}
            entity={row.entity}
            result={result.result}
            menu={row.menu}
            onMenu={(item) => on.onMenu(row.entity, item)}
            onBack={on.onResultBack}
          />
        ) : open && open.entityId === row.entity.entity_id ? (
          <SubscriptionSummaryRow
            key={row.entity.entity_id}
            entity={row.entity}
            status={open.status}
            view={open.view}
            error={open.error}
            menu={row.menu}
            focused={row.entity.entity_id === focusEntityId}
            on={summaryHandlers(row.entity, on)}
          />
        ) : (
          <Row
            key={row.entity.entity_id}
            row={row}
            focused={row.entity.entity_id === focusEntityId}
            on={on}
          />
        ),
      )}
    </>
  );
}

function summaryHandlers(entity: PortalEntity, on: RowHandlers): SummaryRowHandlers {
  return {
    onClose: () => on.onToggle(entity),
    onStartTrial: (code) => on.onStartTrial(entity, code),
    onTick: (code) => on.onTick(entity, code),
    onConfirmChange: (change) => on.onConfirmChange(entity, change),
    onMenu: (item) => on.onMenu(entity, item),
    onChangePaymentMethod: () => on.onChangePaymentMethod(entity),
    onRetry: on.onRetrySummary,
  };
}

export function SubscriptionsTable({
  active,
  suspended,
  sort,
  onToggleSort,
  focusEntityId,
  open,
  result = null,
  on,
}: {
  active: SubscriptionRow[];
  suspended: SubscriptionRow[];
  sort: ListSort;
  onToggleSort: (column: SortColumn) => void;
  focusEntityId: string | null;
  open: OpenRow | null;
  result?: ResultRow | null;
  on: RowHandlers;
}) {
  return (
    <div className="flex flex-col gap-10">
      <section aria-label="Active subscriptions" className="flex flex-col gap-4">
        <h2 className="px-3 text-[25px] font-bold text-ink">
          Active Subscriptions ({pluralEntities(active.length)})
        </h2>
        <div className={`${GRID} px-6`} role="presentation">
          <SortHead column="entity" label="Entity Name" sort={sort} onToggle={onToggleSort} />
          <SortHead
            column="PETTY_CASH"
            label="Petty Cash"
            sort={sort}
            onToggle={onToggleSort}
            strong
          />
          <SortHead
            column="PAYMENT_REQUEST"
            label="Payment Request"
            sort={sort}
            onToggle={onToggleSort}
            strong
          />
          <span aria-hidden className="w-[88px]" />
        </div>
        <ul className="flex flex-col gap-[29px]">
          <Rows rows={active} focusEntityId={focusEntityId} open={open} result={result} on={on} />
        </ul>
      </section>
      {suspended.length > 0 && (
        <section aria-label="Suspended subscriptions" className="flex flex-col gap-4">
          <h2 className="px-3 text-[25px] font-bold text-[var(--ink-soft)]">
            Suspended Subscriptions ({pluralEntities(suspended.length)})
          </h2>
          <ul className="flex flex-col gap-[29px]">
            <Rows
              rows={suspended}
              focusEntityId={focusEntityId}
              open={open}
              result={result}
              on={on}
            />
          </ul>
        </section>
      )}
    </div>
  );
}
