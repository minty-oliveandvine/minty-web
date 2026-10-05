"use client";

/**
 * `/subscription/entities/[ref]/[slug]/modules` - Flask's settings/modules, re-homed, addressed
 * by the company's short id and name (`lib/companyRef.ts`, 2026-10-05). The re-exports in
 * `app/subscription/entities/[ref]/...` make the route parameters a client concern, so they are
 * read here. The query string carries only `fixture` (dev only - see the hook); the way back is
 * the page the person came from (components/ui/BackLink.tsx). Nothing returns here from Stripe.
 *
 * The address names the company by the first 8 characters of its id, so the full id comes from
 * the token the person holds when it is that company's; otherwise from their entity list, and
 * then Flask's hand-off mints a token scoped to it. A name that is not the company's current one
 * is replaced in the address bar; an unknown short id says so.
 *
 * `/subscription/entities/[ref]/modules` (`LegacyModuleSettingsPage`) is the pre-2026-10-05
 * address with the full id; it moves to this one.
 *
 * `useSearchParams` needs a Suspense boundary or `next build` refuses the page.
 */

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { mintyFetch } from "@/lib/apiClient";
import { getAuth } from "@/lib/auth";
import { shortIdOf, slugifyName } from "@/lib/companyRef";
import { redirectToHandoff } from "@/lib/handoff";

import { modulesPath } from "@/features/subscription/lib/paths";
import { ModuleSettingsScreen } from "@/features/subscription/routes/ModuleSettingsScreen";

type Company = { id: string; name: string };
type Resolution = { state: "loading" } | { state: "ready"; entityId: string } | { state: "unknown" };

/** The person's companies whose id starts with `shortId` (Flask's hub list; bearer). */
async function companiesStartingWith(shortId: string): Promise<Company[]> {
  const answer = await mintyFetch<{ entities: Company[] }>("/api/me/entities");
  return answer.entities.filter((e) => shortIdOf(e.id) === shortId.toLowerCase());
}

function useCompanyFromAddress(ref: string, slug: string | null): Resolution {
  const router = useRouter();
  const [resolution, setResolution] = useState<Resolution>({ state: "loading" });

  useEffect(() => {
    let cancelled = false;
    const auth = getAuth();
    const keep = window.location.search;
    const settle = (entityId: string, name: string) => {
      const canonical = modulesPath(entityId, name);
      if (slug === null || slug !== slugifyName(name) || ref !== shortIdOf(entityId)) {
        router.replace(canonical + keep);
      }
      if (!cancelled) setResolution({ state: "ready", entityId });
    };

    // The full id in the address (the old route): only the name is missing.
    const fullId = ref.length > 8 ? ref : null;
    if (auth?.entityId && (auth.entityId === fullId || shortIdOf(auth.entityId) === ref.toLowerCase())) {
      settle(auth.entityId, auth.entityName);
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
          console.error(`[module settings] no company of yours matches /entities/${ref}`);
          setResolution({ state: "unknown" });
          return;
        }
        // The token held is another company's: Flask mints one for this company and comes back.
        redirectToHandoff(modulesPath(match.id, match.name) + keep, match.id);
      })
      .catch((err) => {
        console.error("[module settings] the company could not be looked up", err);
        if (!cancelled) setResolution({ state: "unknown" });
      });
    return () => {
      cancelled = true;
    };
  }, [ref, slug, router]);

  return resolution;
}

function ModuleSettingsContent() {
  const params = useParams<{ ref: string; slug?: string }>();
  const q = useSearchParams();
  const resolution = useCompanyFromAddress(params.ref, params.slug ?? null);

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
  return <ModuleSettingsScreen entityId={resolution.entityId} fixture={q.get("fixture")} />;
}

export function ModuleSettingsPage() {
  return (
    <Suspense>
      <ModuleSettingsContent />
    </Suspense>
  );
}

/** The old address, `/subscription/entities/<full id>/modules`: the same page, which moves the
 * address bar to the short id and name. */
export const LegacyModuleSettingsPage = ModuleSettingsPage;
