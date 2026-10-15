/**
 * One legal document as JSON - the only API this app serves, because it is the only data this app
 * owns (the Terms of Use and the Privacy Policy, since 2026-10-12).
 *
 * `/api/legal/terms/current` for the live wording, `/api/legal/terms/beta-1` for a named version.
 * The body is deliberately the shape Flask's deleted `GET /legal/content/<kind>` had, plus
 * `is_current`, so a reader coming from that contract is not surprised.
 *
 * STATIC. `generateStaticParams` enumerates every kind x version plus the literal `current`, and
 * `dynamicParams = false` 404s anything else, so the JSON is rendered from the `.md` at BUILD
 * time and no request ever reads the filesystem. That also keeps `registry.server.ts` out of any
 * runtime path, which matters if this app is ever built with `output: "standalone"` - a runtime
 * `fs` read would need the documents traced into the bundle; a build-time one cannot.
 *
 * Who reads it: `components/ui/TermsGate.tsx` (the document behind the gate panel) and
 * `features/auth/api/signIn.ts` (the sign-up tick box), both through `lib/legal/client.ts`. The
 * pages at `/terms` and `/privacy` do NOT - they are server components and read the registry
 * directly.
 */

import { DOCUMENT_KINDS, isDocumentKind } from "@/lib/legal/document";
import { allVersions, currentVersion, getDocument } from "@/lib/legal/registry.server";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DOCUMENT_KINDS.flatMap((kind) =>
    [...allVersions(kind), "current"].map((version) => ({ kind, version })),
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; version: string }> },
) {
  const { kind, version } = await params;
  if (!isDocumentKind(kind)) {
    return Response.json({ error: "No such document." }, { status: 404 });
  }

  const asked = version === "current" ? currentVersion(kind) : version;
  const document = getDocument(kind, asked);
  if (!document) {
    return Response.json({ error: "No such document." }, { status: 404 });
  }

  return Response.json(document, {
    headers: {
      // A named version is immutable - a change is a new file, never an edit. `current` moves
      // when CURRENT_TERMS_VERSION does, which is a deploy, so it is only ever revalidated.
      "Cache-Control":
        version === "current"
          ? "public, max-age=0, must-revalidate"
          : "public, max-age=31536000, immutable",
    },
  });
}
