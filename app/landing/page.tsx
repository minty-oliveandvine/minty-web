"use client";

import { readLanding, useLandingHandoff, type LandingParams } from "@minty/shared/landing";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { redirectToHandoff } from "@/lib/handoff";
import { HUB_HOME } from "@/lib/hubPaths";

/**
 * Where accounts-api sends people: `/landing?code=<one-time code>&next=<path>&entity_id=…&
 * entity_name=…` (gap 4, 2026-11-09: a code, never the token). The shared hook swaps the code for
 * the token, stores it (lib/auth.ts) and forwards to `next`. Reached with neither - a bookmark, a
 * stale tab - it goes to accounts-api's re-handoff for `next`, which comes back here with one. A
 * code that cannot be swapped (used, run out) says so, and Continue takes that same way back.
 */
const accountsApiUrl = () => env.ACCOUNTS_API_URL;
const backThroughHandoff = (landing: LandingParams) =>
  redirectToHandoff(landing.next, landing.entityId || undefined);

function LandingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refused } = useLandingHandoff({
    searchParams,
    router,
    setAuth,
    home: HUB_HOME,
    onNoToken: backThroughHandoff,
    accountsApiUrl,
  });

  if (refused) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
          <p role="alert" className="text-sm text-primary">
            {refused}
          </p>
          <button
            type="button"
            onClick={() => backThroughHandoff(readLanding(searchParams, HUB_HOME))}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl bg-[#3CBCC3] px-5 text-sm font-semibold text-white hover:bg-[#35B2B9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2FA4AB] active:bg-[#2FA4AB]"
          >
            Continue
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted" role="status">
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
