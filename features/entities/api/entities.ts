/**
 * The entity list's one read: Flask's `GET /api/me/entities` (Minty's
 * `blueprints/entity/routes/me_api.py`), the same builder the Jinja list draws from
 * (`services/entity_list.build_entity_list`), so the two cannot disagree.
 *
 * Person-scoped: the token's company is ignored, and the list is every company the person
 * belongs to (every company, for a superuser). `flash` is the signed hand-over Flask puts on
 * the URL when it sends the browser here from its /entity - what a redirect flashed on the way
 * comes back as `notices`, so nothing it said is lost.
 */

import { mintyFetch } from "@/lib/apiClient";

/** `entity_status`: still in the onboarding wizard, or live with / without Xero linked. */
export type EntityStatus = "onboarding" | "connected" | "disconnected";

export type EntityRow = {
  id: string;
  name: string;
  status: EntityStatus;
  /** Module codes switched on (`PETTY_CASH`, `PAYMENT_REQUEST`) - fail-closed on Flask's side. */
  modules: string[];
  /** The subset running on a free trial - never a module that is not in `modules`. */
  trial_modules: string[];
  /** Their display names, for the badge's "Free trial: …". */
  trial_module_names: string[];
  /** ISO instant (UTC) of the last time anyone opened it, or null when nobody has. */
  last_accessed_at: string | null;
  last_accessed_by: string | null;
  /**
   * ISO instant the company was archived, or null while it is active. Only a superuser is ever
   * sent an archived company (everyone else's list leaves them out); an older API omits it.
   */
  archived_at?: string | null;
  /**
   * The caller's own role on the company (`admin`, `accountant`, ...), or `superadmin` where a
   * superuser holds no membership.
   */
  role?: string;
};

/** Flask's flash categories, already read the way its own toasts read them. */
export type EntityNotice = { category: "success" | "error" | "warning" | "info"; message: string };

export type EntityListAnswer = {
  entities: EntityRow[];
  notices: EntityNotice[];
  /** A superuser may filter by archived state and restore; an older API omits it (false). */
  is_superuser?: boolean;
};

/** Which companies a superuser's list shows; the API ignores it for everyone else. */
export type ArchivedFilter = "all" | "active" | "archived";

export function fetchEntities({
  flash,
  archived,
  signal,
}: {
  flash?: string | null;
  archived?: ArchivedFilter;
  signal?: AbortSignal;
} = {}): Promise<EntityListAnswer> {
  return mintyFetch<EntityListAnswer>("/api/me/entities", {
    query: { flash: flash || undefined, archived },
    signal,
  });
}

/** Bring an archived company back (superusers only); the API's sentence comes back as `message`. */
export function restoreEntity(entityId: string): Promise<{ message: string }> {
  return mintyFetch(`/api/me/entities/${encodeURIComponent(entityId)}/restore`, {
    method: "POST",
  });
}

/**
 * Archive a company (superusers only, owner 2026-11-10): it leaves everyone's list but a
 * superuser's and opens nowhere until it is restored. Refused (409) while it still has a paid
 * subscription, with the API's sentence; the company is then left as it was.
 */
export function archiveEntity(entityId: string): Promise<{ message: string }> {
  return mintyFetch(`/api/me/entities/${encodeURIComponent(entityId)}/archive`, {
    method: "POST",
  });
}
