"use client";

/**
 * "Start Free Trial for {module}?" - asked straight from the list (Figma 04-G / 04-H; section
 * 06's B-02): the module's name in its colour, the company, what a trial means, Minty
 * celebrating, Go back / Confirm. The shell is `ConfirmDialog`.
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
          Start
          <br />
          Free Trial for
          <br />
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
        You&apos;re activating the free trial for {moduleName}.
        <br />
        <br />
        You can activate the subscription anytime for uninterrupted access after the trial period.
        You will only be charged after the trial period.
      </p>
    </ConfirmDialog>
  );
}
