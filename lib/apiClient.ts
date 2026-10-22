/**
 * The one way this app talks to its two backends - minty-subscription-api (`apiFetch`;
 * `apiFetchBlob` for its one route that answers a file, an invoice's PDF) and Flask's bearer
 * surface for the hub pages, the entity list and My Profile (`mintyFetch`, Minty's
 * `blueprints/shared/hub_api.py`) - as this app's configuration of `createBearerClient` from
 * `@minty/shared/apiClient` (owner 2026-10-21: one shared module). The headers, the body
 * reading, the error sentence and the 401 rule are the package's; what stays here is where each
 * call goes and what a 401 means to it.
 *
 * - The bearer is the cookie token (lib/auth.ts); with none, no request is made at all - it is
 *   a 401 straight away. `X-Entity-Id` is OPT-IN, per call: the payer portal is person-scoped
 *   and sends none, the module settings page names its company (the token may be unscoped when
 *   the page is reached from the portal - the header is how the API learns which company;
 *   minty-payment-request-web does the same with minty-payment-request-api).
 * - A 401 means the token has lapsed (or was never valid): the browser goes back through Flask's
 *   re-handoff (lib/handoff.ts) and the call rejects with `ApiError(401, SESSION_ENDED)`.
 *   Nothing retries, nothing refreshes.
 * - Every other non-2xx rejects with an `ApiError` carrying the status and the body's sentence
 *   (`error`, then `detail`, then `message`) when it reads as one - never a machine code - or
 *   HOUSE_FALLBACK. The API answers `{"error": "<sentence>"}` with Flask's status codes (a
 *   declined card is 402, missing consent 403, a company not on your account 404, a double buy
 *   409), and screens branch on the status and show the sentence.
 */

import {
  ApiError,
  createBearerClient,
  HOUSE_FALLBACK,
  type BearerClient,
  type BearerRequest,
} from "@minty/shared/apiClient";
import type { FetchJson, PortalRequest } from "@minty/shared/portal";

import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { redirectToHandoff } from "@/lib/handoff";

export { ApiError, HOUSE_FALLBACK };

export type ApiRequest = Omit<BearerRequest, "body" | "form" | "entityId"> & {
  /** Names the company for a company-scoped route. Omit for the payer portal. */
  entityId?: string;
  /** JSON body; serialised by the client. */
  json?: unknown;
};

export type MintyRequest = Omit<ApiRequest, "entityId"> & {
  /**
   * What a 401 means to the caller. `"handoff"` (the default): the token lapsed, so the
   * browser goes back through Flask for a fresh one, as `apiFetch` does. `"reject"`: only
   * reject - for a read that is decoration (the header's initials), which must never move the
   * page; the page's own reads re-authenticate when the token really has lapsed.
   */
  onUnauthorized?: "handoff" | "reject";
};

const getToken = () => getAuth()?.token ?? null;

/** A 401's way back: the re-handoff for this page, naming `entityId` (none when absent). */
function rehandoff(entityId: () => string | undefined) {
  return async (): Promise<boolean> => {
    redirectToHandoff(undefined, entityId());
    return false;
  };
}

/**
 * The billing API for one call. A 401's re-handoff keeps the company the CALL named, so the
 * client is made per call (it is only closures).
 */
function billingClient(entityId: string | undefined): BearerClient {
  return createBearerClient({
    baseUrl: () => env.SUBSCRIPTION_API_URL,
    getToken,
    onUnauthorized: rehandoff(() => entityId || undefined),
  });
}

/**
 * Flask's hub surface. Never sends `X-Entity-Id`: Flask's CORS allows only `Authorization` and
 * `Content-Type`, so the header would fail every preflight - a company travels as `?entity=`
 * instead. A 401's re-handoff keeps the company in the cookie, so a profile opened inside one
 * comes back to it.
 */
const flask = createBearerClient({
  baseUrl: () => env.PETTY_CASH_URL,
  getToken,
  onUnauthorized: rehandoff(() => getAuth()?.entityId || undefined),
});

/** The same surface for decoration: a 401 only rejects. */
const flaskDecoration = createBearerClient({
  baseUrl: () => env.PETTY_CASH_URL,
  getToken,
  onUnauthorized: "reject",
});

/** `ApiRequest` in the package's words: `json` is its `body`. */
function toBearer({ json, ...rest }: Omit<ApiRequest, "entityId">): BearerRequest {
  return json === undefined ? rest : { ...rest, body: json };
}

/**
 * Call the billing API and return the parsed JSON (`null` for an empty body).
 * Rejects with `ApiError`; a 401 also sends the browser to the re-handoff.
 */
export async function apiFetch<T = unknown>(path: string, init: ApiRequest = {}): Promise<T> {
  const { entityId, ...rest } = init;
  return billingClient(entityId).json<T>(path, { ...toBearer(rest), entityId: entityId || null });
}

/**
 * Call a billing API route that answers a FILE - an invoice's PDF - and return it as a Blob
 * (typed as the response named it). Fails exactly as `apiFetch` does: its failures are JSON.
 */
export async function apiFetchBlob(path: string, init: ApiRequest = {}): Promise<Blob> {
  const { entityId, ...rest } = init;
  return billingClient(entityId).blob(path, { ...toBearer(rest), entityId: entityId || null });
}

/** Call Flask's hub surface (`/api/me/entities`, `/api/me/profile`) and return the parsed JSON. */
export async function mintyFetch<T = unknown>(path: string, init: MintyRequest = {}): Promise<T> {
  const { onUnauthorized = "handoff", ...rest } = init;
  const client = onUnauthorized === "reject" ? flaskDecoration : flask;
  return client.json<T>(path, toBearer(rest));
}

/** `@minty/shared/portal`'s request shape (`body`) onto this app's (`json`). */
function fromPortal(init: PortalRequest = {}): ApiRequest {
  const { body, ...rest } = init;
  return body === undefined ? rest : { ...rest, json: body };
}

/** The billing API as `@minty/shared/portal` takes a client (the payer's subscriptions walk). */
export const billingJson: FetchJson = (path, init) => apiFetch(path, fromPortal(init));

/** Flask's hub surface as `@minty/shared/portal` takes a client (My Profile). */
export const flaskJson: FetchJson = (path, init) => mintyFetch(path, fromPortal(init));

/** The same, for decoration - a 401 only rejects (the sidebar's initials). */
export const flaskDecorationJson: FetchJson = (path, init) =>
  mintyFetch(path, { ...fromPortal(init), onUnauthorized: "reject" });
