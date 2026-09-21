/**
 * One module's card (Figma 03: illustration tile, name, description, status). Two looks: live
 * (teal) when the module is in trial, active or winding down; inactive (grey, illustration
 * dimmed) when it never started, expired or is suspended. Everything it shows is a ModuleView
 * (`lib/moduleState.ts`) - no card flags are read here.
 */

import Image from "next/image";

import type { ModuleCode } from "@/features/subscription/api/moduleSettings";
import type { ModuleStatusLine, ModuleView } from "@/features/subscription/lib/moduleState";

const ART: Record<ModuleCode, { src: string; size: number; tile: string }> = {
  PETTY_CASH: { src: "/modules/petty-cash.png", size: 80, tile: "bg-[var(--tile-petty)]" },
  PAYMENT_REQUEST: {
    src: "/modules/payment-request.png",
    size: 95,
    tile: "bg-[var(--tile-payment)]",
  },
};

const TONE: Record<ModuleStatusLine["tone"], string> = {
  accent: "text-accent",
  teal: "text-teal-strong",
  muted: "text-quiet",
  info: "text-info",
};

export function ModuleCard({ view }: { view: ModuleView }) {
  const art = ART[view.code];
  const frame = view.live
    ? "border-2 border-[var(--card-live-border)] bg-[var(--card-live)]"
    : "border border-[var(--card-off-border)] bg-[var(--card-off)]";

  return (
    <article
      aria-label={view.name}
      data-module={view.code}
      data-state={view.state}
      className={`flex w-[300px] flex-col items-center rounded-[20px] px-6 pb-8 pt-[31px] text-center ${frame}`}
    >
      <div
        className={`flex h-[120px] w-[167px] items-center justify-center rounded-[13px] ${art.tile} ${
          view.live ? "" : "opacity-50"
        }`}
      >
        {/* Two 5 KB PNGs: the optimizer would re-encode them to webp for nothing, and on a
            Windows dev box that re-encode hung the request (curl with a browser Accept header
            timed out at 20 s; the plain PNG answered in 6 ms). Served as committed. */}
        <Image src={art.src} alt="" width={art.size} height={art.size} priority unoptimized />
      </div>
      <h2 className="mt-4 text-[26px] font-bold leading-tight text-ink">{view.name}</h2>
      <p className="mt-2 text-base text-black">{view.description}</p>
      <div className="mt-9 font-bold">
        {view.status.eyebrow && (
          <p className={`text-sm ${view.status.tone === "info" ? "text-quiet" : "text-black"}`}>
            {view.status.eyebrow}
          </p>
        )}
        <p className={`text-xl ${TONE[view.status.tone]}`}>{view.status.text}</p>
      </div>
    </article>
  );
}
