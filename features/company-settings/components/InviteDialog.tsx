"use client";

/**
 * Invite someone: their address (English only - `lib/emailInput.ts`), the role (only those this
 * person may give), and their first and last names - required: a new invitee's account is made from them when they
 * sign in by code. On the modal family's frame (`components/ui/ModalFrame`), in the sheet's
 * field and button look; Enter sends.
 */

import { useId, useState, type FormEvent } from "react";

import { ModalFrame } from "@/components/ui/ModalFrame";
import { RequiredMark } from "@/components/ui/RequiredMark";
import {
  SHEET_FIELD,
  SHEET_GHOST,
  SHEET_INPUT,
  SHEET_INPUT_OK,
  SHEET_LABEL,
  SHEET_PAIR,
  SHEET_PAIR_BACK,
  SHEET_PAIR_MAIN,
  SHEET_PRIMARY,
} from "@/components/ui/sheetClasses";
import { EMAIL_ASCII_HINT, isEmail, useEmailInput } from "@/lib/emailInput";

import type { RoleOption } from "@/features/company-settings/api/companySettings";

export function InviteDialog({
  roles,
  busy,
  onSend,
  onClose,
}: {
  roles: RoleOption[];
  busy: boolean;
  /** Resolves true when the invitation went in - the dialog then closes. */
  onSend: (invite: { email: string; role: string; first_name: string; last_name: string }) => Promise<boolean>;
  onClose: () => void;
}) {
  const titleId = useId();
  const [email, setEmail] = useState("");
  const emailInput = useEmailInput(setEmail);
  const [role, setRole] = useState(roles[roles.length - 1]?.value ?? "");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const canSend = isEmail(email) && Boolean(role) && firstName.trim() !== "" && lastName.trim() !== "" && !busy;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    if (await onSend({ email, role, first_name: firstName.trim(), last_name: lastName.trim() })) onClose();
  };

  return (
    <ModalFrame labelledBy={titleId} busy={busy} onDismiss={onClose} dismissLabel="Close" className="max-w-[440px] rounded-[20px] bg-white p-6 shadow-xl sm:p-8">
      <h2 id={titleId} className="text-[22px] font-bold text-ink">
        Invite someone
      </h2>
      <p className="mt-1 text-sm text-ink-soft">They get an email with a link to join this company.</p>
      <form className="mt-5" onSubmit={(e) => void send(e)} noValidate>
        <div className={SHEET_FIELD}>
          <label htmlFor={`${titleId}-email`} className={SHEET_LABEL}>
            Email
            <RequiredMark />
          </label>
          <input id={`${titleId}-email`} {...emailInput.props} aria-required="true" className={`${SHEET_INPUT} ${SHEET_INPUT_OK}`} value={email} placeholder="jane@example.com" />
          {emailInput.rejected ? <p className="mt-1.5 text-[12.5px] text-danger">{EMAIL_ASCII_HINT}</p> : null}
        </div>
        <div className={SHEET_FIELD}>
          <label htmlFor={`${titleId}-role`} className={SHEET_LABEL}>
            Role
            <RequiredMark />
          </label>
          <select id={`${titleId}-role`} aria-required="true" className={`${SHEET_INPUT} ${SHEET_INPUT_OK}`} value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <div className={SHEET_FIELD}>
            <label htmlFor={`${titleId}-first`} className={SHEET_LABEL}>
              First name
              <RequiredMark />
            </label>
            <input id={`${titleId}-first`} type="text" aria-required="true" autoComplete="off" maxLength={100} className={`${SHEET_INPUT} ${SHEET_INPUT_OK}`} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className={SHEET_FIELD}>
            <label htmlFor={`${titleId}-last`} className={SHEET_LABEL}>
              Last name
              <RequiredMark />
            </label>
            <input id={`${titleId}-last`} type="text" aria-required="true" autoComplete="off" maxLength={100} className={`${SHEET_INPUT} ${SHEET_INPUT_OK}`} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className={SHEET_PAIR}>
          <button type="button" className={`${SHEET_GHOST} ${SHEET_PAIR_BACK}`} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={`${SHEET_PRIMARY} ${SHEET_PAIR_MAIN}`} disabled={!canSend}>
            {busy ? "Sending…" : "Send invitation"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
