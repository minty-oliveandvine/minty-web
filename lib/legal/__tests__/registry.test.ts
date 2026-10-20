/**
 * The documents and their fingerprints - a port of Minty's `tests/test_legal_documents.py`, which
 * came here with the documents (2026-10-12).
 *
 * The fingerprint tests are the point of this file. A `terms_consent` row stores the SHA-256 of
 * the wording the person saw, and Flask now holds that hash in a text-free manifest
 * (`Minty/legal/registry.py`) because it has no copy of the file. So THIS suite is the only thing
 * that notices a published document being edited in place - after which every consent row
 * pointing at it is unverifiable. If `c90a335e…` below ever has to change to make this pass,
 * something is wrong: a wording change is a NEW file (`beta-2.md`), never an edit.
 *
 * The frozen literal must stay equal to Flask's `MANIFEST` entry for `terms/beta-1`. The stack
 * e2e job compares the two running services; this is the earlier, cheaper half of that check.
 */

import { describe, expect, it } from "vitest";

import { PRIVACY, TERMS } from "@/lib/legal/document";
import {
  allVersions,
  fingerprint,
  getCurrent,
  getDocument,
  getSource,
  normalise,
  verifyPinnedHashes,
} from "@/lib/legal/registry.server";

/** Flask's `MANIFEST[(TERMS, "beta-1")]["sha256"]`. Pinned 2026-09-18. */
const TERMS_BETA_1_SHA256 = "c90a335ed1b5b8cf5d8f5dc6702117418878594053ef3c0720b7816182c7c438";

describe("the registry", () => {
  it("has a file behind the version the app advertises (terms)", () => {
    // Without this `/terms` 404s and the gate panel has nothing to show - the lock-out the
    // runbook describes.
    expect(getCurrent(TERMS)).not.toBeNull();
  });

  it("has a file behind the version the app advertises (privacy)", () => {
    expect(getCurrent(PRIVACY)).not.toBeNull();
  });

  it("fingerprints to 64 hex characters - the width of terms_consent.document_hash", () => {
    const sha256 = getCurrent(TERMS)!.sha256;
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes CRLF and LF identically", () => {
    // Without this, a Windows checkout with core.autocrlf writes consent rows that look
    // tampered with when read on the Linux host, and vice versa.
    expect(fingerprint(normalise("# Title\n\nA line.\n"))).toBe(
      fingerprint(normalise("# Title\r\n\r\nA line.\r\n")),
    );
  });

  it("changes the fingerprint when one letter changes", () => {
    // The whole point of storing a hash - it proves the wording, not just the name.
    expect(fingerprint(normalise("The cap is HKD100."))).not.toBe(
      fingerprint(normalise("The cap is HKD200.")),
    );
  });

  it("reports only the unpinned privacy draft as a problem", () => {
    // A mismatch or a missing live file would appear here too. Privacy is a placeholder on
    // purpose (runbook open decision #1), so it is the one expected line.
    expect(verifyPinnedHashes()).toEqual([
      "privacy/beta-1: UNPINNED (draft) - pin it before anyone agrees to it in production",
    ]);
  });

  it("keeps terms/beta-1 pinned, final and byte-for-byte what Minty pinned", () => {
    const document = getDocument(TERMS, "beta-1")!;
    expect(document.sha256).toBe(TERMS_BETA_1_SHA256);
    expect(document.is_pinned).toBe(true);
    expect(document.show_draft_notice).toBe(false);
    expect(document.effective_date).toBe("18 September 2026");
    const source = getSource(TERMS, "beta-1")!;
    for (const blank of ["[DATE]", "[INSERT EMAIL]", "[INSERT ADDRESS]"]) {
      expect(source).not.toContain(blank);
    }
    expect(source).toContain("hello@dailyminty.com");
  });

  it("renders every section and bullet of the Terms", () => {
    // Guards the docx -> markdown conversion, and now the Python -> TypeScript renderer port:
    // the source has 23 numbered sections and 106 bullets, and a conversion that silently drops
    // clauses is the failure mode worth catching.
    const html = getCurrent(TERMS)!.html;
    expect((html.match(/<h2>/g) ?? []).length).toBe(23);
    expect((html.match(/<li>/g) ?? []).length).toBe(106);
  });

  it("lists every version of a kind", () => {
    expect(allVersions(TERMS)).toEqual(["beta-1"]);
    expect(allVersions(PRIVACY)).toEqual(["beta-1"]);
  });

  it("marks an unknown version as missing rather than inventing one", () => {
    expect(getDocument(TERMS, "beta-99")).toBeNull();
  });
});
