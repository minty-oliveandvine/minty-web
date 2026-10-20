/**
 * The legal Markdown renderer - a port of Minty's `tests/test_legal_documents.py` renderer cases
 * (2026-10-12).
 *
 * The escaping test is the load-bearing one: `components/ui/TermsModal.tsx` and
 * `components/ui/LegalDocumentPage.tsx` both inject this output with
 * `dangerouslySetInnerHTML`, and the only reason that is safe is that the source is escaped
 * BEFORE any markup is applied. A document is quoted verbatim in a dispute, so it must never be
 * able to inject markup into the page that displays it - including a future revision written by
 * someone not thinking about that.
 */

import { describe, expect, it } from "vitest";

import { renderMarkdown } from "@/lib/legal/render";

describe("renderMarkdown", () => {
  it("escapes HTML in the document", () => {
    const html = renderMarkdown("- <script>alert(1)</script>\n");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes quotes and ampersands the way Python's html.escape does", () => {
    // Identical output to Flask's `legal.render` matters: a document rendered one way here and
    // another way there would be two different documents under one fingerprint.
    expect(renderMarkdown(`A & "B" & 'C'\n`)).toBe(
      "<p>A &amp; &quot;B&quot; &amp; &#x27;C&#x27;</p>",
    );
  });

  it("handles the four constructs", () => {
    const html = renderMarkdown("# T\n\n## S\n\n- one\n- two\n\n**b** rest\n");
    expect(html).toContain("<h1>T</h1>");
    expect(html).toContain("<h2>S</h2>");
    expect((html.match(/<li>/g) ?? []).length).toBe(2);
    expect(html).toContain("<ul>");
    expect(html).toContain("</ul>");
    expect(html).toContain("<strong>b</strong>");
  });

  it("closes a list at a blank line, a heading and the end", () => {
    expect(renderMarkdown("- a\n\ntail\n")).toBe("<ul>\n<li>a</li>\n</ul>\n<p>tail</p>");
    expect(renderMarkdown("- a\n## S\n")).toBe("<ul>\n<li>a</li>\n</ul>\n<h2>S</h2>");
    expect(renderMarkdown("- a\n")).toBe("<ul>\n<li>a</li>\n</ul>");
  });

  it("does not let a document inject markup through a bold span", () => {
    // The bold substitution runs on ALREADY-escaped text, so its capture can only contain
    // escaped characters.
    expect(renderMarkdown("**<b>x</b>**\n")).toBe("<p><strong>&lt;b&gt;x&lt;/b&gt;</strong></p>");
  });
});
