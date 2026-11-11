/**
 * minty-petty-cash-api for this tab. Every route is under `/api/petty-cash/v1/companies/<id>` -
 * the company is in the path and nowhere else (its door, `core/auth.py`, never reads
 * `X-Entity-Id`): `GET /settings`, `GET /settings/xero`, `POST /sales-methods`,
 * `PUT /sales-methods/order`, `PUT`/`DELETE /sales-methods/<id>`, `PUT /settings/xero/mapping`,
 * `PUT /settings/xero/account-codes` and `POST /suppliers`. The bearer, the 401's re-handoff and
 * the refusal's sentence are `lib/apiClient.ts`'s.
 */

import { pettyCashFetch, type ApiRequest } from "@/lib/apiClient";

/** The company's part of the address. */
export function companyApiPath(entityId: string, path: string): string {
  return `/api/petty-cash/v1/companies/${encodeURIComponent(entityId)}${path}`;
}

/** One call for this company: `path` is relative to it ("/settings", "/sales-methods/<id>"). */
export function pettyCashSettingsFetch<T>(
  entityId: string,
  path: string,
  init: ApiRequest = {},
): Promise<T> {
  return pettyCashFetch<T>(companyApiPath(entityId, path), init);
}
