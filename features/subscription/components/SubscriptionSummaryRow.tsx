"use client";

/**
 * A list row opened in place (Figma 05·A, "Subscription Summary"): the company's name and ⋮,
 * the blue ⓘ line while a trial runs, its two module cards with a checkbox or a Start Free
 * Trial button under each, the summary panel, and the two footer sentences. Everything shown is
 * a `SummaryView` (`lib/subscriptionSummary.ts`); no card flag is read here.
 *
 * A checkbox press is a PENDING change (Figma 05·B): the card flips, carries a chip (Adding /
 * Removing / Restoring), the panel shows the subscription as it would be, and "Confirm
 * Subscription Change" hands the change to the hook - which asks first (Figma section 06's
 * modal), applies it and lands on its result (05·C). Nothing is posted from here.
 *
 * "Calculating…" (05·B-C) sits where the panel goes while the page model loads - the cards are
 * already drawn from what the list knows - and for a beat after every tick.
 */

import Image from "next/image";
import { useEffect, useRef } from "react";

import { Icon } from "@/components/ui/Icon";

import type { ModuleCode } from "@/features/subscription/api/moduleSettings";
import type { PortalEntity } from "@/features/subscription/api/payerPortal";
import type { MenuItem } from "@/features/subscription/lib/portalRows";
import type { ModuleStatusLine } from "@/features/subscription/lib/moduleState";
import {
  CONFIRM_CHANGE,
  TRIAL_NOTICE,
  type Chip,
  type PendingChange,
  type PlanLine,
  type SummaryBlock,
  type SummaryModule,
  type SummaryView,
} from "@/features/subscription/lib/subscriptionSummary";

import { MODULE_ART } from "@/features/subscription/components/ModuleCard";
import { RowFooter } from "@/features/subscription/components/RowFooter";
import { RowMenu } from "@/features/subscription/components/RowMenu";

export const CALCULATING = "Calculating....";

export type SummaryRowHandlers = {
  onClose: () => void;
  onStartTrial: (code: ModuleCode) => void;
  /** A checkbox press: flip this module's pending tick (or undo it). */
  onTick: (code: ModuleCode) => void;
  /** "Confirm Subscription Change": the pending change, to confirm. */
  onConfirmChange: (change: PendingChange) => void;
  onMenu: (item: MenuItem) => void;
  onChangePaymentMethod: () => void;
  onRetry: () => void;
};

const CHIP: Record<Chip, string> = {
  Adding: "bg-[#e9f8f8] text-[#18c4c7]",
  Restoring: "bg-[#e9f8f8] text-[#18c4c7]",
  Removing: "bg-[#fff7ec] text-[#cc7f03]",
};

const TONE: Record<ModuleStatusLine["tone"], string> = {
  accent: "text-accent",
  teal: "text-quiet",
  muted: "text-quiet",
  info: "text-info",
  plain: "text-black",
};

const PLAN_TONE: Record<PlanLine["tone"], string> = {
  petty: "text-[#ea9713]",
  payment: "text-[#2e6ff2]",
  bundle: "text-[#161f2e]",
  none: "text-[#161f2e]",
};

export function SummaryModuleCard({ module }: { module: SummaryModule }) {
  const art = MODULE_ART[module.code];
  const live = module.view.live;
  const frame = live
    ? "border-2 border-[#4fc7c7] bg-[#f5ffff] shadow-[0px_4px_12px_0px_rgba(69,214,214,0.1),0px_4px_20px_4px_rgba(69,214,214,0.2)]"
    : "border border-[#e6e6e6] bg-white";
  const { status } = module.view;
  return (
    <article
      aria-label={module.name}
      data-module={module.code}
      data-state={module.view.state}
      data-ticked={module.tick === "ticked"}
      className={`flex h-[354px] w-full flex-col items-center rounded-[20px] px-4 pt-[31px] text-center ${frame}`}
    >
      <div
        className={`flex h-[120px] w-[167px] items-center justify-center rounded-[13px] ${art.tile} ${
          live ? "" : "opacity-50"
        }`}
      >
        <Image
          src={art.src}
          alt=""
          width={art.width}
          height={art.height}
          className={art.box}
          unoptimized
        />
      </div>
      <h3 className="mt-4 text-[26px] font-bold leading-tight text-ink">{module.name}</h3>
      <div className="mt-auto font-bold">
        {status.eyebrow && (
          <p className={`text-sm ${status.tone === "info" ? "text-quiet" : "text-black"}`}>
            {status.eyebrow}
          </p>
        )}
        <p className={`text-xl ${TONE[status.tone]}`}>{status.text}</p>
      </div>
      <div className="flex h-[46px] items-center">
        {module.chip && (
          <span
            data-chip={module.chip}
            className={`rounded-lg px-6 py-1 text-sm font-bold ${CHIP[module.chip]}`}
          >
            {module.chip}
          </span>
        )}
      </div>
    </article>
  );
}

function UnderCard({
  module,
  disabled = false,
  on,
}: {
  module: SummaryModule;
  /** While the page model loads: the buttons wait for it. */
  disabled?: boolean;
  on: Pick<SummaryRowHandlers, "onStartTrial" | "onTick">;
}) {
  if (module.tick === "start_trial") {
    return (
      <button
        type="button"
        onClick={() => on.onStartTrial(module.code)}
        disabled={disabled}
        aria-label={`Start Free Trial · ${module.name}`}
        className="h-[50px] w-[195px] rounded-full bg-secondary text-xl font-bold text-white hover:opacity-90 disabled:opacity-60"
      >
        Start Free Trial
      </button>
    );
  }
  const ticked = module.tick === "ticked";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={ticked}
      aria-label={`${module.name} subscription`}
      data-changed={module.changed}
      disabled={disabled}
      onClick={() => on.onTick(module.code)}
      className={
        ticked
          ? "flex size-10 items-center justify-center rounded-lg bg-[#4fc7c7] text-white"
          : "size-[34px] rounded-[9px] border-2 border-[#c7cdd4] bg-white"
      }
    >
      {ticked && <Icon name="check" size={24} strokeWidth={3} />}
    </button>
  );
}

export function PlanLines({ lines, size = "text-xl" }: { lines: PlanLine[]; size?: string }) {
  return (
    <ul className="flex flex-col gap-1">
      {lines.map((line) => (
        <li key={line.name} className="flex items-center gap-2">
          <span className={`${size} font-bold ${PLAN_TONE[line.tone]}`}>{line.name}</span>
          {line.tone === "bundle" && (
            <Image src="/portal/super-minty.png" alt="" width={60} height={56} unoptimized />
          )}
          {line.tag && <span className="text-sm text-[#737a87]">{line.tag}</span>}
        </li>
      ))}
    </ul>
  );
}

export function PriceBox({
  price,
  struck,
  greyed,
}: {
  price: string;
  struck: string | null;
  greyed: boolean;
}) {
  return (
    <div
      data-greyed={greyed}
      className={`relative flex h-[101px] items-center justify-center gap-3 rounded-[32px] ${
        greyed ? "bg-[#e7ecf0]" : "bg-[#e9f8f8]"
      }`}
    >
      {struck && (
        <s
          className="absolute right-8 top-3 text-[22px] text-[#8b95a7]"
          aria-label={`was ${struck}`}
        >
          {struck}
        </s>
      )}
      <span className="text-[35px] font-bold text-[#4fc7c7]">{price}</span>
      <span className="text-xl text-[#6b7280]">/month</span>
    </div>
  );
}

function Block({ block, card }: { block: SummaryBlock; card?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-4 ${
        card ? "rounded-xl bg-white p-5 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]" : ""
      }`}
    >
      <p className="whitespace-pre-line text-[15px] text-[#737a87]">
        {block.heading}
        {block.dateLine ? `\n${block.dateLine}` : ""}
      </p>
      <PlanLines lines={block.lines} />
      <PriceBox price={block.price} struck={block.struck} greyed={block.greyed} />
      {block.note && <p className="text-[15px] text-[#8a9099]">{block.note}</p>}
    </div>
  );
}

function CalculatingPanel() {
  return (
    <section
      aria-label="Subscription Summary"
      aria-busy
      data-calculating
      className="flex min-h-[469px] w-full flex-col items-center justify-center gap-6 rounded-xl bg-white p-8 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]"
    >
      <p role="status" className="text-xl font-bold text-[#4fc7c7]">
        {CALCULATING}
      </p>
      <Image src="/portal/minty-counting.png" alt="" width={157} height={136} unoptimized />
    </section>
  );
}

function SummaryPanel({
  view,
  onChangePaymentMethod,
  onConfirmChange,
}: {
  view: SummaryView;
  onChangePaymentMethod: () => void;
  onConfirmChange: (change: PendingChange) => void;
}) {
  const changing = view.panel.kind === "changing";
  return (
    <section
      aria-label="Subscription Summary"
      className={`flex w-full flex-col gap-6 rounded-xl p-8 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)] ${
        changing ? "bg-[rgba(230,230,230,0.2)]" : "bg-white"
      }`}
    >
      <h3 className="text-xl font-bold text-black">Subscription Summary</h3>

      {view.panel.kind === "simple" ? (
        <>
          <div className="flex items-start justify-between gap-6">
            <div className="flex flex-col gap-3">
              <p className="text-[15px] text-[#737a87]">Selected plan</p>
              <PlanLines lines={view.panel.lines} />
            </div>
            {view.paymentMethod && (
              <div className="flex flex-col items-end gap-1 text-right">
                <p className="text-[15px] text-[#737a87]">Payment method</p>
                <p className="text-xl font-bold text-black" data-payment-method>
                  {view.paymentMethod.label}
                </p>
                <button
                  type="button"
                  onClick={onChangePaymentMethod}
                  className="text-[15px] text-quiet hover:underline"
                >
                  Change
                </button>
              </div>
            )}
          </div>
          <PriceBox price={view.panel.price} struck={null} greyed={view.panel.greyed} />
          <p className="text-center text-xl font-bold text-quiet">No pending changes</p>
        </>
      ) : (
        <>
          <Block block={view.panel.current} />
          {view.panel.future && <Block block={view.panel.future} card />}
        </>
      )}

      {view.pendingChange && (
        <button
          type="button"
          onClick={() => onConfirmChange(view.pendingChange!)}
          className="h-[66px] rounded-2xl bg-[#4fc7c7] text-xl font-bold text-white hover:opacity-90"
        >
          {CONFIRM_CHANGE}
        </button>
      )}
    </section>
  );
}

export function SubscriptionSummaryRow({
  entity,
  status,
  calculating = false,
  view,
  error,
  menu,
  focused = false,
  on,
}: {
  entity: PortalEntity;
  status: "loading" | "ready" | "error";
  /** The panel says "Calculating…": the page model is loading, or a tick was pressed just now. */
  calculating?: boolean;
  view: SummaryView | null;
  error: string | null;
  menu: MenuItem[];
  /** Arrived by `?entity=`: bring the open row into view. */
  focused?: boolean;
  on: SummaryRowHandlers;
}) {
  const loading = status === "loading";
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "start" });
  }, [focused]);

  return (
    <li
      ref={ref}
      data-entity={entity.entity_id}
      data-open
      className="flex flex-col gap-8 rounded-xl bg-white px-8 pb-8 pt-10 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="min-w-0 truncate text-[25px] font-bold text-black">{entity.entity_name}</h3>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={on.onClose}
            aria-label={`Close ${entity.entity_name}`}
            aria-expanded
            className="flex size-10 items-center justify-center rounded-md text-[#8c949e] hover:bg-gray-100"
          >
            <Icon name="chevron-up" size={24} />
          </button>
          <RowMenu entityName={entity.entity_name} items={menu} onSelect={on.onMenu} />
        </div>
      </div>

      {loading && !view && (
        <p role="status" className="text-quiet">
          Loading…
        </p>
      )}
      {status === "error" && (
        <div role="alert" className="flex items-center gap-4 text-ink-soft">
          <p>{error}</p>
          <button type="button" onClick={on.onRetry} className="font-bold text-teal-strong">
            Try again
          </button>
        </div>
      )}

      {(status === "ready" || loading) && view && (
        <>
          {view.trialNotice && (
            <p className="flex items-center gap-2 text-xs text-info">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#007bff] text-white"
              >
                <Icon name="info" size={16} />
              </span>
              {TRIAL_NOTICE}
            </p>
          )}

          <div className="grid grid-cols-[1fr_1fr_minmax(360px,1.45fr)] items-start gap-6">
            {view.modules.map((module) => (
              <div key={module.code} className="flex flex-col items-center gap-[46px]">
                <SummaryModuleCard module={module} />
                <UnderCard module={module} disabled={loading} on={on} />
              </div>
            ))}
            {calculating || loading ? (
              <CalculatingPanel />
            ) : (
              <SummaryPanel
                view={view}
                onChangePaymentMethod={on.onChangePaymentMethod}
                onConfirmChange={on.onConfirmChange}
              />
            )}
          </div>

          <RowFooter
            entityName={entity.entity_name}
            createdOn={view.footer.createdOn}
            renewalOn={view.footer.renewalOn}
          />
        </>
      )}
    </li>
  );
}
