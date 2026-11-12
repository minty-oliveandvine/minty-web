/**
 * Every call Payment Settings makes, to minty-payment-request-api (`paymentRequestFetch`, which
 * sends the bearer and rejects with `ApiError`). Its door takes the company from `X-Entity-Id`
 * and requires a role on it, so each call names the company. The same three calls
 * minty-payment-request-web's `lib/api.ts` made for this tab (`fetchConnection`,
 * `fetchEntityBillAccounts({ includeInactive: true })`, `updateEntityBillAccount`).
 */

import { paymentRequestFetch } from "@/lib/apiClient";

/** A row of the company's chart (`entity_bill_account_xero`), as the API answers it. */
export type EntityBillAccount = {
  id: string;
  entity_id: string;
  account_code: string;
  account_name: string;
  account_type: string;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
};

/**
 * The company's connection and who keeps the books (`GET /api/v1/auth/xero-status`): `mintyOnly`
 * when the company keeps its books in Minty (Xero optional, 2026-11-10) - its codes are its own.
 */
export async function fetchConnection(
  entityId: string,
): Promise<{ connected: boolean; mintyOnly: boolean }> {
  const data = await paymentRequestFetch<{ connected: boolean; minty_only?: boolean }>(
    "/api/v1/auth/xero-status",
    { entityId },
  );
  return { connected: data.connected, mintyOnly: !!data.minty_only };
}

/**
 * Every code of the chart, ticked or not (`include_inactive=true`), so an unticked one can be
 * ticked. On a live connection that read also starts the API's (debounced) chart re-sync; without
 * one (`sync: false`) it reads the stored codes alone (owner, 2026-11-12: codes without Xero).
 */
export function fetchEntityBillAccounts(
  entityId: string,
  { sync }: { sync: boolean },
): Promise<EntityBillAccount[]> {
  return paymentRequestFetch<EntityBillAccount[]>("/api/v1/entity-bill-accounts/", {
    entityId,
    query: sync ? { include_inactive: true } : { include_inactive: true, sync_chart: false },
  });
}

/** Tick or untick one code. Unticking the company's last ticked code answers 409. */
export function updateEntityBillAccount(
  entityId: string,
  accountId: string,
  payload: { is_active: boolean },
): Promise<EntityBillAccount> {
  return paymentRequestFetch<EntityBillAccount>(
    `/api/v1/entity-bill-accounts/${encodeURIComponent(accountId)}`,
    { entityId, method: "PUT", json: payload },
  );
}
