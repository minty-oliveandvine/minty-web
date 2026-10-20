/**
 * Render the legal Markdown subset to HTML - a 1:1 port of Minty's `legal/render.py`, which was
 * deleted when the documents moved here (2026-10-12).
 *
 * Deliberately not a general Markdown library. The `.md` files under `documents/` ARE the legal
 * text (the Word originals were retired on 2026-09-18), written to a subset we control, so they
 * only ever contain four constructs:
 *
 *     # Title            -> <h1>
 *     ## 1. Section      -> <h2>
 *     - bullet           -> <ul><li>
 *     **bold**           -> <strong>
 *
 * Everything else is a paragraph.
 *
 * The text is HTML-escaped BEFORE any markup is applied, so a legal document can never inject
 * HTML into the page - including a future revision written by someone who has no reason to think
 * about that. That is the whole justification for the `dangerouslySetInnerHTML` in
 * `components/ui/TermsModal.tsx` and on the `/terms` page: do not reorder the two steps, and do
 * not reach for a Markdown library, which would pass raw HTML through by default - the wrong
 * default for a document whose purpose is to be quoted back verbatim in a dispute.
 *
 * `escape()` matches Python's `html.escape(text)` (quote=True) character for character, so this
 * renderer's output is identical to the markup Flask served until the move.
 */

const BOLD = /\*\*(.+?)\*\*/g;

/** Python's `html.escape(s)`: the five characters, in that order. */
function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Escape, then apply the one inline construct we allow. */
function inline(text: string): string {
  return escape(text).replace(BOLD, "<strong>$1</strong>");
}

/** HTML for the legal Markdown subset. */
export function renderMarkdown(md: string): string {
  const html: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      html.push("</ul>");
      inList = false;
    }
  };

  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) {
      closeList();
      continue;
    }
    if (line.startsWith("## ")) {
      closeList();
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      closeList();
      html.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else if (line.startsWith("- ")) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inline(line.slice(2))}</li>`);
    } else {
      closeList();
      html.push(`<p>${inline(line)}</p>`);
    }
  }

  closeList();
  return html.join("\n");
}
