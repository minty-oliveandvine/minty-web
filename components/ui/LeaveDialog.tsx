"use client";

/**
 * "Leave without saving?" (Figma A-11, on the `ConfirmDialog` shell): a page with changes not
 * saved yet, and the person goes somewhere. "Discard changes" puts the saved state back and goes
 * on; "Go Back", Escape and the backdrop only close the dialog - so the safe answer sits in the
 * CONFIRM slot and the destructive one in the back slot, deliberately.
 *
 * `lib/leaveGuard.ts` is what asks: which pages arm it, and what each exit does, is its header.
 * It lives here rather than in a feature because `features/company-settings` and
 * `features/subscription` both ask, and a feature may only reach `lib/**` and `components/ui/**`
 * (eslint.config.mjs).
 *
 * Copied to minty-payment-request-web (`features/subscription/components/InterruptedDialogs.tsx`)
 * and ported to Flask (Minty `static/js/minty_dialog.js` `MintyLeaveGuard` +
 * `static/css/minty_dialog.css`) - change all three.
 */

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export const LEAVE_TITLE = "Leave without saving?";
export const LEAVE_BODY_1 = "You have unsaved changes.";
export const LEAVE_BODY_2 = "Your changes will be lost if you leave this page.";
export const DISCARD_CHANGES = "Discard changes";
export const GO_BACK_UPPER = "Go Back";

export function LeaveDialog({ onDiscard, onStay }: { onDiscard: () => void; onStay: () => void }) {
  return (
    <ConfirmDialog
      title={<span data-modal="leave">{LEAVE_TITLE}</span>}
      image="dont"
      busy={false}
      confirmLabel={GO_BACK_UPPER}
      confirmTone="teal"
      backLabel={DISCARD_CHANGES}
      backTone="teal"
      onConfirm={onStay}
      onBack={onDiscard}
      onDismiss={onStay}
    >
      <p>{LEAVE_BODY_1}</p>
      <p>{LEAVE_BODY_2}</p>
    </ConfirmDialog>
  );
}
