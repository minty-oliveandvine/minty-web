/**
 * The teal banner at the top of the payer portal's pages (Figma 04: "Manage Subscriptions"),
 * with the design's "Back to the previous page" line above it.
 */

export function PortalHero({ title, onBack }: { title: string; onBack?: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="self-start text-base text-[var(--ink-soft)] hover:underline"
        >
          Back to the previous page
        </button>
      )}
      <div className="rounded-[32px] bg-gradient-to-r from-[#18c4c7] via-[#42ccc5] via-[74%] to-[#78d7c5] px-[54px] py-10">
        <h1 className="text-[40px] font-bold leading-none text-white">{title}</h1>
      </div>
    </div>
  );
}
