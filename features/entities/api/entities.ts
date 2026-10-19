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
   * The three below arrived on 2026-10-19; OPTIONAL so an older Flask still draws the list -
   * missing reads as none (no role shown, no trial ending, no failed payment).
   *
   * The person's role in this company (`entity_role`: `entity_base`, `cashier`, `shop_manager`,
   * `accountant`, `admin`, `super_admin`); null for a superuser who is not a member.
   */
  role?: string | null;
  /** "YYYY-MM-DD": the earliest end of a free trial still running here, or null. */
  trial_ends_on?: string | null;
  /** A subscription here is past due - its last charge was declined. */
  payment_failed?: boolean;
};

/** Flask's flash categories, already read the way its own toasts read them. */
export type EntityNotice = { category: "success" | "error" | "warning" | "info"; message: string };

export type EntityListAnswer = { entities: EntityRow[]; notices: EntityNotice[] };

export function fetchEntities({
  flash,
  signal,
}: { flash?: string | null; signal?: AbortSignal } = {}): Promise<EntityListAnswer> {
  return mintyFetch<EntityListAnswer>("/api/me/entities", {
    query: { flash: flash || undefined },
    signal,
  });
}
