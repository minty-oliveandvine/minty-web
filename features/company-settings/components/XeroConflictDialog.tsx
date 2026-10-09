"use client";

/**
 * "That Xero organisation is already in use" - the answer to a Connect that Flask refused
 * because another company already holds the organisation the person picked on Xero.
 *
 * One organisation belongs to one company. Until 2026-10-09 connecting an organisation your
 * own other company held unlinked it silently and reported a success, so the other company
 * lost Xero with nobody told; now nothing moves unless it is asked for here. The move is two
 * steps because the grant the refused attempt created was handed back to Xero: free the
 * organisation on the other company, then go through Xero's consent screen again for this
 * one. The button says so, and the second step is a navigation - which is why a failure is
 * shown in the card rather than as a toast that would not outlive it.
 *
 * Without permission on the other company there is nothing to offer, so the card names it
 * and the only way out is Close.
 */

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

import type { XeroConflict } from "@/features/company-settings/api/companySettings";

export function XeroConflictDialog({
  conflict,
  companyName,
  busy,
  error,
  onMove,
  onClose,
}: {
  conflict: XeroConflict;
  /** The company being connected - the one the organisation would move TO. */
  companyName: string;
  busy: boolean;
  error: string;
  onMove: () => void;
  onClose: () => void;
}) {
  const org = conflict.organisation?.trim();
  return (
    <ConfirmDialog
      title="That Xero organisation is taken"
      image="dont"
      entityName={conflict.entity_name}
      busy={busy}
      // One button when there is nothing to offer: Close is the only way on.
      hideBack={!conflict.can_move}
      confirmLabel={conflict.can_move ? "Move it here" : "Close"}
      confirmTone={conflict.can_move ? "orange" : "teal"}
      backLabel="Go back"
      onConfirm={conflict.can_move ? onMove : onClose}
      onBack={onClose}
      // Escape and the backdrop close it either way: nothing has changed yet.
      onDismiss={onClose}
    >
      <p>
        {org ? <strong className="font-semibold">{org}</strong> : "That Xero organisation"} is already connected to{" "}
        <strong className="font-semibold">{conflict.entity_name}</strong>, and a Xero organisation can only be linked to
        one company at a time.
      </p>
      {conflict.can_move ? (
        <p>
          I can disconnect it from {conflict.entity_name} and take you to Xero to connect it to{" "}
          <strong className="font-semibold">{companyName}</strong> instead. {conflict.entity_name} stops publishing to
          Xero, and the Xero accounts and contacts kept for it are cleared.
        </p>
      ) : (
        <p>
          Ask an accountant or admin of {conflict.entity_name} to disconnect it from Xero there first, then connect{" "}
          <strong className="font-semibold">{companyName}</strong> again.
        </p>
      )}
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : null}
    </ConfirmDialog>
  );
}
