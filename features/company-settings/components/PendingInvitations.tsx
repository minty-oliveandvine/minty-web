/**
 * Invitations sent and not yet accepted: the address and role, Resend (counting down Flask's
 * cooldown) and Cancel, where this person may manage that invitation (its role at or below their
 * own). Drawn by React - an address is text, never markup.
 */

import type { Invitation } from "@/features/company-settings/api/companySettings";

const BUTTON =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-strong disabled:cursor-not-allowed disabled:opacity-50";

export function PendingInvitations({
  invitations,
  cooldowns,
  busy,
  onResend,
  onCancel,
}: {
  invitations: Invitation[];
  cooldowns: Record<string, number>;
  busy: string | null;
  onResend: (id: string) => void;
  onCancel: (invitation: Invitation) => void;
}) {
  if (invitations.length === 0) {
    return <p className="text-sm text-gray-500">No invitations waiting.</p>;
  }
  return (
    <ul className="divide-y divide-gray-100" aria-label="Pending invitations">
      {invitations.map((inv) => {
        const wait = cooldowns[inv.id] ?? 0;
        const name = `${inv.first_name} ${inv.last_name}`.trim();
        return (
          <li key={inv.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900">{inv.email}</p>
              <p className="truncate text-sm text-gray-500">
                {[name, inv.role_label ?? inv.role].filter(Boolean).join(" · ")}
              </p>
            </div>
            {inv.can_manage ? (
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className={`${BUTTON} border border-gray-300 text-ink hover:bg-gray-50`}
                  disabled={busy === inv.id || wait > 0}
                  onClick={() => onResend(inv.id)}
                >
                  {wait > 0 ? `Resend in ${wait}s` : "Resend"}
                </button>
                <button
                  type="button"
                  className={`${BUTTON} text-red-600 hover:bg-red-50`}
                  disabled={busy === inv.id}
                  onClick={() => onCancel(inv)}
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
