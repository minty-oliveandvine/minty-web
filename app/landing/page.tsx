"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { useLandingHandoff, type LandingParams } from "@minty/shared/landing";

import { setAuth } from "@/lib/auth";
import { redirectToHandoff } from "@/lib/handoff";
import { HUB_HOME } from "@/lib/hubPaths";

/** Reached with no token - a bookmark, a stale tab: Flask's re-handoff for `next`. */
const backThroughFlask = ({ next, entityId }: LandingParams) =>
  redirectToHandoff(next, entityId || undefined);

/**
 * Where Minty sends people: `/landing?token=<jwt>&next=<path>&entity_id=…&entity_name=…`.
 * Stores the token (lib/auth.ts) and forwards to a safe `next` (the hub home otherwise). Reached
 * with no token it goes to Flask's re-handoff for `next`, which comes back here with one. The
 * logic is `useLandingHandoff` from `@minty/shared/landing` (owner 2026-10-21: one shared
 * module); this app supplies its cookie, its home and its way back.
 */
function LandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useLandingHandoff({ searchParams, router, setAuth, home: HUB_HOME, onNoToken: backThroughFlask });

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-ink-2" role="status">
        Loading…
      </p>
    </main>
  );
}

export default function Landing() {
  return (
    <Suspense>
      <LandingContent />
    </Suspense>
  );
}
