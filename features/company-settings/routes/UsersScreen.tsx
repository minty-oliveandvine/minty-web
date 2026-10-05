"use client";

/**
 * `/entities/<shortid>/<name>/settings/users` - the company's people (Flask's Users tab until
 * phase 2, 2026-10-05): its members with their roles, the "Subscriber" tag, and the invitations
 * waiting. What each person may do is Flask's answer per row - change a role (at or below their
 * own), remove (accountant and up), invite (shop manager and up). Names are not edited here: each
 * person keeps their own in My Profile. Removing and cancelling ask first, in the modal family's
 * dialog.
 */

import { useState } from "react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

import type { Invitation, Member } from "@/features/company-settings/api/companySettings";
import { InviteDialog } from "@/features/company-settings/components/InviteDialog";
import { MemberRow } from "@/features/company-settings/components/MemberRow";
import { PendingInvitations } from "@/features/company-settings/components/PendingInvitations";
import { LoadState, ReadOnlyNotice, SettingsCard, SettingsShell } from "@/features/company-settings/components/SettingsShell";
import { useUsersTab } from "@/features/company-settings/hooks/useUsersTab";

export const USERS_COPY = {
  title: "Users",
  lead: "Who is in this company, what each person may do, and the invitations waiting.",
  members: "Members",
  membersLead: "Each person's role decides what they can do here.",
  invitations: "Invitations",
  invitationsLead: "Sent and not yet accepted.",
  invite: "Invite",
  viewOnly: "You can see who is here. Ask a Shop Manager or above to invite or change people.",
} as const;

export function UsersScreen({ company, flash }: { company: { id: string; name: string }; flash: string | null }) {
  const tab = useUsersTab(company.id, flash);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [cancelling, setCancelling] = useState<Invitation | null>(null);
  const page = tab.page;
  const shown = page?.company ?? company;

  return (
    <SettingsShell company={shown} modules={page?.modules ?? null} tab="users" title={USERS_COPY.title} lead={USERS_COPY.lead}>
      {tab.status !== "ready" || !page ? (
        <LoadState status={tab.status === "error" ? "error" : "loading"} error={tab.error} onRetry={tab.reload} />
      ) : (
        <>
          {!page.can_invite && !page.members.some((m) => m.can_change_role) ? <ReadOnlyNotice>{USERS_COPY.viewOnly}</ReadOnlyNotice> : null}
          <SettingsCard
            title={USERS_COPY.members}
            lead={USERS_COPY.membersLead}
            action={
              page.can_invite ? (
                <button
                  type="button"
                  onClick={() => setInviting(true)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-secondary px-4 text-sm font-semibold text-white transition-colors hover:bg-teal-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-strong"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden>
                    person_add
                  </span>
                  {USERS_COPY.invite}
                </button>
              ) : null
            }
          >
            <ul className="divide-y divide-gray-100" aria-label="Members">
              {page.members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  roles={page.roles}
                  busy={tab.busy === m.id}
                  onRole={(role) => void tab.setRole(m.id, role)}
                  onRemove={() => setRemoving(m)}
                />
              ))}
            </ul>
          </SettingsCard>
          {page.can_invite || page.invitations.length > 0 ? (
            <SettingsCard title={USERS_COPY.invitations} lead={USERS_COPY.invitationsLead}>
              <PendingInvitations
                invitations={page.invitations}
                cooldowns={tab.cooldowns}
                busy={tab.busy}
                onResend={(id) => void tab.resend(id)}
                onCancel={setCancelling}
              />
            </SettingsCard>
          ) : null}
        </>
      )}

      {inviting && page ? (
        <InviteDialog roles={page.roles} busy={tab.busy === "invite"} onSend={tab.invite} onClose={() => setInviting(false)} />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={`Remove ${`${removing.first_name} ${removing.last_name}`.trim() || removing.email}?`}
          image="sad"
          entityName={shown.name}
          busy={tab.busy === removing.id}
          confirmLabel="Remove"
          confirmTone="red"
          // Closes either way: a refusal is Flask's sentence in a toast, not a reason to keep asking.
          onConfirm={() => void tab.remove(removing.id).then(() => setRemoving(null))}
          onBack={() => setRemoving(null)}
        >
          <p className="mt-6 text-[15px] leading-snug">They lose access to this company straight away. Their account and their other companies stay as they are.</p>
        </ConfirmDialog>
      ) : null}
      {cancelling ? (
        <ConfirmDialog
          title="Cancel this invitation?"
          image="withdrawn"
          lead={<span className="break-all">{cancelling.email}</span>}
          busy={tab.busy === cancelling.id}
          confirmLabel="Cancel invitation"
          confirmTone="red"
          onConfirm={() => void tab.cancel(cancelling.id).then((done) => done && setCancelling(null))}
          onBack={() => setCancelling(null)}
        >
          <p className="mt-6 text-[15px] leading-snug">The link in their email stops working. You can invite them again later.</p>
        </ConfirmDialog>
      ) : null}
    </SettingsShell>
  );
}
