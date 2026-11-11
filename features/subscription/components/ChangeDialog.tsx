"use client";

/**
 * A pending change's modal (Figma section 06): one of the seven shapes `lib/changeModal.ts`
 * builds, in the `ConfirmDialog` shell - the module's name in its colour (or the bundle's in
 * teal), Minty in the mood the change calls for, the design's sentences, and the confirming
 * button in its tone.
 *
 * A change that only cancels is asked here first: Go back, or its Confirm, which applies it. A
 * change that bills is asked in "Billing Accounts" first - which account pays - and shows here
 * only once it is paid (the owner, 2026-11-11), with one button (`hideBack`): its Confirm lands
 * the row on its result.
 */

import type { ChangeModal } from "@/features/subscription/lib/changeModal";
import type { ResultPart } from "@/features/subscription/lib/changeResult";

import { PLAN_TONE } from "@/features/subscription/components/ChangeResultView";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

function Part({ part }: { part: ResultPart }) {
  if (part.style === "plain") return <>{part.text}</>;
  if (part.style === "strong")
    return <strong className="font-bold text-[#16202e]">{part.text}</strong>;
  if (part.style === "company") return <span className="text-[#219994]">{part.text}</span>;
  return <span className={`font-bold ${PLAN_TONE[part.style]}`}>{part.text}</span>;
}

export function ChangeDialog({
  modal,
  entityName,
  busy,
  hideBack = false,
  onConfirm,
  onBack,
}: {
  modal: ChangeModal;
  entityName: string;
  busy: boolean;
  /** The change is already paid: one button, nothing to go back to. */
  hideBack?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  const { title } = modal;
  const bundle = title.module?.tone === "bundle";
  return (
    <ConfirmDialog
      title={
        <span data-modal={modal.kind}>
          {title.lead}
          {title.module && (
            <>
              {/* the space keeps the accessible name "Remove Petty Cash?" across the line break */}{" "}
              <br />
              <span className={bundle ? "text-[#18c4c7]" : PLAN_TONE[title.module.tone]}>
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
      confirmLabel={modal.confirmLabel}
      confirmTone={modal.confirmTone}
      hideBack={hideBack}
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
