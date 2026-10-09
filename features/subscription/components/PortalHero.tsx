/**
 * The teal banner at the top of the payer portal's pages (Figma 04: "Manage Subscriptions"),
 * with the design's "Back to the previous page" line - drawn in the header bar, above the
 * banner's left edge (`PortalBack`).
 */

import { BACK_LINE_CLASS, PortalBack } from "@/features/subscription/components/PortalBack";

export function PortalHero({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <>
      {onBack && (
        <PortalBack>
          <button type="button" onClick={onBack} className={BACK_LINE_CLASS}>
            Back to the previous page
          </button>
        </PortalBack>
      )}
      <div className="rounded-2xl bg-selected p-5 sm:p-8">
        <h1 className="text-display-m font-bold text-ink sm:text-display-l">{title}</h1>
      </div>
    </>
  );
}
