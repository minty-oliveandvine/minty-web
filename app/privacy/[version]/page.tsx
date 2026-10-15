/**
 * One version of the Privacy Policy - `/privacy/beta-1`. Old versions are never deleted, so a
 * person can still read the policy that was live when they signed up.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalDocumentPage } from "@/components/ui/LegalDocumentPage";
import { PRIVACY } from "@/lib/legal/document";
import { allVersions, getDocument } from "@/lib/legal/registry.server";

export const dynamicParams = false;

export function generateStaticParams() {
  return allVersions(PRIVACY).map((version) => ({ version }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ version: string }>;
}): Promise<Metadata> {
  const { version } = await params;
  return { title: `Privacy Policy (${version}) - Minty` };
}

export default async function PrivacyVersion({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params;
  const document = getDocument(PRIVACY, version);
  if (!document) notFound();
  return <LegalDocumentPage document={document} />;
}
