/**
 * A company page's browser tab: "<page> - <company>", as Flask's and minty-payment-request-web's
 * tabs read (its `app/entity/[ref]/[slug]/layout.tsx`). Server-only - it reads the cookies.
 *
 * The company is the cookie's (lib/auth.ts) when the address names it - its short id, or an old
 * full id. When it names another company, the page hands over to Flask for that one
 * (lib/companyFromAddress.ts) and the tab says only the page until it is back.
 */

import type { Metadata } from "next";
import { cookies } from "next/headers";

import { ENTITY_ID_COOKIE_NAME, ENTITY_NAME_COOKIE_NAME } from "@/lib/auth";
import { shortIdOf } from "@/lib/companyRef";

type CompanyPageProps = { params: Promise<{ ref: string }> };

/** A page's `generateMetadata`, titled `page`. */
export function companyPageMetadata(page: string): (props: CompanyPageProps) => Promise<Metadata> {
  return async function generateMetadata({ params }: CompanyPageProps): Promise<Metadata> {
    const { ref } = await params;
    const jar = await cookies();
    const entityId = jar.get(ENTITY_ID_COOKIE_NAME)?.value ?? "";
    const company = jar.get(ENTITY_NAME_COOKIE_NAME)?.value?.trim();
    const named = entityId !== "" && (entityId === ref || shortIdOf(entityId) === ref.toLowerCase());
    return { title: named && company ? `${page} - ${company}` : page };
  };
}
