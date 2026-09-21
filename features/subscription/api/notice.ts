/**
 * `GET /api/entities/{id}/subscription-notice` - the notice a dashboard shows for a company
 * (trial ending, past due, cancelled...). The payment-request app (billing-frontend) reads the
 * same route; Flask's own dashboard fetches it server-side. Contract: Part 2 step 3; the JSON
 * keeps `settings_path` for billing-frontend's `buildMintyEnterUrl`.
 */

import { apiFetch } from "@/lib/apiClient";

export type SubscriptionNotice = {
  /** Nothing to show when null. */
  kind: string | null;
  title?: string;
  message?: string;
  /** The module settings path Minty resolves through /entity/<id>/enter?next=... */
  settings_path?: string;
  [extra: string]: unknown;
};

export function getSubscriptionNotice(entityId: string): Promise<SubscriptionNotice> {
  return apiFetch<SubscriptionNotice>(
    `/api/entities/${encodeURIComponent(entityId)}/subscription-notice`,
    {
      entityId,
    },
  );
}
