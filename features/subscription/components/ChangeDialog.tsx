"use client";

/**
 * A pending change's modal (Figma section 06): one of the seven shapes `lib/changeModal.ts`
 * builds, in the `ConfirmDialog` shell - the module's name in its colour (or the bundle's in
 * teal), Minty in the mood the change calls for, the design's sentences, and the confirming
 * button in its tone.
 *
 * Every change is asked here first (the user, 2026-09-29, the second time): Go back, or its
 * Confirm. For a change that bills, Confirm goes on to "Billing Accounts" - which account pays -
 * and the change is applied from there; for one that only cancels, it is applied at once.
 */

import type { ChangeModal } from "@/features/subscription/lib/changeModal";
import type { ResultPart } from "@/features/subscription/lib/changeResult";

import { PLAN_TONE } from "@/features/subscription/components/ChangeResultView";
import { pricedLabel } from "@/features/subscription/components/SubscriptionSummaryRow";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

function Part({ part }: { part: ResultPart }) {
  if (part.style === "plain") return <>{part.text}</>;
  if (part.style === "strong") return <strong className="font-bold text-ink">{part.text}</strong>;
  if (part.style === "company") return <span className="text-link">{part.text}</span>;
  return <span className={`font-bold ${PLAN_TONE[part.style]}`}>{part.text}</span>;
}

/** The shapes that only end something: their Confirm names no amount. */
const BILLS_NOTHING = new Set<ChangeModal["kind"]>(["remove", "cancel_subscription"]);

export function ChangeDialog({
  modal,
  entityName,
  busy,
  monthly = null,
  onConfirm,
  onBack,
}: {
  modal: ChangeModal;
  entityName: string;
  busy: boolean;
  /** What the change bills a month ("HKD 400"), when the screen already shows it (Part 15.19). */
  monthly?: string | null;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const { title } = modal;
  const bundle = title.module?.tone === "bundle";
  const confirmLabel = pricedLabel(
    modal.confirmLabel,
    BILLS_NOTHING.has(modal.kind) ? null : monthly,
  );
  return (
    <ConfirmDialog
      title={
        <span data-modal={modal.kind}>
          {title.lead}
          {title.module && (
            <>
              {/* the space keeps the accessible name "Remove Petty Cash?" across the line break */}{" "}
              <br />
              <span className={bundle ? "text-ink" : PLAN_TONE[title.module.tone]}>
                {title.module.name}
              </span>
            </>
          )}
          {title.tail}
        </span>
      }
      image={modal.image}
      entityName={entityName}
      busy={busy}
      confirmLabel={confirmLabel}
      confirmTone={modal.confirmTone}
      // Removing a module cannot be undone from here: Danger. Every other change is Primary.
      confirmVariant={modal.kind === "remove" ? "danger" : undefined}
      onConfirm={onConfirm}
      onBack={onBack}
    >
      {modal.paragraphs.map((parts, i) => (
        <p key={i}>
          {parts.map((part, j) => (
            <Part key={j} part={part} />
          ))}
        </p>
      ))}
    </ConfirmDialog>
  );
}
