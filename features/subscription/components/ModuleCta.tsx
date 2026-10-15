/**
 * A card's call to action in the design's three looks: filled (teal, white text), outline (teal
 * border and text) and link (teal text with an arrow). Labels come from the ModuleView; what
 * pressing it does is the hook's business.
 *
 * Minty v2: filled is the Primary button, outline the Secondary, both 44px high and as wide as
 * the column they sit in. Where it sits - under the card, or once under the pair - is the grid's
 * business. The link look is a text button with a chevron, on the same 44px row.
 */

import { Icon } from "@/components/ui/Icon";

import type { ModuleCta as ModuleCtaModel } from "@/features/subscription/lib/moduleState";

const LOOK: Record<ModuleCtaModel["variant"], string> = {
  filled:
    "h-11 w-full rounded-xl bg-action px-4 text-body-m font-semibold text-white hover:bg-action-hover active:bg-action-pressed disabled:bg-action-disabled disabled:text-ink-disabled",
  outline:
    "h-11 w-full rounded-xl border border-line-selected bg-card px-4 text-body-m font-semibold text-link hover:bg-selected disabled:opacity-60",
  // Same row height as the buttons, so a link beside one (03-D) centres on it.
  link: "inline-flex min-h-11 items-center gap-2 self-center rounded-xl px-2 text-body-m font-semibold text-link hover:bg-hover disabled:opacity-60",
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
      className={`${LOOK[cta.variant]} disabled:cursor-wait`}
    >
      {cta.label}
      {cta.variant === "link" && <Icon name="chevron-right" size={16} />}
    </button>
  );
}
