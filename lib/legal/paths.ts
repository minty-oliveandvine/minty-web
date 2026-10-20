/**
 * Where the legal documents live IN THIS APP - the one place their addresses are spelled.
 *
 * They are this app's own pages since 2026-10-12, so every link to them is RELATIVE: opening the
 * Terms from the gate panel, from the sign-up tick box or from an "updated since you agreed"
 * notice stays on `my.dailyminty.com`, and never sends anyone to Flask (whose `/legal/terms` and
 * `/legal/privacy` are deleted). `GET /api/me/terms` no longer returns links for the same reason
 * - Flask cannot hand out a path to a page it does not serve.
 *
 * These paths must stay in `OPEN_PATHS` (lib/hubPaths.ts): someone held at the Terms gate, and
 * someone who has not signed up at all, both have to be able to read what they are agreeing to.
 */

import type { DocumentKind } from "@/lib/legal/document";

export const LEGAL_PATHS = {
  /** The live Terms of Use. */
  terms: "/terms",
  /** The live Privacy Policy. */
  privacy: "/privacy",
  /** One archived version, for "the version you agreed to is here". */
  termsVersion: (version: string) => `/terms/${version}`,
  /** The document as JSON - `app/api/legal/[kind]/[version]`, this app's own route handler. */
  api: (kind: DocumentKind, version = "current") => `/api/legal/${kind}/${version}`,
} as const;
