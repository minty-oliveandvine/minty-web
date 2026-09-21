"use client";

/**
 * State and orchestration of the module settings page. The screen calls this and renders
 * what it returns; nothing here knows what the page looks like.
 *
 * Load: the page model, then each card through `resolveModuleState`. Before the first load, the
 * two ways the page can be re-entered are settled: `?session_id=` (back from Stripe Checkout -
 * `checkout-complete` is posted, then the parameter is dropped from the URL so a reload does not
 * post it again) and `?checkout_error=` (Flask's way of carrying a failed return; shown, then
 * dropped). Both are read ONCE, at mount, so stripping them does not re-run the effect.
 *
 * Actions: `startTrial` is the one CTA that acts here (posts, then refetches; the API's sentence
 * goes to a toast). The other CTAs are seams - they navigate to the sub-page that owns the flow
 * (`lib/paths.ts::moduleRoutes`), each built in its own step from its own Figma frame.
 *
 * `fixture`: a dev-only switch (`?fixture=A` … `F`) that serves the page model from
 * `__fixtures__/modulePage.ts` instead of the API, so the six states can be looked at in
 * `next dev` while the API is still a stub. Ignored in production builds; the fixtures load
 * through a dynamic import so they stay out of the production bundle. Removed in Part 2 step 5.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ApiError } from "@/lib/apiClient";
import { useToast } from "@/components/ui/Toast";

import {
  completeCheckout,
  getModulePage,
  startTrial as postStartTrial,
  type ModuleCode,
  type ModulePage,
} from "@/features/subscription/api/moduleSettings";
import {
  paymentFailed,
  resolveModuleState,
  sharedCta,
  type ModuleCta,
  type ModuleView,
} from "@/features/subscription/lib/moduleState";
import { moduleRoutes } from "@/features/subscription/lib/paths";

export type UseModulePageArgs = {
  entityId: string;
  sessionId?: string | null;
  purpose?: string | null;
  checkoutError?: string | null;
  fixture?: string | null;
  /** The day the "N days remaining" counts from; defaults to now. Tests pin it. */
  today?: Date;
};

export type ModulePageStatus = "loading" | "ready" | "error";

export type UseModulePageResult = {
  status: ModulePageStatus;
  page: ModulePage | null;
  views: ModuleView[];
  /** One CTA for both cards (frames B, C), or null when each card keeps its own. */
  shared: ModuleCta | null;
  /** The "Payment failed" banner. */
  paymentFailed: boolean;
  /** The module whose trial is being started right now. */
  busyCode: ModuleCode | null;
  /** The load error's sentence, when `status` is "error". */
  error: string | null;
  reload: () => void;
  startTrial: (code: ModuleCode) => Promise<void>;
  manage: () => void;
  activate: (code: ModuleCode) => void;
  resume: (code: ModuleCode) => void;
  reactivate: (code: ModuleCode) => void;
  updatePaymentMethod: () => void;
};

/** Drop query parameters from the address bar without a navigation. */
function stripParams(names: string[]): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const name of names) {
    if (url.searchParams.has(name)) {
      url.searchParams.delete(name);
      changed = true;
    }
  }
  if (changed) window.history.replaceState(window.history.state, "", url.toString());
}

/** Shown while the API's modules router is still a stub (Part 2 step 3 fills it). */
export const NOT_WIRED_YET =
  "This page's data isn't served by the subscription service yet - the API lands in Part 2 step 3.";

/** The API's dark answer (`SubscriptionsDarkMiddleware`): 404 with this one word. */
export const SERVICE_DARK =
  "The subscription service is switched off (SUBSCRIPTION_ENABLED=0 on minty-billing-api), so nothing is served.";

function sentence(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 501) return NOT_WIRED_YET;
    if (err.status === 404 && err.message === "not_found") return SERVICE_DARK;
    return err.message;
  }
  return "Something went wrong on my end. Mind trying again?";
}

async function fetchPageModel(
  entityId: string,
  fixture: string | null | undefined,
): Promise<{ page: ModulePage; today: Date | null }> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const fixtures = await import("@/features/subscription/__fixtures__/modulePage");
    if (fixtures.isFixtureFrame(fixture)) {
      return { page: fixtures.FIXTURES[fixture], today: fixtures.TODAY };
    }
  }
  return { page: await getModulePage(entityId), today: null };
}

export function useModulePage({
  entityId,
  sessionId,
  purpose,
  checkoutError,
  fixture,
  today,
}: UseModulePageArgs): UseModulePageResult {
  const router = useRouter();
  const { showToast } = useToast();

  const [status, setStatus] = useState<ModulePageStatus>("loading");
  const [page, setPage] = useState<ModulePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<ModuleCode | null>(null);
  const [fixtureToday, setFixtureToday] = useState<Date | null>(null);
  const [generation, setGeneration] = useState(0);

  // The return parameters are settled once, at mount; a later change (we strip them) must not
  // start the sequence again.
  const arrival = useRef({ sessionId, purpose, checkoutError });

  const load = useCallback(async () => {
    const { page: model, today: pinned } = await fetchPageModel(entityId, fixture);
    setPage(model);
    setFixtureToday(pinned);
    setStatus("ready");
    setError(null);
  }, [entityId, fixture]);

  useEffect(() => {
    let cancelled = false;
    const { sessionId: sid, purpose: why, checkoutError: failed } = arrival.current;
    arrival.current = { sessionId: null, purpose: null, checkoutError: null };

    (async () => {
      if (sid) {
        try {
          await completeCheckout(entityId, sid, why ?? undefined);
        } catch (err) {
          if (!cancelled) showToast(sentence(err), "error");
        }
        stripParams(["session_id", "purpose"]);
      }
      if (failed) {
        showToast(failed, "error");
        stripParams(["checkout_error"]);
      }
      try {
        await load();
      } catch (err) {
        if (cancelled) return;
        setError(sentence(err));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entityId, load, generation, showToast]);

  const reload = useCallback(() => {
    setStatus("loading");
    setGeneration((g) => g + 1);
  }, []);

  const views = useMemo(() => {
    if (!page) return [];
    const day = fixtureToday ?? today ?? new Date();
    return page.cards.map((card) => resolveModuleState(card, day));
  }, [page, fixtureToday, today]);

  const startTrial = useCallback(
    async (code: ModuleCode) => {
      setBusyCode(code);
      try {
        await postStartTrial(entityId, code);
        await load();
      } catch (err) {
        showToast(sentence(err), "error");
      } finally {
        setBusyCode(null);
      }
    },
    [entityId, load, showToast],
  );

  const routes = useMemo(() => moduleRoutes(entityId), [entityId]);
  const manage = useCallback(() => router.push(routes.manage), [router, routes]);
  const activate = useCallback(
    (code: ModuleCode) => router.push(routes.activate(code)),
    [router, routes],
  );
  const resume = useCallback(
    (code: ModuleCode) => router.push(routes.resume(code)),
    [router, routes],
  );
  const reactivate = useCallback(
    (code: ModuleCode) => router.push(routes.reactivate(code)),
    [router, routes],
  );
  const updatePaymentMethod = useCallback(
    () => router.push(routes.paymentMethod),
    [router, routes],
  );

  return {
    status,
    page,
    views,
    shared: sharedCta(views),
    paymentFailed: paymentFailed(views),
    busyCode,
    error,
    reload,
    startTrial,
    manage,
    activate,
    resume,
    reactivate,
    updatePaymentMethod,
  };
}
