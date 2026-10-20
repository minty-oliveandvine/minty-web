/**
 * The live Privacy Policy - this app's own page since 2026-10-12 (Flask's `/legal/privacy` is
 * gone). An OPEN path, like the Terms: nobody has to be signed in to read it.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalDocumentPage } from "@/components/ui/LegalDocumentPage";
import { PRIVACY } from "@/lib/legal/document";
import { getCurrent } from "@/lib/legal/registry.server";

export const metadata: Metadata = { title: "Privacy Policy - Minty" };

export default function Privacy() {
  const document = getCurrent(PRIVACY);
  // No live document is a deployment fault, not a missing page - but 404 is the only honest
  // answer to the reader, and `verifyPinnedHashes()` is what reports it to us.
  if (!document) notFound();
  return <LegalDocumentPage document={document} />;
}
