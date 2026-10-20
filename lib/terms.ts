/**
 * Whether a person still owes an acceptance of the Terms & Conditions, and recording that they
 * agreed - Flask's `GET /api/me/terms` and `POST /api/me/terms/accept` (Minty
 * `blueprints/legal/routes/hub.py`).
 *
 * THE SPLIT, since the documents moved here (2026-10-12): **Flask names the version, this app
 * supplies the text.** Flask still owns the record (`terms_consent`), the checks an agreement
 * passes (ticked; still the live version) and the fingerprint it stamps - it never takes a hash
 * from a client. What it no longer sends is the document itself: the wording and the public links
 * are this app's (`lib/legal/`), so the answer here carries only the version, its fingerprint and
 * whether this is a re-acceptance. The caller fetches the matching document from
 * `lib/legal/client.ts` and MUST refuse to show one whose `sha256` differs from the one below -
 * a document Flask would misrecord must never be put in front of anyone.
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
  /** SHA-256 of the wording Flask will record. The document shown must match it. */
  sha256: string | null;
  show_draft_notice: boolean;
};

export type OwedTerms = {
  owed: true;
  document: TermsDocument;
  /** They agreed to an older version: asked again, and told which. */
  is_update: boolean;
  previous_version: string | null;
};

export type TermsStatus = { owed: false } | OwedTerms;

let settledFor: string | null = null;

const currentToken = () => getAuth()?.token ?? "";

/** Whether the person behind this token has nothing to agree to - already asked and answered. */
export function termsSettled(token: string): boolean {
  return token !== "" && settledFor === token;
}

function readStatus(body: unknown): TermsStatus {
  const answer = (body ?? {}) as { owed?: unknown; document?: { version?: unknown } };
  if (answer.owed === false) return { owed: false };
  if (answer.owed === true && typeof answer.document?.version === "string") {
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
 * Agree to `version` - the one on screen - naming the fingerprint of the document that was
 * actually shown. Flask compares that hash to its own manifest and refuses a mismatch (409
 * `document_mismatch`): it is a canary against a stale bundle filing a consent row against
 * wording nobody read, never the hash it stores.
 *
 * Rejects with the API's `ApiError`: 400 when not ticked, 409 when the Terms changed under the
 * reader (re-read and ask again), 500 when Flask has no manifest entry; a 401 goes back through
 * Flask for a fresh token, as any page's call does.
 */
export async function acceptTerms(version: string, documentHash: string): Promise<void> {
  const token = currentToken();
  await mintyFetch("/api/me/terms/accept", {
    method: "POST",
    json: { accepted: true, terms_version: version, document_hash: documentHash },
  });
  settledFor = token;
}

/** Test seam: forget every answer. */
export function _resetTermsForTests() {
  settledFor = null;
}
