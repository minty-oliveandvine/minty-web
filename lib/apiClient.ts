/**
 * The one way this app talks to its two backends: minty-billing-api (`apiFetch`) and Flask's
 * bearer surface for the hub pages - the entity list and My Profile (`mintyFetch`,
 * Minty's `blueprints/shared/hub_api.py`). Both share everything below except where they go
 * and `X-Entity-Id`, which only the billing API takes.
 *
 * - The bearer is the cookie token (lib/auth.ts); `X-Entity-Id` is OPT-IN, per call: the payer
 *   portal is person-scoped and sends none, the module settings page names its company (the
 *   token may be unscoped when the page is reached from the portal - the header is how the API
 *   learns which company; billing-frontend does the same with billing-backend).
 * - A 401 means the token has lapsed (or was never valid): the browser goes back through Flask's
 *   re-handoff (lib/handoff.ts) and the call rejects. Nothing retries, nothing refreshes.
 * - Every other non-2xx rejects with an `ApiError` carrying the status and the body's `error`
 *   sentence - the API answers `{"error": "<sentence>"}` with Flask's status codes (a declined
 *   card is 402, missing consent 403, a company not on your account 404, a double buy 409), and
 *   screens branch on the status and show the sentence.
 * - A 404 while the feature is dark is the same shape (`{"error": "not_found"}`); the
 *   proxy.ts keeps the pages out of sight in that state, so screens rarely see it.
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

async function send<T>(
  base: string,
  path: string,
  init: ApiRequest,
  onUnauthorized: "handoff" | "reject",
  handoffEntityId: string | undefined,
): Promise<T> {
  const { entityId, json, query, headers: extraHeaders, ...rest } = init;
  const auth = getAuth();

  const headers = new Headers(extraHeaders);
  headers.set("Accept", "application/json");
  if (auth?.token) headers.set("Authorization", `Bearer ${auth.token}`);
  if (entityId) headers.set("X-Entity-Id", entityId);
  if (json !== undefined) headers.set("Content-Type", "application/json");

  const res = await fetch(`${base}${withQuery(path, query)}`, {
    ...rest,
    headers,
    body: json === undefined ? undefined : JSON.stringify(json),
  });

  if (res.status === 401) {
    if (onUnauthorized === "handoff") redirectToHandoff(undefined, handoffEntityId);
    throw new ApiError(401, SESSION_ENDED);
  }

  const body = await readBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, errorSentence(body) ?? HOUSE_FALLBACK, body);
  }
  return body as T;
}

/**
 * Call the billing API and return the parsed JSON (`null` for an empty body).
 * Rejects with `ApiError`; a 401 also sends the browser to the re-handoff.
 */
export async function apiFetch<T = unknown>(path: string, init: ApiRequest = {}): Promise<T> {
  return send<T>(env.BILLING_API_URL, path, init, "handoff", init.entityId);
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
  return send<T>(env.MINTY_URL, path, rest, onUnauthorized, getAuth()?.entityId || undefined);
}
