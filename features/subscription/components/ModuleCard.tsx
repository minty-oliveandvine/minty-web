/**
 * A module's card, in the onboarding wizard's design (minty-onboarding-web, step 2's
 * `.mp-*` cards; since 2026-10-02 every module card here is that card): a 3px frame - grey, or
 * the teal gradient and glow when the card is live - around a 360px card washed in the module's
 * own accent, the illustration filling its top, the name under it, the status pinned to the
 * bottom edge, and the description over the whole card on hover. `ModuleCardShell` is that card;
 * `ModuleCard` is the module settings page's (Figma 03) and `SummaryModuleCard` the open row's
 * (05·A). Everything shown is a ModuleView (`lib/moduleState.ts`) - no card flags are read here.
 */

import Image from "next/image";
import type { ReactNode } from "react";

import type { ModuleCode } from "@/features/subscription/api/moduleSettings";
import type { ModuleStatusLine, ModuleView } from "@/features/subscription/lib/moduleState";

/**
 * Each module's illustration and accent, as onboarding draws them (its `MODULES`: the same two
 * 556x384 PNGs, `pettycash-icon.png` / `payment-icon.png`, and the same two accents).
 * `width`/`height` are the PNG's own pixels, not the drawn size.
 */
export const MODULE_ART: Record<ModuleCode, { src: string; width: number; height: number; accent: string }> = {
  PETTY_CASH: { src: "/modules/petty-cash.png", width: 556, height: 384, accent: "#f5b945" },
  PAYMENT_REQUEST: { src: "/modules/payment-request.png", width: 556, height: 384, accent: "#3aa6f5" },
};

/** The card's frame and its inner card, outer edge to outer edge: 360 + 2 x 3px. */
export const MODULE_CARD_HEIGHT = "h-[366px]";

export function ModuleCardShell({
  code,
  name,
  description,
  selected,
  status,
  footer,
  onClick,
  data,
}: {
  code: ModuleCode;
  name: string;
  description: string;
  /** Onboarding's "selected": the teal gradient frame, its glow and the teal status line. */
  selected: boolean;
  status: ReactNode;
  /** Under the status, pinned with it (the open row's chip slot); the name makes room for it. */
  footer?: ReactNode;
  /** A pointer affordance only (the open row's tick); a card with one lifts on hover. */
  onClick?: () => void;
  data: Record<`data-${string}`, string | boolean>;
}) {
  const art = MODULE_ART[code];
  const frame = selected
    ? "bg-[linear-gradient(90deg,#00cbc6_0%,#00d5bf_100%)] shadow-[0_12px_32px_rgba(0,203,198,0.28)]"
    : "bg-[#ececea]";
  const lift = onClick
    ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,20,25,0.08)]"
    : "";
  return (
    <article
      aria-label={name}
      {...data}
      onClick={onClick}
      className={`group relative w-full rounded-[23px] p-[3px] transition-[background,transform,box-shadow] duration-200 motion-reduce:transform-none motion-reduce:transition-none ${frame} ${lift}`}
    >
      <div
        className="relative flex h-[360px] w-full flex-col items-center overflow-hidden rounded-[20px]"
        style={{
          background: `linear-gradient(150deg, color-mix(in oklab, ${art.accent} 12%, white), white 65%)`,
        }}
      >
        <div className="flex min-h-0 w-full flex-auto items-center justify-center px-5 pt-5">
          {/* Served as committed: Next's optimizer re-encoding to webp hung the request on a
              Windows dev box (curl with a browser Accept header timed out at 20 s). */}
          <Image
            src={art.src}
            alt=""
            width={art.width}
            height={art.height}
            className="block h-auto max-h-full w-[92%] object-contain"
            priority
            unoptimized
          />
        </div>
        {/* Inset so a long name balances over two lines; the margin is the room the pinned
            status (and the chip, when there is one) takes at the bottom. */}
        <h3
          className={`mt-2 px-[34px] text-center text-[26px] font-bold leading-tight tracking-[-0.015em] text-balance text-[#16202e] ${
            footer === undefined ? "mb-[86px]" : "mb-[118px]"
          }`}
        >
          {name}
        </h3>
        {/* Pinned, not flowing after the name: both cards' status lines line up however their
            names wrap. */}
        <div
          className={`absolute inset-x-0 bottom-[26px] flex flex-col items-center gap-0.5 text-center text-xl font-bold leading-[1.2] ${
            selected ? "text-[#18c4c7]" : "text-[#8a8d8b]"
          }`}
        >
          {status}
          {footer !== undefined && <div className="mt-2 flex h-[26px] items-center">{footer}</div>}
        </div>
        {/* The description, over the whole card on hover. Inert, so a click lands on the card. */}
        <div className="pointer-events-none absolute inset-0 z-[2] flex translate-y-2 flex-col justify-center gap-2.5 bg-white/95 p-7 text-center opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none">
          <p aria-hidden className="text-xl font-bold tracking-[-0.01em] text-[#16202e]">
            {name}
          </p>
          <p className="whitespace-pre-line text-[15px] leading-[1.55] text-[#4a4d4b]">{description}</p>
        </div>
      </div>
    </article>
  );
}

/**
 * The status in the card's colours: the eyebrow takes the card's (grey, or teal when live); a
 * state with a colour of its own - an urgent trial, a cancellation pending, a trial on offer -
 * keeps it on its value line.
 */
export function ModuleStatus({
  status,
  tone,
}: {
  status: ModuleStatusLine;
  tone: Record<ModuleStatusLine["tone"], string>;
}) {
  return (
    <>
      {status.eyebrow && <p>{status.eyebrow}</p>}
      <p className={tone[status.tone]}>{status.text}</p>
    </>
  );
}

const TONE: Record<ModuleStatusLine["tone"], string> = {
  accent: "text-accent",
  teal: "",
  muted: "",
  info: "text-info",
  plain: "text-black",
};

/** The module settings page's card (Figma 03); its CTA is drawn under it by the grid. */
export function ModuleCard({ view }: { view: ModuleView }) {
  return (
    <ModuleCardShell
      code={view.code}
      name={view.name}
      description={view.description}
      selected={view.live}
      status={<ModuleStatus status={view.status} tone={TONE} />}
      data={{ "data-module": view.code, "data-state": view.state }}
    />
  );
}
