/**
 * One module's cell on a list row (Figma 04-A): the module's badge in a soft circle, then either
 * a button (Start Trial as a teal pill; Subscribe as a teal word under "Trial Expired") or the
 * state in words ("Trial / 3 days remaining", "Active", "Cancels 20 Aug", "Suspended").
 */

import Image from "next/image";

import type { ModuleCode } from "@/features/subscription/api/moduleSettings";
import type { ModuleCell } from "@/features/subscription/lib/portalRows";

const BADGE: Record<ModuleCode, { src: string; width: number; height: number; circle: string }> = {
  PETTY_CASH: { src: "/portal/petty-cash-icon.svg", width: 42, height: 45, circle: "bg-[#f7efd9]" },
  PAYMENT_REQUEST: {
    src: "/portal/payment-request-icon.svg",
    width: 76,
    height: 76,
    circle: "bg-transparent",
  },
};

const TONE: Record<ModuleCell["tone"], string> = {
  accent: "text-accent",
  amber: "text-[#cc7f03]",
  muted: "text-[#8c949e]",
  teal: "text-[#2e9b9b]",
  quiet: "text-quiet",
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
          className="h-11 rounded-full bg-secondary px-5 text-base font-bold text-white hover:opacity-90 lg:h-[54px] lg:px-6 lg:text-xl"
        >
          Start Trial
        </button>
      ) : cell.kind === "subscribe" ? (
        <div className="font-bold leading-tight">
          <p className="text-sm text-black">{cell.eyebrow}</p>
          <button
            type="button"
            onClick={() => onSubscribe(cell.code)}
            aria-label={`Subscribe · ${label}`}
            className={`text-xl ${TONE.teal} hover:underline`}
          >
            Subscribe
          </button>
        </div>
      ) : (
        <div className="font-bold leading-tight">
          {cell.eyebrow && <p className="text-sm text-black">{cell.eyebrow}</p>}
          <p className={`text-xl ${TONE[cell.tone]}`}>{cell.text}</p>
        </div>
      )}
    </div>
  );
}
