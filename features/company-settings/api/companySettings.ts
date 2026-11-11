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

/**
 * The company already holding the Xero organisation a connect from here was refused for
 * (Flask's `?xero_conflict=`). One organisation belongs to one company, so the way on is to
 * free it there first - `can_move` is whether this person may, on THAT company.
 */
export type XeroConflict = {
  entity_id: string;
  entity_name: string;
  organisation: string | null;
  can_move: boolean;
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
  /** How Minty keeps the books (step 4): a `minty` company's connect matches its accounts first. */
  setup_mode?: "minty" | "xero" | null;
  /** A `minty` company's own accounts - what the matching page will ask about (SET-1b's count). */
  own_accounts?: number;
  /** Matching started and not finished: the accounts, or (after Finish) suppliers Xero refused. */
  matching?: { accounts: boolean; contacts: boolean };
  notices: Notice[];
  /** Only on a read that carried a refused connect; null the rest of the time. */
  xero_conflict: XeroConflict | null;
  message?: string;
};

const q = (entityId: string, extra: Record<string, string | undefined> = {}) => ({
  entity: entityId,
  ...extra,
});

export function fetchUsers(
  entityId: string,
  flash?: string | null,
  signal?: AbortSignal,
): Promise<UsersPage> {
  return mintyFetch<UsersPage>("/api/me/company/users", {
    query: q(entityId, { flash: flash || undefined }),
    signal,
  });
}

export function inviteMember(
  entityId: string,
  invite: { email: string; role: string; first_name: string; last_name: string },
): Promise<{ invitation_id: string; email_sent: boolean; message: string }> {
  return mintyFetch("/api/me/company/invitations", {
    method: "POST",
    query: q(entityId),
    json: invite,
  });
}

export function cancelInvitation(
  entityId: string,
  invitationId: string,
): Promise<{ message: string }> {
  return mintyFetch(`/api/me/company/invitations/${encodeURIComponent(invitationId)}/cancel`, {
    method: "POST",
    query: q(entityId),
  });
}

/** 429 = still cooling down: `ApiError.body.retry_after` says for how long. */
export function resendInvitation(
  entityId: string,
  invitationId: string,
): Promise<{ message: string; resend_cooldown: number }> {
  return mintyFetch(`/api/me/company/invitations/${encodeURIComponent(invitationId)}/resend`, {
    method: "POST",
    query: q(entityId),
  });
}

export function changeRole(
  entityId: string,
  memberId: string,
  role: string,
): Promise<{ message: string; role: string }> {
  return mintyFetch(`/api/me/company/users/${encodeURIComponent(memberId)}`, {
    method: "PATCH",
    query: q(entityId),
    json: { role },
  });
}

export function removeMember(entityId: string, memberId: string): Promise<{ message: string }> {
  return mintyFetch(`/api/me/company/users/${encodeURIComponent(memberId)}`, {
    method: "DELETE",
    query: q(entityId),
  });
}

export function fetchIntegration(
  entityId: string,
  flash?: string | null,
  conflict?: string | null,
  signal?: AbortSignal,
): Promise<IntegrationPage> {
  return mintyFetch<IntegrationPage>("/api/me/company/integration", {
    query: q(entityId, { flash: flash || undefined, xero_conflict: conflict || undefined }),
    signal,
  });
}

export function saveIntegration(
  entityId: string,
  changes: { name?: string; country_code?: string; currency_id?: string },
): Promise<IntegrationPage> {
  return mintyFetch<IntegrationPage>("/api/me/company/integration", {
    method: "PATCH",
    query: q(entityId),
    json: changes,
  });
}

export function disconnectXero(entityId: string): Promise<IntegrationPage> {
  return mintyFetch<IntegrationPage>("/api/me/company/xero/disconnect", {
    method: "POST",
    query: q(entityId),
  });
}

// ---- Match your accounts to Xero (Settings Phase 2, 2026-11-11; accounts-api hub/xero_matching.py) ----

export type MatchRow = {
  account_id: string;
  code: string;
  name: string;
  type: string | null;
  /** Which Xero accounts fit: a bank only a bank; otherwise the same class. */
  kind: string | null;
  /** An expense or bill line, a daily-closing account or a sales method uses it: Finish needs it matched. */
  used: boolean;
  system: boolean;
  pick: { xero_account_id: string; auto: boolean } | null;
  suggestion: string | null;
  /** Xero has the same code with another type: never picked for the person. */
  conflict: { code: string; name: string } | null;
  combined_with: string[];
};

export type MatchOption = { id: string; code: string; name: string; kind: string | null };

export type MatchingPage = {
  organisation: string | null;
  groups: { key: string; title: string; rows: MatchRow[] }[];
  options: MatchOption[];
  matched: number;
  total: number;
  /** Used accounts with no match - Finish is refused until it is 0. */
  blocking: number;
  will_archive: string[];
  will_combine: { xero: string; accounts: string[] }[];
  pending: { accounts: boolean; contacts: boolean };
  failed_contacts: string[];
  connected?: boolean;
  error?: string;
};

const MATCHING = "/api/me/company/xero/matching";

export function fetchMatching(entityId: string, signal?: AbortSignal): Promise<MatchingPage> {
  return mintyFetch<MatchingPage>(MATCHING, { query: q(entityId), signal });
}

export function pickMatch(
  entityId: string,
  accountId: string,
  xeroAccountId: string | null,
): Promise<MatchingPage> {
  return mintyFetch<MatchingPage>(MATCHING, {
    method: "PUT",
    query: q(entityId),
    json: { account_id: accountId, xero_account_id: xeroAccountId },
  });
}

export function refreshMatching(entityId: string): Promise<MatchingPage> {
  return mintyFetch<MatchingPage>(`${MATCHING}/refresh`, { method: "POST", query: q(entityId) });
}

export function finishMatching(entityId: string): Promise<MatchingPage> {
  return mintyFetch<MatchingPage>(`${MATCHING}/finish`, { method: "POST", query: q(entityId) });
}

export function retryContacts(entityId: string): Promise<MatchingPage> {
  return mintyFetch<MatchingPage>(`${MATCHING}/contacts`, { method: "POST", query: q(entityId) });
}

/**
 * Disconnect the OTHER company (`holderId`), freeing its Xero organisation for `entityId` -
 * the first half of the move; the caller then sends the person through Xero's consent screen
 * for `entityId`. Flask authorizes `holderId` on its own and refuses (403) when this person
 * may not disconnect it, whatever the dialog drew.
 */
export function releaseXero(entityId: string, holderId: string): Promise<{ message: string }> {
  return mintyFetch("/api/me/company/xero/release", {
    method: "POST",
    query: q(entityId),
    json: { entity_id: holderId },
  });
}
