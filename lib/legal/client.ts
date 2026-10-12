/**
 * Reading a legal document from a client component.
 *
 * Plain `fetch`, deliberately NOT `lib/apiClient.ts`: this is the only SAME-ORIGIN read in the
 * app. There is no backend to reach, no bearer token to send (the documents are public - someone
 * who has not signed up yet must be able to read them), and no 401 to turn into a sign-in
 * handoff. `mintyFetch`/`apiFetch` would attach a token and redirect to `/login` on a lapsed one,
 * which is wrong for a page whose whole point is to stand without a person.
 *
 * It rejects on anything it cannot read, as `lib/terms.ts` does: the Terms gate decides what a
 * failure means (it logs and fails open), and must never be handed a half-read document.
 */

import { isDocumentKind, type DocumentKind, type LegalDocumentBody } from "@/lib/legal/document";
import { LEGAL_PATHS } from "@/lib/legal/paths";

function readBody(body: unknown): LegalDocumentBody {
  const answer = (body ?? {}) as Partial<LegalDocumentBody>;
  if (
    typeof answer.kind === "string" &&
    isDocumentKind(answer.kind) &&
    typeof answer.version === "string" &&
    typeof answer.html === "string" &&
    typeof answer.sha256 === "string"
  ) {
    return answer as LegalDocumentBody;
  }
  throw new Error(`Unreadable legal document: ${JSON.stringify(body)?.slice(0, 200)}`);
}

/**
 * One version of one document, or `"current"` for the live one. Rejects when this app does not
 * hold that version - the caller must not fall back to showing something else.
 */
export async function fetchLegalDocument(
  kind: DocumentKind,
  version = "current",
  signal?: AbortSignal,
): Promise<LegalDocumentBody> {
  const response = await fetch(LEGAL_PATHS.api(kind, version), {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Legal document ${kind}/${version} unavailable (${response.status})`);
  }
  return readBody(await response.json());
}
