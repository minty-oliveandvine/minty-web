# The legal documents — Terms of Use and Privacy Policy

**This app owns them since 2026-10-12.** The `.md` files, the renderer, the public pages and the
fingerprints all live here; Minty (Flask) keeps the consent **record** and still names the live
version. The invariant the split turns on:

> **Flask names the version. This app supplies the text.**

Minty's half is `Minty/docs/features/legal-terms.md`. What moved, and why: Flask had the
documents, a Markdown renderer, `/legal/terms` + `/legal/privacy` pages and a second acceptance
screen at `/legal/accept` built from `templates/legal/` — a parallel copy of the panel this app
had drawn since 2026-09-29. All of that is gone from Flask.

## Where everything is

```
lib/legal/documents/terms/beta-1.md      the Terms of Use - the master copy
lib/legal/documents/privacy/beta-1.md    the Privacy Policy - still a placeholder (unpinned)
lib/legal/registry.server.ts             versions, effective dates, pinned fingerprints. SERVER ONLY
lib/legal/render.ts                      the four-construct Markdown -> HTML renderer (escapes first)
lib/legal/document.ts                    the types - client-safe
lib/legal/paths.ts                       LEGAL_PATHS - every link to a document
lib/legal/client.ts                      reading one from a client component
app/api/legal/[kind]/[version]/route.ts  the document as JSON, STATIC (built from the .md)
app/terms, app/terms/[version]           the pages, and app/privacy likewise
components/ui/LegalDocumentPage.tsx      what those four pages render
```

## The rules

- **A published version is never edited.** A change of any kind — even a typo — is a new file
  (`beta-2.md`), never an edit, or every `terms_consent` row pointing at it looks tampered with.
  Old versions are never deleted: a person's consent names the version they read, and
  `/terms/<version>` must still be able to show it.
- **The normalised text is what is hashed and shown**: CRLF → LF, stripped, one trailing newline.
  That is part of the fingerprint's definition, so a Windows checkout still produces the pinned
  hash. `.prettierignore` excludes `lib/legal/documents` — a reformat would change the hash.
- **Pinning asserts the wording is final.** `terms/beta-1` has been pinned since 2026-09-18 to
  `c90a335e…`; `privacy/beta-1` is deliberately unpinned and shows the draft notice.
- **The renderer escapes before applying markup**, and understands only `# `, `## `, `- ` and
  `**bold**`. That is the whole reason `TermsModal` and `LegalDocumentPage` may use
  `dangerouslySetInnerHTML`. Do not reorder the two steps and do not reach for a Markdown
  library, which would pass raw HTML through. Its output is byte-identical to the markup Flask
  served until the move.
- **`registry.server.ts` must never reach a client component** — it opens files.
  `lib/legal/__tests__/serverOnly.test.ts` holds that line; a client component reads a document
  through `lib/legal/client.ts`.

## The pages

`/terms`, `/terms/<version>`, `/privacy`, `/privacy/<version>` — server components, in
`OPEN_PATHS` (`lib/hubPaths.ts`), so someone held at the Terms gate and someone who has not
signed up can both read them, and the gate never covers the document it is asking about. Each
page shows the version and effective date, **"Superseded"** on an archived version, the draft
notice while unpinned, and **the SHA-256 at the foot** — Minty's
`blueprints/legal/routes/admin.py` sends whoever reads a consent history there to check that
row's `document_hash`, so that line is load-bearing.

Every link to them is **relative**: opening the Terms from the gate panel or the sign-up tick box
stays on `my.dailyminty.com`. Flask's `/legal/terms` and `/legal/privacy` are deleted and 404.

## Who reads a document, and how

| Reader                                                          | Asks Flask                                                                               | Asks this app                                  |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------- |
| The Terms gate (`components/ui/TermsGate.tsx`)                  | `GET /api/me/terms` — which version is owed, its `sha256`, whether it is a re-acceptance | `GET /api/legal/terms/<version>` — the wording |
| Sign-up's tick box (`features/auth/api/signIn.ts::signUpTerms`) | `GET /legal/current` — the live version                                                  | `GET /api/legal/terms/<version>`               |
| The pages                                                       | nothing                                                                                  | the registry directly                          |

**The two must agree.** Before drawing anything, the gate compares Flask's version and
fingerprint with the document it just read. A mismatch, or a version this app does not hold,
means the two services are deployed out of step: it logs loudly and **fails open** — showing
nobody a document Flask would misrecord, and locking nobody out. Flask's own gate still blocks
every Flask page meanwhile.

Accepting posts `{accepted: true, terms_version, document_hash}`. The hash is a **canary**, never
what Flask stores: Flask compares it to its own manifest and refuses a mismatch (409
`document_mismatch`), so a stale bundle cannot file a consent row against wording nobody saw.

## Drift between the two repos

Flask holds the same version/hash table without the text (`Minty/legal/registry.py`), because it
stamps `terms_consent.document_hash` server-side and must never take a hash from a client. **The
two tables must be changed together.** What catches a divergence, earliest first:

1. `lib/legal/__tests__/registry.test.ts` — an edited `.md` here (it re-hashes every file and
   holds `c90a335e…` as a frozen literal).
2. Minty's `tests/test_legal_manifest.py` — the manifest's invariants there.
3. The stack e2e job — the two **running** services compared.
4. `TermsGate`'s pre-check — fails open, loudly.
5. `POST /api/me/terms/accept`'s 409 `document_mismatch` — should be unreachable.

## Tests

`lib/legal/__tests__/registry.test.ts` (fingerprints, normalisation, the pin, 23 sections and 106
bullets), `render.test.ts` (escaping, the four constructs, Python-identical output),
`serverOnly.test.ts`, `components/ui/__tests__/LegalDocumentPage.test.tsx` (the four parts of a
page, including Superseded and Draft, which no URL can reach while `beta-1` is the only version),
`components/ui/__tests__/TermsGate.test.tsx` (the two reads, the hash pre-check, failing open on a
mismatch). In the browser `e2e/09_terms.spec.ts` shows the **real** document in the panel and
asserts the real fingerprint is posted back; `features/auth/e2e/10_login.spec.ts` covers sign-up's
panel.
