/**
 * A card's call to action in the design's three looks: filled (teal, white text), outline (teal
 * border and text) and link (teal text with an arrow). Labels come from the ModuleView; what
 * pressing it does is the hook's business.
 */

import { Icon } from "@/components/ui/Icon";

import type { ModuleCta as ModuleCtaModel } from "@/features/subscription/lib/moduleState";

const LOOK: Record<ModuleCtaModel["variant"], string> = {
  filled:
    "h-[50px] min-w-[214px] rounded-lg bg-secondary px-6 text-lg font-bold text-white hover:opacity-90",
  outline:
    "h-[50px] min-w-[214px] rounded-lg border-2 border-secondary bg-white px-6 text-lg font-bold text-teal-strong hover:bg-[var(--card-live)]",
  link: "inline-flex items-center gap-2 text-base font-bold text-teal-strong hover:underline",
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
