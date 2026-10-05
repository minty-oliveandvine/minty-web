"use client";

/**
 * A company page's shell: resolves the company its address names (`lib/companyFromAddress.ts`)
 * and draws the page only then - "Loading…" until it is known, a plain sentence when the address
 * names none of the person's companies.
 */

import { useParams } from "next/navigation";
import type { ReactNode } from "react";

import { useCompanyFromAddress, type AddressedCompany } from "@/lib/companyFromAddress";

export function CompanyFromAddress({
  pathOf,
  label,
  children,
}: {
  pathOf: (entityId: string, entityName: string) => string;
  label: string;
  children: (company: AddressedCompany) => ReactNode;
}) {
  const params = useParams<{ ref: string; slug?: string }>();
  const resolution = useCompanyFromAddress(params.ref, params.slug ?? null, pathOf, label);

  if (resolution.state === "unknown") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-center text-sm text-danger" role="alert">
          I couldn&apos;t find that company among yours.
        </p>
      </main>
    );
  }
  if (resolution.state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted" role="status">
          Loading…
        </p>
      </main>
    );
  }
  return <>{children(resolution.company)}</>;
}
