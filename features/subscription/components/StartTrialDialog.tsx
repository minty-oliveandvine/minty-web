"use client";

/**
 * "Start Free Trial for {module}?" - asked from the list and from the module settings page
 * (Figma 04-G / 04-H; section 06's B-02): the module's name in its colour, the company, what a
 * trial means, Minty celebrating, Go back / Confirm. The shell is `ConfirmDialog`.
 *
 * The copy is the design's, word for word (2026-09-23, the user's call), including its "after
 * trial period" without the article - do not "correct" it here.
 *
 * The title's LOCKUP is a rule, not an accident: the first two lines are always "Start" and
 * "Free Trial for", and the module's name takes the third, wrapping if it is long ("Payment
 * Request" takes two lines in the 200px column, as the design draws it). The `{" "}` before
 * each break is load-bearing: without it the dialog's accessible name runs the lines together
 * ("StartFree Trial forPayment Request").
 */

import type { ModuleCode } from "@/features/subscription/api/moduleSettings";

import { ConfirmDialog } from "@/features/subscription/components/ConfirmDialog";

const MODULE_COLOUR: Record<ModuleCode, string> = {
  PETTY_CASH: "text-[#ea9713]",
  PAYMENT_REQUEST: "text-info",
};

export function StartTrialDialog({
  entityName,
  code,
  moduleName,
  busy,
  onConfirm,
  onBack,
}: {
  entityName: string;
  code: ModuleCode;
  moduleName: string;
  busy: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <ConfirmDialog
      title={
        <>
          <span className="whitespace-nowrap">Start</span> <br />
          <span className="whitespace-nowrap">Free Trial for</span> <br />
          <span className={MODULE_COLOUR[code]}>{moduleName}</span>
        </>
      }
      image="celebrating"
      entityName={entityName}
      busy={busy}
      confirmLabel="Confirm"
      onConfirm={onConfirm}
      onBack={onBack}
    >
      <p>
        You&apos;ve activated free trial for {moduleName}.
        <br />
        <br />
        You can activate the subscription anytime for uninterrupted access after trial period. You
        will be only charged after trial period.
      </p>
    </ConfirmDialog>
  );
}
