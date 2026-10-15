/**
 * One module's cell on a list row (Figma 04-A): the module's badge in a soft circle, then either
 * a button (Start Trial as a teal pill; Subscribe as a teal word under "Trial Expired") or the
 * state in words ("Trial / 3 days remaining", "Active", "Cancels 20 Aug", "Suspended").
 */

import Image from "next/image";

import type { ModuleCode } from "@/features/subscription/api/moduleSettings";
import type { ModuleCell } from "@/features/subscription/lib/portalRows";

const BADGE: Record<ModuleCode, { src: string; width: number; height: number; circle: string }> = {
  PETTY_CASH: { src: "/portal/petty-cash-icon.svg", width: 42, height: 45, circle: "bg-warning-bg" },
  PAYMENT_REQUEST: {
    src: "/portal/payment-request-icon.svg",
    width: 76,
    height: 76,
    circle: "bg-transparent",
  },
};

const TONE: Record<ModuleCell["tone"], string> = {
  accent: "text-warning",
  amber: "text-warning",
  muted: "text-ink-muted",
  teal: "text-link",
  quiet: "text-ink-muted",
};

export function ModuleBadge({ code }: { code: ModuleCode }) {
  const b = BADGE[code];
  return (
    <span
      className={`flex size-14 shrink-0 items-center justify-center rounded-full lg:size-[76px] ${b.circle}`}
      aria-hidden
    >
      {/* Drawn for the 76px circle: a share of it, so it shrinks with the circle below `lg`. */}
      <Image
        src={b.src}
        alt=""
        width={b.width}
        height={b.height}
        className="h-auto"
        style={{ width: `${(b.width / 76) * 100}%` }}
        unoptimized
      />
    </span>
  );
}

export function ModuleCellView({
  cell,
  entityName,
  className = "",
  onStartTrial,
  onSubscribe,
}: {
  cell: ModuleCell;
  entityName: string;
  /** Its place in the row's grid. */
  className?: string;
  onStartTrial: (code: ModuleCode) => void;
  onSubscribe: (code: ModuleCode) => void;
}) {
  const label = `${cell.name} · ${entityName}`;
  return (
    <div
      className={`flex min-w-0 items-center gap-4 lg:gap-6 ${className}`}
      data-module={cell.code}
      data-cell={cell.kind}
    >
      <ModuleBadge code={cell.code} />
      {cell.kind === "start_trial" ? (
        <button
          type="button"
          onClick={() => onStartTrial(cell.code)}
          aria-label={`Start Trial · ${label}`}
          className="h-11 shrink-0 rounded-lg bg-action px-4 text-body-m font-semibold text-white hover:bg-action-hover active:bg-action-pressed"
        >
          Start Trial
        </button>
      ) : cell.kind === "subscribe" ? (
        <div className="font-bold leading-tight">
          <p className="text-sm text-ink">{cell.eyebrow}</p>
          <button
            type="button"
            onClick={() => onSubscribe(cell.code)}
            aria-label={`Subscribe · ${label}`}
            className={`-mx-2 inline-flex min-h-11 items-center rounded-lg px-2 text-body-m font-semibold ${TONE.teal} hover:bg-hover`}
          >
            Subscribe
          </button>
        </div>
      ) : (
        <div className="font-bold leading-tight">
          {cell.eyebrow && <p className="text-sm text-ink">{cell.eyebrow}</p>}
          <p className={`text-xl ${TONE[cell.tone]}`}>{cell.text}</p>
        </div>
      )}
    </div>
  );
}
