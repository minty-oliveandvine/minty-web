/**
 * The Terms & Conditions a person still owes, and agreeing to them - Flask's `GET /api/me/terms`
 * and `POST /api/me/terms/accept` (Minty `blueprints/legal/routes/hub.py`). Everything they
 * decide is Flask's own Terms panel's: what is owed, whether it is a re-acceptance, and the
 * checks an agreement passes (ticked; still the live version). The document's fingerprint and
 * where the agreement was given (`source = "hub"`) are recorded there - nothing of it is sent
 * from here but the tick and the version on screen.
 *
 * Asked once per TOKEN: once the answer is "nothing owed", or the person has just agreed, this
 * token is not asked again. A token lives 30 minutes, so a Terms revamp reaches everyone within
 * one token of going live - Flask's own gate caches per session and version the same way.
 */

import { mintyFetch } from "@/lib/apiClient";
import { getAuth } from "@/lib/auth";

export type TermsDocument = {
  version: string;
  /** As the registry spells it; null when the version has no recorded date. */
  effective_date: string | null;
  /** The document as markup - Flask's `legal.render`, which escapes the source before
   * applying any, so it is safe to inject. */
  html: string;
  show_draft_notice: boolean;
};

export type OwedTerms = {
  owed: true;
  document: TermsDocument;
  /** They agreed to an older version: asked again, and told which. */
  is_update: boolean;
  previous_version: string | null;
  /** Paths on Flask - public pages, so a person held at the gate can read what they are asked. */
  links: { terms: string; privacy: string; previous: string | null };
};

export type TermsStatus = { owed: false } | OwedTerms;

let settledFor: string | null = null;

const currentToken = () => getAuth()?.token ?? "";

/** Whether the person behind this token has nothing to agree to - already asked and answered. */
export function termsSettled(token: string): boolean {
  return token !== "" && settledFor === token;
}

function readStatus(body: unknown): TermsStatus {
  const answer = (body ?? {}) as { owed?: unknown; document?: { html?: unknown }; links?: unknown };
  if (answer.owed === false) return { owed: false };
  if (answer.owed === true && typeof answer.document?.html === "string" && answer.links) {
    return answer as unknown as OwedTerms;
  }
  // Never read an answer we cannot understand as "nothing owed": the gate is told it failed.
  throw new Error(`Unreadable Terms answer from Flask: ${JSON.stringify(body)?.slice(0, 200)}`);
}

/**
 * What this person owes, or `{owed: false}`. A 401 only rejects: the page's own reads send a
 * lapsed token back through Flask. Every failure rejects - the gate decides what that means.
 */
export async function fetchTerms(signal?: AbortSignal): Promise<TermsStatus> {
  const token = currentToken();
  const status = readStatus(
    await mintyFetch<unknown>("/api/me/terms", { onUnauthorized: "reject", signal }),
  );
  if (!status.owed) settledFor = token;
  return status;
}

/**
 * Agree to `version` - the one on screen. Rejects with the API's `ApiError`: 400 when not
 * ticked, 409 when the Terms changed under the reader (re-read and ask again), 500 when Flask
 * has no document; a 401 goes back through Flask for a fresh token, as any page's call does.
 */
export async function acceptTerms(version: string): Promise<void> {
  const token = currentToken();
  await mintyFetch("/api/me/terms/accept", {
    method: "POST",
    json: { accepted: true, terms_version: version },
  });
  settledFor = token;
}

/** Test seam: forget every answer. */
export function _resetTermsForTests() {
  settledFor = null;
}
