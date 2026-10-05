"use client";

/**
 * Which company a company page's address names - `/entities/<shortid>/<name>/…` (lib/companyRef.ts).
 * Every company page this app draws (module choice, the settings tabs) resolves it the same way:
 *
 * - The token held is that company's (the cookie's entity): done, no request.
 * - Otherwise the person's entity list (Flask's hub API) says which company the short id is; the
 *   token is another company's, so Flask's hand-off mints one for this company and comes back.
 * - A name that is not the company's current one is replaced in the address bar (the short id
 *   decides; the name is only for reading). A full id in place of the short one - an old
 *   address - resolves the same way. An unknown short id says so, and is logged.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { mintyFetch } from "@/lib/apiClient";
import { getAuth } from "@/lib/auth";
import { shortIdOf, slugifyName } from "@/lib/companyRef";
import { redirectToHandoff } from "@/lib/handoff";

export type AddressedCompany = { id: string; name: string };

export type CompanyResolution =
  | { state: "loading" }
  | { state: "ready"; company: AddressedCompany }
  | { state: "unknown" };

/** The person's companies whose id starts with `shortId` (Flask's hub list; bearer). */
async function companiesStartingWith(shortId: string): Promise<AddressedCompany[]> {
  const answer = await mintyFetch<{ entities: AddressedCompany[] }>("/api/me/entities");
  return answer.entities.filter((e) => shortIdOf(e.id) === shortId.toLowerCase());
}

/**
 * @param pathOf the page's own address for a company - where a wrong name is corrected to, and
 *   where Flask's hand-off comes back to. Pass a module-level function: a new one each render
 *   would look the company up again.
 * @param label names the page in the console when the address matches nothing.
 */
export function useCompanyFromAddress(
  ref: string,
  slug: string | null,
  pathOf: (entityId: string, entityName: string) => string,
  label: string,
): CompanyResolution {
  const router = useRouter();
  const [resolution, setResolution] = useState<CompanyResolution>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    const auth = getAuth();
    const keep = window.location.search;
    const settle = (company: AddressedCompany) => {
      if (slug === null || slug !== slugifyName(company.name) || ref !== shortIdOf(company.id)) {
        router.replace(pathOf(company.id, company.name) + keep);
      }
      if (!cancelled) setResolution({ state: "ready", company });
    };

    const fullId = ref.length > 8 ? ref : null;
    if (auth?.entityId && (auth.entityId === fullId || shortIdOf(auth.entityId) === ref.toLowerCase())) {
      settle({ id: auth.entityId, name: auth.entityName });
      return () => {
        cancelled = true;
      };
    }
    companiesStartingWith(shortIdOf(ref))
      .then((matches) => {
        if (cancelled) return;
        const match =
          matches.find((c) => c.id === fullId) ??
          (matches.length === 1 ? matches[0] : matches.find((c) => slugifyName(c.name) === slug));
        if (!match) {
          console.error(`[${label}] no company of yours matches /entities/${ref}`);
          setResolution({ state: "unknown" });
          return;
        }
        redirectToHandoff(pathOf(match.id, match.name) + keep, match.id);
      })
      .catch((err) => {
        console.error(`[${label}] the company could not be looked up`, err);
        if (!cancelled) setResolution({ state: "unknown" });
      });
    return () => {
      cancelled = true;
    };
  }, [ref, slug, router, pathOf, label]);

  return resolution;
}
