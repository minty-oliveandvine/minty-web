/**
 * A card's call to action in the design's three looks: filled (teal, white text), outline (teal
 * border and text) and link (teal text with an arrow). Labels come from the ModuleView; what
 * pressing it does is the hook's business.
 *
 * One button shape since frames 03-A, B and D were redesigned (2026-09-22): 248x66, radius
 * 24, a 1px outline for the outline look. Where it sits - inside the card, under it, or once
 * under the pair - is the grid's business. The link look is text with a chevron, on the same
 * 66px row.
 */

import { Icon } from "@/components/ui/Icon";

import type { ModuleCta as ModuleCtaModel } from "@/features/subscription/lib/moduleState";

const LOOK: Record<ModuleCtaModel["variant"], string> = {
  filled:
    "h-[66px] w-[248px] rounded-[24px] bg-secondary text-lg font-bold text-white hover:opacity-90",
  outline:
    "h-[66px] w-[248px] rounded-[24px] border border-secondary bg-white text-lg font-bold text-teal-strong hover:bg-[var(--card-live)]",
  // Same row height as the buttons, so a link beside one (03-D) centres on it.
  link: "inline-flex h-[66px] items-center gap-2 text-base font-bold text-teal-strong hover:underline",
};

export function ModuleCta({
  cta,
  onClick,
  busy = false,
}: {
  cta: ModuleCtaModel;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy || undefined}
      className={`${LOOK[cta.variant]} disabled:cursor-wait disabled:opacity-60`}
    >
      {cta.label}
      {cta.variant === "link" && <Icon name="chevron-right" size={16} />}
    </button>
  );
}
