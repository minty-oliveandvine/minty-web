/**
 * The two tabs' calls: Flask's bearer routes `/api/me/company/*` (Minty
 * `blueprints/entity/routes/hub_settings.py`). The company travels as `?entity=` on every call -
 * the one place Flask reads it from - and is checked against the person's memberships there.
 * A refusal rejects with `ApiError` carrying Flask's own sentence.
 */

import { mintyFetch } from "@/lib/apiClient";

export type Notice = { category: "success" | "error" | "warning" | "info"; message: string };

export type RoleOption = { value: string; label: string };

export type Member = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  initials: string;
  role: string;
  role_label: string | null;
  /** The person whose card pays for the company. */
  subscriber: boolean;
  is_you: boolean;
  can_change_role: boolean;
  can_remove: boolean;
};

export type Invitation = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  role_label: string | null;
  created_at: string | null;
  /** Seconds before it may be sent again. */
  resend_cooldown: number;
  can_manage: boolean;
};

export type UsersPage = {
  company: { id: string; name: string };
  modules: string[];
  members: Member[];
  invitations: Invitation[];
  /** The roles this person may give - at or below their own. */
  roles: RoleOption[];
  can_invite: boolean;
  notices: Notice[];
};

export type IntegrationPage = {
  company: { id: string; name: string; country_code: string | null; currency_id: string | null };
  modules: string[];
  countries: { code: string; name: string }[];
  currencies: { id: string; name: string }[];
  xero: {
    status: string;
    connected: boolean;
    needs_reconnect: boolean;
    organisation: string | null;
    last_connected_at: string | null;
  };
  can_edit: boolean;
  can_rename: boolean;
  notices: Notice[];
  message?: string;
};

const q = (entityId: string, extra: Record<string, string | undefined> = {}) => ({ entity: entityId, ...extra });

export function fetchUsers(entityId: string, flash?: string | null, signal?: AbortSignal): Promise<UsersPage> {
  return mintyFetch<UsersPage>("/api/me/company/users", { query: q(entityId, { flash: flash || undefined }), signal });
}

export function inviteMember(
  entityId: string,
  invite: { email: string; role: string; first_name: string; last_name: string },
): Promise<{ invitation_id: string; email_sent: boolean; message: string }> {
  return mintyFetch("/api/me/company/invitations", { method: "POST", query: q(entityId), json: invite });
}

export function cancelInvitation(entityId: string, invitationId: string): Promise<{ message: string }> {
  return mintyFetch(`/api/me/company/invitations/${encodeURIComponent(invitationId)}/cancel`, {
    method: "POST",
    query: q(entityId),
  });
}

/** 429 = still cooling down: `ApiError.body.retry_after` says for how long. */
export function resendInvitation(entityId: string, invitationId: string): Promise<{ message: string; resend_cooldown: number }> {
  return mintyFetch(`/api/me/company/invitations/${encodeURIComponent(invitationId)}/resend`, {
    method: "POST",
    query: q(entityId),
  });
}

export function changeRole(entityId: string, memberId: string, role: string): Promise<{ message: string; role: string }> {
  return mintyFetch(`/api/me/company/users/${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    query: q(entityId),
    json: { role },
  });
}

export function removeMember(entityId: string, memberId: string): Promise<{ message: string }> {
  return mintyFetch(`/api/me/company/users/${encodeURIComponent(memberId)}`, { method: "DELETE", query: q(entityId) });
}

export function fetchIntegration(entityId: string, flash?: string | null, signal?: AbortSignal): Promise<IntegrationPage> {
  return mintyFetch<IntegrationPage>("/api/me/company/integration", {
    query: q(entityId, { flash: flash || undefined }),
    signal,
  });
}

export function saveIntegration(
  entityId: string,
  changes: { name?: string; country_code?: string; currency_id?: string },
): Promise<IntegrationPage> {
  return mintyFetch<IntegrationPage>("/api/me/company/integration", { method: "PATCH", query: q(entityId), json: changes });
}

export function disconnectXero(entityId: string): Promise<IntegrationPage> {
  return mintyFetch<IntegrationPage>("/api/me/company/xero/disconnect", { method: "POST", query: q(entityId) });
}
