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
      className={`flex size-[76px] shrink-0 items-center justify-center rounded-full ${b.circle}`}
      aria-hidden
    >
      <Image src={b.src} alt="" width={b.width} height={b.height} unoptimized />
    </span>
  );
}

export function ModuleCellView({
  cell,
  entityName,
  onStartTrial,
  onSubscribe,
}: {
  cell: ModuleCell;
  entityName: string;
  onStartTrial: (code: ModuleCode) => void;
  onSubscribe: (code: ModuleCode) => void;
}) {
  const label = `${cell.name} · ${entityName}`;
  return (
    <div className="flex min-w-0 items-center gap-6" data-module={cell.code} data-cell={cell.kind}>
      <ModuleBadge code={cell.code} />
      {cell.kind === "start_trial" ? (
        <button
          type="button"
          onClick={() => onStartTrial(cell.code)}
          aria-label={`Start Trial · ${label}`}
          className="h-[54px] rounded-full bg-secondary px-6 text-xl font-bold text-white hover:opacity-90"
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
