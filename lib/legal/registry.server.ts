/**
 * The published legal documents: versions, effective dates, pinned fingerprints - a port of the
 * file half of Minty's `legal/registry.py`, which became a text-free manifest when the documents
 * moved here (2026-10-12).
 *
 * SERVER ONLY. It opens files (`node:fs`) and hashes them (`node:crypto`); importing it from a
 * client component breaks the browser bundle. The `.server.ts` suffix is convention, not a
 * guarantee - `__tests__/serverOnly.test.ts` is what actually holds the line. A client component
 * reads a document through `client.ts`, which asks `app/api/legal/[kind]/[version]`.
 *
 * Rules, unchanged by the move:
 *
 *   - A published version is NEVER edited. A change of any kind - even a typo - is a new file
 *     (`beta-2.md`), never an edit of this one, or every `terms_consent` row pointing at it looks
 *     tampered with. Old versions are never deleted: a person's consent names the version they
 *     read, and `/terms/<version>` must still be able to show it.
 *   - The NORMALISED text is what gets hashed and shown: CRLF -> LF, stripped, one trailing
 *     newline. That is part of the fingerprint's definition, so a checkout with different line
 *     endings still produces the pinned hash.
 *   - `PINNED_HASHES` is the assertion that a version's wording is final. `terms/beta-1` has been
 *     pinned since 2026-09-18; `privacy/beta-1` is an UNPINNED placeholder awaiting the actual
 *     policy text, and shows the draft notice.
 *
 * Flask's `legal/registry.py` holds the same table without the text, because it stamps
 * `terms_consent.document_hash` server-side and must never take a hash from a client. The two
 * tables MUST be changed together: this app's `__tests__/registry.test.ts` catches an edit here,
 * Minty's `tests/test_legal_manifest.py` catches one there, and the stack e2e job compares the
 * two running services. Flask names the live version; this app supplies the text.
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  DOCUMENT_KINDS,
  PRIVACY,
  TERMS,
  type DocumentKind,
  type LegalDocumentBody,
} from "@/lib/legal/document";
import { renderMarkdown } from "@/lib/legal/render";

const DOCUMENTS_DIR = path.join(process.cwd(), "lib", "legal", "documents");

/**
 * The single setting that drives who gets asked to agree. Changing it moves every user from
 * "agreed to the current version" to "owes an acceptance" at once - that is the whole mechanism
 * for a Terms revamp, so change it only for meaningful revisions. A typo fix gets a new file and
 * leaves this alone.
 *
 * Flask has the same two settings and they must move together: Flask's decides which version a
 * consent row may name, this one decides which version `/terms` shows and which the Terms panel
 * believes is live. A skew is caught loudly (TermsGate logs and fails open) rather than
 * silently recording an agreement to wording nobody read.
 */
export const CURRENT_TERMS_VERSION = process.env.CURRENT_TERMS_VERSION?.trim() || "beta-1";
export const CURRENT_PRIVACY_VERSION = process.env.CURRENT_PRIVACY_VERSION?.trim() || "beta-1";

/**
 * Whether an unpinned (draft) document shows its "this wording is not final" banner.
 *
 * DEFAULTS TO ON, and should stay on anywhere real people are asked to agree. The opt-out exists
 * so a draft can be hidden for demos and screenshots without PINNING its hash, which would
 * assert the wording is final.
 */
export const SHOW_DRAFT_BANNER = !["0", "false", "no", "off"].includes(
  (process.env.LEGAL_SHOW_DRAFT_BANNER ?? "1").trim().toLowerCase(),
);

/**
 * Publication date per version, exactly as printed in the document header (every surface renders
 * the string verbatim). A version with null has no recorded date and reports null rather than
 * inventing one. `privacy/beta-1` is still a placeholder with no date.
 */
const EFFECTIVE_DATES: Record<string, string | null> = {
  "terms/beta-1": "18 September 2026",
  "privacy/beta-1": null,
};

/**
 * Expected SHA-256 per published document, over the NORMALISED Markdown. null == draft, not yet
 * pinned. Pin a version when its wording is final, and before any consent row is written against
 * it in production - a record that fingerprints a draft is worth less than no record at all.
 */
const PINNED_HASHES: Record<string, string | null> = {
  "terms/beta-1": "c90a335ed1b5b8cf5d8f5dc6702117418878594053ef3c0720b7816182c7c438",
  "privacy/beta-1": null,
};

const key = (kind: string, version: string) => `${kind}/${version}`;

/** Canonical form of a document, for hashing and for display. Part of the fingerprint. */
export function normalise(raw: string): string {
  return `${raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()}\n`;
}

export function fingerprint(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function currentVersion(kind: DocumentKind): string {
  return kind === TERMS ? CURRENT_TERMS_VERSION : CURRENT_PRIVACY_VERSION;
}

type Loaded = { text: string; body: LegalDocumentBody };

function load(): Map<string, Loaded> {
  const documents = new Map<string, Loaded>();
  for (const kind of DOCUMENT_KINDS) {
    const directory = path.join(DOCUMENTS_DIR, kind);
    let filenames: string[];
    try {
      filenames = readdirSync(directory).sort();
    } catch {
      // Loud, and not fatal: a missing directory means no version of that kind can be shown,
      // which the pages and the API surface as a 404 rather than an empty document.
      console.error(`Legal: no ${kind}/ directory at ${directory}`);
      continue;
    }
    for (const filename of filenames) {
      if (!filename.endsWith(".md")) continue;
      const version = filename.slice(0, -".md".length);
      const text = normalise(readFileSync(path.join(directory, filename), "utf8"));
      const isPinned = PINNED_HASHES[key(kind, version)] != null;
      documents.set(key(kind, version), {
        text,
        body: {
          kind,
          version,
          html: renderMarkdown(text),
          sha256: fingerprint(text),
          effective_date: EFFECTIVE_DATES[key(kind, version)] ?? null,
          is_pinned: isPinned,
          is_current: version === currentVersion(kind),
          show_draft_notice: !isPinned && SHOW_DRAFT_BANNER,
        },
      });
    }
  }
  return documents;
}

// Read once, as Flask's registry does at import: the documents cannot change without a deploy.
const DOCUMENTS = load();

export function getDocument(kind: DocumentKind, version: string): LegalDocumentBody | null {
  return DOCUMENTS.get(key(kind, version))?.body ?? null;
}

export function getCurrent(kind: DocumentKind): LegalDocumentBody | null {
  return getDocument(kind, currentVersion(kind));
}

/** Every version of a kind, oldest filename first. */
export function allVersions(kind: DocumentKind): string[] {
  return [...DOCUMENTS.keys()]
    .filter((k) => k.startsWith(`${kind}/`))
    .map((k) => k.slice(kind.length + 1))
    .sort();
}

/** The normalised Markdown - for the tests that re-hash it. Not for display. */
export function getSource(kind: DocumentKind, version: string): string | null {
  return DOCUMENTS.get(key(kind, version))?.text ?? null;
}

export function pinnedHash(kind: DocumentKind, version: string): string | null {
  return PINNED_HASHES[key(kind, version)] ?? null;
}

/**
 * Re-check every pinned document against its file, and that the live version of each kind
 * exists. Returns the problems, for a test or a start-up check to report.
 *
 * A mismatch means a published document was edited in place, which silently invalidates every
 * consent row pointing at it. Flask can no longer catch this - it holds no text - so this is the
 * only place the files themselves are verified.
 */
export function verifyPinnedHashes(): string[] {
  const problems: string[] = [];
  for (const [k, expected] of Object.entries(PINNED_HASHES)) {
    const loaded = DOCUMENTS.get(k);
    if (!loaded) {
      problems.push(`${k}: listed in PINNED_HASHES but no .md file`);
      continue;
    }
    if (expected == null) {
      problems.push(`${k}: UNPINNED (draft) - pin it before anyone agrees to it in production`);
    } else if (loaded.body.sha256 !== expected) {
      problems.push(`${k}: edited in place - expected ${expected}, read ${loaded.body.sha256}`);
    }
  }
  for (const kind of [TERMS, PRIVACY] as const) {
    if (!getCurrent(kind)) {
      problems.push(`${kind}: the live version (${currentVersion(kind)}) has no .md file`);
    }
  }
  return problems;
}
