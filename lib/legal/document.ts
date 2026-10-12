/**
 * What a legal document IS, for everything that shows one.
 *
 * This app owns the Terms of Use and the Privacy Policy since 2026-10-12: the `.md` files under
 * `documents/`, the renderer beside them, the public pages at `/terms` and `/privacy`, and the
 * fingerprint printed at the foot of each. Flask keeps the record (`terms_consent`) and still
 * NAMES the live version - the split is "Flask names the version, this app supplies the text",
 * so a deploy skew can never leave the two disagreeing about which wording a person agreed to.
 *
 * Types only, so a client component may import this file; the reader that opens the files is
 * `registry.server.ts` and must not be imported from one.
 */

export const TERMS = "terms";
export const PRIVACY = "privacy";
export const DOCUMENT_KINDS = [TERMS, PRIVACY] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value);
}

/** One published version of one document, as the pages and the Terms panel read it. */
export type LegalDocumentBody = {
  kind: DocumentKind;
  /** The file's stem: `beta-1`. */
  version: string;
  /** The document as markup - `render.ts`, which escapes the source before applying any, so it
   *  is safe to inject. */
  html: string;
  /** SHA-256 of the normalised Markdown - the fingerprint a consent row is checked against. */
  sha256: string;
  /** As the registry spells it, verbatim; null when the version has no recorded date. */
  effective_date: string | null;
  /** Whether the wording is final. An unpinned version shows the draft notice. */
  is_pinned: boolean;
  /** Whether this is the version people are currently asked to agree to. */
  is_current: boolean;
  /** Whether to warn that this wording is not final. */
  show_draft_notice: boolean;
};
