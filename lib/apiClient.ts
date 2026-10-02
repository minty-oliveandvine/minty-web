/**
 * The one way this app talks to its two backends: minty-subscription-api (`apiFetch`; `apiFetchBlob`
 * for its one route that answers a file, an invoice's PDF) and Flask's bearer surface for the
 * hub pages - the entity list and My Profile (`mintyFetch`, Minty's
 * `blueprints/shared/hub_api.py`). Both share everything below except where they go and
 * `X-Entity-Id`, which only the billing API takes.
 *
 * - The bearer is the cookie token (lib/auth.ts); `X-Entity-Id` is OPT-IN, per call: the payer
 *   portal is person-scoped and sends none, the module settings page names its company (the
 *   token may be unscoped when the page is reached from the portal - the header is how the API
 *   learns which company; minty-payment-request-web does the same with minty-payment-request-api).
 * - A 401 means the token has lapsed (or was never valid): the browser goes back through Flask's
 *   re-handoff (lib/handoff.ts) and the call rejects. Nothing retries, nothing refreshes.
 * - Every other non-2xx rejects with an `ApiError` carrying the status and the body's `error`
 *   sentence - the API answers `{"error": "<sentence>"}` with Flask's status codes (a declined
 *   card is 402, missing consent 403, a company not on your account 404, a double buy 409), and
 *   screens branch on the status and show the sentence.
 */

import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { redirectToHandoff } from "@/lib/handoff";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Shown when the API gave no sentence of its own - the same fallback the backends use. */
export const HOUSE_FALLBACK = "Something went wrong on my end. Mind trying again?";

export type ApiRequest = Omit<RequestInit, "body"> & {
  /** Names the company for a company-scoped route. Omit for the payer portal. */
  entityId?: string;
  /** JSON body; serialised here. */
  json?: unknown;
  /** Query string, appended to the path. */
  query?: Record<string, string | number | boolean | undefined>;
};

function withQuery(path: string, query?: ApiRequest["query"]): string {
  if (!query) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}${path.includes("?") ? "&" : "?"}${s}` : path;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorSentence(body: unknown): string | null {
  if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
    return (body as { error: string }).error;
  }
  return null;
}

export type MintyRequest = Omit<ApiRequest, "entityId"> & {
  /**
   * What a 401 means to the caller. `"handoff"` (the default): the token lapsed, so the
   * browser goes back through Flask for a fresh one, as `apiFetch` does. `"reject"`: only
   * reject - for a read that is decoration (the header's initials), which must never move the
   * page; the page's own reads re-authenticate when the token really has lapsed.
   */
  onUnauthorized?: "handoff" | "reject";
};

const SESSION_ENDED = "Your session has ended. Signing you back in…";

/** Where a call goes and what a 401 there means - all that differs between the two backends. */
type Backend = {
  base: string;
  onUnauthorized: "handoff" | "reject";
  /** The company a 401's re-handoff keeps. */
  handoffEntityId: string | undefined;
};

/**
 * One call, up to its answer: the headers, the 401's re-handoff, and every other non-2xx
 * rejected as an `ApiError` with the body's sentence - a failure is JSON even from a route whose
 * success is a file, so `accept` names both there. Reading a success is the caller's: JSON
 * (`requestJson`) or a file (`apiFetchBlob`).
 */
async function request(
  backend: Backend,
  path: string,
  init: ApiRequest,
  accept: string,
): Promise<Response> {
  const { entityId, json, query, headers: extraHeaders, ...rest } = init;
  const auth = getAuth();

  const headers = new Headers(extraHeaders);
  headers.set("Accept", accept);
  if (auth?.token) headers.set("Authorization", `Bearer ${auth.token}`);
  if (entityId) headers.set("X-Entity-Id", entityId);
  if (json !== undefined) headers.set("Content-Type", "application/json");

  const res = await fetch(`${backend.base}${withQuery(path, query)}`, {
    ...rest,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
  });

  if (res.status === 401) {
    if (backend.onUnauthorized === "handoff") redirectToHandoff(undefined, backend.handoffEntityId);
    throw new ApiError(401, SESSION_ENDED);
  }
  if (!res.ok) {
    const body = await readBody(res);
    throw new ApiError(res.status, errorSentence(body) ?? HOUSE_FALLBACK, body);
  }
  return res;
}

/** A JSON answer, parsed (`null` for an empty body). */
async function requestJson<T>(backend: Backend, path: string, init: ApiRequest): Promise<T> {
  return (await readBody(await request(backend, path, init, "application/json"))) as T;
}

/** The billing API: a 401 always goes back through the re-handoff, for the company named. */
function billingApi(init: ApiRequest): Backend {
  return {
    base: env.SUBSCRIPTION_API_URL,
    onUnauthorized: "handoff",
    handoffEntityId: init.entityId,
  };
}

/**
 * Call the billing API and return the parsed JSON (`null` for an empty body).
 * Rejects with `ApiError`; a 401 also sends the browser to the re-handoff.
 */
export async function apiFetch<T = unknown>(path: string, init: ApiRequest = {}): Promise<T> {
  return requestJson<T>(billingApi(init), path, init);
}

/**
 * Call a billing API route that answers a FILE - an invoice's PDF - and return it as a Blob
 * (typed as the response named it). Fails exactly as `apiFetch` does: its failures are JSON.
 */
export async function apiFetchBlob(path: string, init: ApiRequest = {}): Promise<Blob> {
  const res = await request(billingApi(init), path, init, "application/pdf, application/json");
  return res.blob();
}

/**
 * Call Flask's hub surface (`/api/me/entities`, `/api/me/profile`) and return the parsed JSON.
 *
 * Never sends `X-Entity-Id`: Flask's CORS allows only `Authorization` and `Content-Type`, so
 * the header would fail every preflight - a company travels as `?entity=` instead. A 401's
 * re-handoff keeps the company in the cookie, so a profile opened inside one comes back to it.
 */
export async function mintyFetch<T = unknown>(path: string, init: MintyRequest = {}): Promise<T> {
  const { onUnauthorized = "handoff", ...rest } = init;
  const flask: Backend = {
    base: env.PETTY_CASH_URL,
    onUnauthorized,
    handoffEntityId: getAuth()?.entityId || undefined,
  };
  return requestJson<T>(flask, path, rest);
}
