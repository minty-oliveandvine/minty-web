/**
 * The four parts of a legal document page. Two of them cannot be reached through a URL yet -
 * `beta-1` is the only version of each kind and it is the live one - so they are asserted here
 * rather than left until the day a `beta-2` lands and nobody checks.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LegalDocumentPage } from "@/components/ui/LegalDocumentPage";
import type { LegalDocumentBody } from "@/lib/legal/document";

const DOCUMENT: LegalDocumentBody = {
  kind: "terms",
  version: "beta-1",
  html: "<h1>Minty Beta Terms of Use</h1>\n<p>A clause.</p>",
  sha256: "c90a335ed1b5b8cf5d8f5dc6702117418878594053ef3c0720b7816182c7c438",
  effective_date: "18 September 2026",
  is_pinned: true,
  is_current: true,
  show_draft_notice: false,
};

const doc = (changes: Partial<LegalDocumentBody> = {}) => ({ ...DOCUMENT, ...changes });

describe("LegalDocumentPage", () => {
  it("shows the version, the effective date and the document", () => {
    render(<LegalDocumentPage document={doc()} />);
    expect(screen.getByText("beta-1")).toBeInTheDocument();
    expect(screen.getByText(/Effective 18 September 2026/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Minty Beta Terms of Use" }),
    ).toBeInTheDocument();
  });

  it("prints the fingerprint at the foot", () => {
    // blueprints/legal/routes/admin.py sends whoever reads a consent history here to check that
    // row's document_hash against the document itself. Without this line they cannot.
    render(<LegalDocumentPage document={doc()} />);
    expect(screen.getByText(/Document fingerprint \(SHA-256\)/)).toHaveTextContent(DOCUMENT.sha256);
  });

  it("says nothing about being superseded while it is the live version", () => {
    render(<LegalDocumentPage document={doc()} />);
    expect(screen.queryByText(/Superseded/)).not.toBeInTheDocument();
  });

  it("marks an archived version as superseded", () => {
    render(<LegalDocumentPage document={doc({ version: "beta-1", is_current: false })} />);
    expect(screen.getByText("Superseded")).toBeInTheDocument();
    expect(screen.getByText(/kept so earlier agreements stay readable/)).toBeInTheDocument();
  });

  it("warns while the wording is not final", () => {
    render(<LegalDocumentPage document={doc({ is_pinned: false, show_draft_notice: true })} />);
    expect(screen.getByText("Draft.")).toBeInTheDocument();
    expect(screen.getByText(/must not be relied on outside local testing/)).toBeInTheDocument();
  });

  it("omits the effective date rather than inventing one", () => {
    render(<LegalDocumentPage document={doc({ effective_date: null })} />);
    expect(screen.queryByText(/Effective/)).not.toBeInTheDocument();
  });
});
