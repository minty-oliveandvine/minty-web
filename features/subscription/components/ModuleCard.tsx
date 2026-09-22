/**
 * One module's card (Figma 03: illustration tile, name, description, status). Two looks: live
 * (teal) when the module is in trial, active or winding down; inactive (grey, illustration
 * dimmed) when it never started, expired or is suspended. Everything it shows is a ModuleView
 * (`lib/moduleState.ts`) - no card flags are read here.
 *
 * The card's height is the page's look (`pageLook`): frame 03-A (node 1410:2611) is 300x504
 * and draws the CTA inside the card, passed as `children`, on the bottom edge; every other
 * frame's cards end under the status line and keep the CTA below the card. On one page every
 * card is the same height either way - the status block is a fixed box.
 */

import Image from "next/image";
import type { ReactNode } from "react";

import type { ModuleCode } from "@/features/subscription/api/moduleSettings";
import type {
  ModuleStatusLine,
  ModuleView,
  PageLook,
} from "@/features/subscription/lib/moduleState";

/** Each module's illustration and tile (shared with the open row's cards, Figma 05·A). */
export const MODULE_ART: Record<ModuleCode, { src: string; size: number; tile: string }> = {
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
  plain: "text-black",
};

export function ModuleCard({
  view,
  look,
  children,
}: {
  view: ModuleView;
  look: PageLook;
  children?: ReactNode;
}) {
  const art = MODULE_ART[view.code];
  const frame = view.live
    ? "border-2 border-[var(--card-live-border)] bg-[var(--card-live)]"
    : "border border-[var(--card-off-border)] bg-[var(--card-off)]";
  // Fixed either way: with auto height the live card's 2px border made it 2px taller than
  // the inactive card beside it (frame 03-D). 402 is the live card's natural height.
  const height = look === "inline" ? "h-[504px]" : "h-[402px]";

  return (
    <article
      aria-label={view.name}
      data-module={view.code}
      data-state={view.state}
      className={`flex ${height} w-[300px] flex-col items-center rounded-[20px] px-6 pb-8 pt-[31px] text-center ${frame}`}
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
      {/* A fixed box (216px to 318px from the card's top) so the status line sits at the same
          height on every card however many lines the description wraps to; a newline in the
          copy is honoured (the design breaks Petty Cash's after "expenses,"). */}
      <p className="mt-4 h-[102px] whitespace-pre-line text-base leading-normal text-black">
        {view.description}
      </p>
      {/* A fixed 48px box too (the tallest variant: a 20px eyebrow over a 20px line), so cards
          in different states are the same height on a page whose CTAs sit under them. */}
      <div className="h-12 font-bold">
        {view.status.eyebrow && (
          // "Get Started" is drawn as large as its value line; the other eyebrows are small.
          <p className={view.status.tone === "info" ? "text-xl text-quiet" : "text-sm text-black"}>
            {view.status.eyebrow}
          </p>
        )}
        <p className={`text-xl ${TONE[view.status.tone]}`}>{view.status.text}</p>
      </div>
      {children && <div className="mt-auto w-full">{children}</div>}
    </article>
  );
}
