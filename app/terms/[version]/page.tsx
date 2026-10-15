/**
 * One version of the Terms of Use - `/terms/beta-1`. Old versions are never deleted: a consent
 * row names the version that person read, and the gate panel links here with "the version you
 * agreed to is here" when the wording has changed since.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalDocumentPage } from "@/components/ui/LegalDocumentPage";
import { TERMS } from "@/lib/legal/document";
import { allVersions, getDocument } from "@/lib/legal/registry.server";

export const dynamicParams = false;

export function generateStaticParams() {
  return allVersions(TERMS).map((version) => ({ version }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ version: string }>;
}): Promise<Metadata> {
  const { version } = await params;
  return { title: `Terms of Use (${version}) - Minty` };
}

export default async function TermsVersion({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  const document = getDocument(TERMS, version);
  if (!document) notFound();
  return <LegalDocumentPage document={document} />;
}
