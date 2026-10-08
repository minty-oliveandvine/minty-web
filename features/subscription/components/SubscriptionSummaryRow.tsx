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
  ACTIVATE_SUBSCRIPTION,
  CONFIRM_CHANGE,
  TRIAL_NOTICE,
  type Chip,
  type PendingChange,
  type PlanLine,
  type SummaryBlock,
  type SummaryModule,
  type SummaryView,
} from "@/features/subscription/lib/subscriptionSummary";

import { CardBrand, SUMMARY_MARK } from "@/features/subscription/components/CardBrand";
import { ModuleCardShell, ModuleStatus } from "@/features/subscription/components/ModuleCard";
import { RowFooter } from "@/features/subscription/components/RowFooter";
import { RowMenu } from "@/features/subscription/components/RowMenu";

export const CALCULATING = "Calculating....";

/** The summary panel's place in the opened row's grid: below both cards until `lg`. */
const PANEL_PLACE = "sm:col-span-2 lg:col-span-1";

export type SummaryRowHandlers = {
  onClose: () => void;
  onStartTrial: (code: ModuleCode) => void;
  /** A checkbox press: flip this module's pending tick (or undo it). */
  onTick: (code: ModuleCode) => void;
  /** "Confirm Subscription Change": the pending change, to confirm. */
  onConfirmChange: (change: PendingChange) => void;
  /**
   * "Activate Subscription": this company has no SUBSCRIBER, so confirming billing comes
   * first. It takes the Confirm Subscription Change slot, under the same gate, and asks in the
   * same section-06 modal - so it carries the pending change the modal is written from.
   */
  onActivate: (change: PendingChange) => void;
  onMenu: (item: MenuItem) => void;
  /** "Change" beside the nominated card: which billing account the company is on. */
  onChangePaymentMethod: () => void;
  onRetry: () => void;
};

const CHIP: Record<Chip, string> = {
  Adding: "bg-[#e9f8f8] text-[#18c4c7]",
  Restoring: "bg-[#e9f8f8] text-[#18c4c7]",
  Removing: "bg-[#fff7ec] text-[#cc7f03]",
};

/** The card's own colour (grey, teal when ticked) unless the state has one of its own. */
const TONE: Record<ModuleStatusLine["tone"], string> = {
  accent: "text-accent",
  teal: "",
  muted: "",
  info: "text-info",
  plain: "text-black",
};

/** The module colours the plan lines are set in; the transfer summary draws its own rows. */
export const PLAN_TONE: Record<PlanLine["tone"], string> = {
  petty: "text-[#ea9713]",
  payment: "text-[#2e6ff2]",
  bundle: "text-[#161f2e]",
  none: "text-[#161f2e]",
};

/**
 * `onToggle` makes the whole card the tick's click target, not just the box below it - the card
 * looks like one thing, so all of it acts like one. It is a pointer affordance only: the
 * checkbox beside it stays the focusable control with the accessible name, so nothing is added
 * to the tab order and no second name is announced. Cards with nothing to tick (a module never
 * started, whose button is its own control) and the read-only card the transfer review draws
 * pass no handler and stay inert.
 */
/**
 * Whether a click came from a control rather than from the row around it. A row is its own
 * click target, but the ⋮ and its menu render INLINE inside the same `<li>` (no portal), as do
 * a cell's Start Trial / Subscribe buttons - so their clicks bubble, and without this the row
 * would open behind every menu and every button pressed in it.
 */
export function fromControl(e: { target: EventTarget | null }): boolean {
  const el = e.target as HTMLElement | null;
  return Boolean(el?.closest("button, a, input, [role='menu'], [role='menuitem']"));
}

export function SummaryModuleCard({
  module,
  onToggle,
}: {
  module: SummaryModule;
  onToggle?: () => void;
}) {
  return (
    <ModuleCardShell
      code={module.code}
      name={module.name}
      description={module.view.description}
      selected={module.view.live}
      status={<ModuleStatus status={module.view.status} tone={TONE} />}
      footer={
        module.chip ? (
          <span
            data-chip={module.chip}
            className={`rounded-lg px-6 py-1 text-sm font-bold ${CHIP[module.chip]}`}
          >
            {module.chip}
          </span>
        ) : null
      }
      onClick={onToggle}
      data={{
        "data-module": module.code,
        "data-state": module.view.state,
        "data-ticked": module.tick === "ticked",
      }}
    />
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
        className="h-[50px] w-full max-w-[195px] rounded-full bg-secondary text-xl font-bold text-white hover:opacity-90 disabled:opacity-60"
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
          {/* THE TAG SITS BESIDE THE NAME, on its baseline - "Petty Cash (Free Trial)",
              "Payment Request only" (the user, 2026-09-28, reversing an earlier "under the
              name"). It wraps below only when the column cannot hold both, and never breaks
              inside itself. The transfer review (07-D) draws its own lines and keeps its own
              layout, deliberately. */}
          <span data-plan-line className="flex flex-wrap items-baseline gap-x-2">
            <span className={`${size} font-bold ${PLAN_TONE[line.tone]}`}>{line.name}</span>
            {line.tag && (
              <span className="whitespace-nowrap text-sm text-[#737a87]">{line.tag}</span>
            )}
          </span>
          {/* Outside the baseline group: an image aligned to a baseline sits its bottom on
              the text's and rides up. */}
          {line.tone === "bundle" && (
            <Image src="/portal/super-minty.png" alt="" width={60} height={56} unoptimized />
          )}
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
      className={`relative flex h-[88px] items-center justify-center gap-2 rounded-[32px] sm:h-[101px] sm:gap-3 ${
        greyed ? "bg-[#e7ecf0]" : "bg-[#e9f8f8]"
      }`}
    >
      {struck && (
        <s
          // Its own line height: a 22px line box reached down onto "/month".
          className="absolute right-5 top-2.5 text-base leading-none text-[#8b95a7] sm:right-8 sm:top-3 sm:text-[22px]"
          aria-label={`was ${struck}`}
        >
          {struck}
        </s>
      )}
      <span className="text-[28px] font-bold text-[#4fc7c7] sm:text-[35px]">{price}</span>
      <span className="text-base text-[#6b7280] sm:text-xl">/month</span>
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
      className={`${PANEL_PLACE} flex min-h-[300px] w-full flex-col items-center justify-center gap-6 rounded-xl bg-white p-5 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)] sm:p-8 lg:min-h-[469px]`}
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
  needsActivation,
  onChangePaymentMethod,
  onConfirmChange,
  onActivate,
}: {
  view: SummaryView;
  /** The company has no subscriber: the button below activates instead of confirming. */
  needsActivation: boolean;
  onChangePaymentMethod: () => void;
  onConfirmChange: (change: PendingChange) => void;
  onActivate: (change: PendingChange) => void;
}) {
  const changing = view.panel.kind === "changing";
  return (
    <section
      aria-label="Subscription Summary"
      className={`${PANEL_PLACE} flex w-full min-w-0 flex-col gap-6 rounded-xl p-5 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)] sm:p-8 ${
        changing ? "bg-[rgba(230,230,230,0.2)]" : "bg-white"
      }`}
    >
      <h3 className="text-xl font-bold text-black">Subscription Summary</h3>

      {view.panel.kind === "simple" ? (
        <>
          {/* Wraps: on a narrow panel the payment method drops below the plan. */}
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex flex-col gap-3">
              <p className="text-[15px] text-[#737a87]">Selected plan</p>
              <PlanLines lines={view.panel.lines} />
            </div>
            {view.paymentMethod && (
              <div className="flex flex-col items-end text-right">
                <p className="text-[15px] text-[#737a87]">Payment method</p>
                {/* The network's mark above the card it names, bare and at the design's size
                    (73 x 24), the same slot as the handover summary's (07-D). */}
                <CardBrand
                  brand={view.paymentMethod.network}
                  label={view.paymentMethod.brand}
                  fit="mark"
                  className={`mt-[19px] ${SUMMARY_MARK}`}
                />
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

      {/* ONE SLOT, TWO ACTS (the user, 2026-10-08). A company nobody pays for has to get a
          SUBSCRIBER before anything can be confirmed, so Activate Subscription takes Confirm
          Subscription Change's place here.

          BOTH ARE GATED ON A PENDING SELECTION (the user, same day, on seeing it under "No
          pending changes"): the button only appears once something is ticked, so this panel
          never offers an act over nothing. A company with nothing ticked is activated from its
          module settings page instead, where the card's own CTA asks.

          BOTH ALSO ASK IN THE SAME SECTION-06 MODAL (the user, same day) - the person is
          choosing the same modules either way and should read the same words - and both go on
          to Billing Accounts. They differ in ORDER, not in outcome: activating confirms
          billing FIRST, giving the company its subscriber, and then applies the very ticks the
          modal named (the user, same day: "the modal said you've chosen X, so do X). So it CAN
          charge, and either way the row lands on its 05.C result. */}
      {view.pendingChange &&
        (needsActivation ? (
          <button
            type="button"
            onClick={() => onActivate(view.pendingChange!)}
            className="h-14 rounded-2xl bg-[#4fc7c7] text-lg font-bold sm:h-[66px] sm:text-xl text-white hover:opacity-90"
          >
            {ACTIVATE_SUBSCRIPTION}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onConfirmChange(view.pendingChange!)}
            className="h-14 rounded-2xl bg-[#4fc7c7] text-lg font-bold sm:h-[66px] sm:text-xl text-white hover:opacity-90"
          >
            {CONFIRM_CHANGE}
          </button>
        ))}
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
  on,
}: {
  entity: PortalEntity;
  status: "loading" | "ready" | "error";
  /** The panel says "Calculating…": the page model is loading, or a tick was pressed just now. */
  calculating?: boolean;
  view: SummaryView | null;
  error: string | null;
  menu: MenuItem[];
  on: SummaryRowHandlers;
}) {
  const loading = status === "loading";
  // However it opened - a click on its row or its chevron, or `?entity=` - the open row is what
  // the person is looking at now: bring it to the top of the view (the user, 2026-10-02: "should
  // focus on the open row"), and put keyboard focus on its chevron. The closed row's "Open"
  // chevron unmounted with it, so focus fell to the page; it is only taken back from there, never
  // from a dialog or a field the list re-rendered behind.
  const ref = useRef<HTMLLIElement>(null);
  const chevron = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView?.({ block: "start", behavior: reduce ? "auto" : "smooth" });
    const active = document.activeElement;
    if (!active || active === document.body) chevron.current?.focus({ preventScroll: true });
  }, []);

  return (
    <li
      ref={ref}
      data-entity={entity.entity_id}
      data-open
      className="scroll-mt-[var(--list-sticky-top)] flex flex-col gap-6 rounded-xl bg-white px-4 pb-6 pt-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)] sm:gap-8 sm:px-8 sm:pb-8 sm:pt-10"
    >
      {/*
        The strip is the click target, not the whole `<li>`: the panel below holds the cards and
        their checkboxes, and a click there must never collapse the row.
      */}
      <div
        onClick={(e) => {
          if (!fromControl(e)) on.onClose();
        }}
        className="flex cursor-pointer items-center justify-between gap-4"
      >
        <h3 className="min-w-0 truncate text-xl font-bold text-black sm:text-[25px]">
          {entity.entity_name}
        </h3>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <button
            ref={chevron}
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

          {/* One column on a phone, the two cards side by side from `sm` with the panel below
              them, and the panel beside them from `lg` (it needs 360px of its own). */}
          <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_minmax(360px,1.45fr)]">
            {view.modules.map((module) => (
              <div
                key={module.code}
                className="flex min-w-0 flex-col items-center gap-5 lg:gap-[46px]"
              >
                <SummaryModuleCard
                  module={module}
                  // The card toggles what the box below it toggles - the same handler, so the
                  // two can never disagree. Nothing to tick, or the row still loading: inert.
                  onToggle={
                    module.tick === "start_trial" || loading
                      ? undefined
                      : () => on.onTick(module.code)
                  }
                />
                <UnderCard module={module} disabled={loading} on={on} />
              </div>
            ))}
            {calculating || loading ? (
              <CalculatingPanel />
            ) : (
              <SummaryPanel
                view={view}
                needsActivation={entity.has_subscriber === false}
                onChangePaymentMethod={on.onChangePaymentMethod}
                onConfirmChange={on.onConfirmChange}
                onActivate={on.onActivate}
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
