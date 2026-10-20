/**
 * The live Terms of Use - this app's own page since 2026-10-12 (Flask's `/legal/terms` is gone).
 * An OPEN path: readable by someone held at the Terms gate and by someone who has not signed up.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalDocumentPage } from "@/components/ui/LegalDocumentPage";
import { TERMS } from "@/lib/legal/document";
import { getCurrent } from "@/lib/legal/registry.server";

export const metadata: Metadata = { title: "Terms of Use - Minty" };

export default function Terms() {
  const document = getCurrent(TERMS);
  // No live document is a deployment fault, not a missing page - but 404 is the only honest
  // answer to the reader, and `verifyPinnedHashes()` is what reports it to us.
  if (!document) notFound();
  return <LegalDocumentPage document={document} />;
}
