"use client";

/**
 * State and orchestration of the module settings page. The screen calls this and renders
 * what it returns; nothing here knows what the page looks like.
 *
 * Load: the page model, then each card through `resolveModuleState`. There is no return from
 * Stripe to settle: nothing in the app hands the browser to a Stripe-hosted page any more (the
 * user, 2026-10-01 - a card is only ever added through a billing account, in the app).
 *
 * Actions: starting a trial is the one CTA that acts here, and it ASKS FIRST - `askStartTrial`
 * opens Figma 04-G's dialog (`StartTrialDialog`, the same one the list uses), `confirmStartTrial`
 * posts and then LEAVES for the list, where the company's row says what happened (RV11); the
 * API's sentence goes to a toast and the dialog stays open to try again. The other CTAs are
 * seams - they navigate to the sub-page that owns the flow
 * (`lib/paths.ts::moduleRoutes`), each built in its own step from its own Figma frame.
 *
 * `fixture`: a dev-only switch (`?fixture=A` … `F`) that serves the page model from
 * `__fixtures__/modulePage.ts` instead of the API, so the six states can be looked at in
 * `next dev` while the API is still a stub. Ignored in production builds; the fixtures load
 * through a dynamic import so they stay out of the production bundle. Removed in Part 2 step 5.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError } from "@/lib/apiClient";
import { useToast } from "@/components/ui/Toast";

import {
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
import { BILLING, moduleRoutes } from "@/features/subscription/lib/paths";

export type UseModulePageArgs = {
  entityId: string;
  fixture?: string | null;
  /** The day the "N days remaining" counts from; defaults to now. Tests pin it. */
  today?: Date;
};

export type ModulePageStatus = "loading" | "ready" | "error";

/** A trial asked about and not yet confirmed: the module, and its name for the dialog. */
export type ModuleTrialPrompt = { code: ModuleCode; moduleName: string };

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
  /** The trial asked about and not yet confirmed; while it is set the screen shows the dialog. */
  trialPrompt: ModuleTrialPrompt | null;
  askStartTrial: (code: ModuleCode) => void;
  dismissTrialPrompt: () => void;
  confirmStartTrial: () => Promise<void>;
  manage: () => void;
  activate: (code: ModuleCode) => void;
  resume: (code: ModuleCode) => void;
  reactivate: (code: ModuleCode) => void;
  updatePaymentMethod: () => void;
};

/** Shown while the API's modules router is still a stub (Part 2 step 3 fills it). */
export const NOT_WIRED_YET =
  "This page's data isn't served by the subscription service yet - the API lands in Part 2 step 3.";

function sentence(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 501) return NOT_WIRED_YET;
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
  fixture,
  today,
}: UseModulePageArgs): UseModulePageResult {
  const router = useRouter();
  const { showToast } = useToast();

  const [status, setStatus] = useState<ModulePageStatus>("loading");
  const [page, setPage] = useState<ModulePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<ModuleCode | null>(null);
  const [trialPrompt, setTrialPrompt] = useState<ModuleTrialPrompt | null>(null);
  const [fixtureToday, setFixtureToday] = useState<Date | null>(null);
  const [generation, setGeneration] = useState(0);

  const load = useCallback(async () => {
    const { page: model, today: pinned } = await fetchPageModel(entityId, fixture);
    setPage(model);
    setFixtureToday(pinned);
    setStatus("ready");
    setError(null);
  }, [entityId, fixture]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
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
  }, [load, generation]);

  const reload = useCallback(() => {
    setStatus("loading");
    setGeneration((g) => g + 1);
  }, []);

  const views = useMemo(() => {
    if (!page) return [];
    const day = fixtureToday ?? today ?? new Date();
    return page.cards.map((card) => resolveModuleState(card, day));
  }, [page, fixtureToday, today]);

  // Starting a trial is asked about first (Figma 04-G), as it is from the list: press, confirm,
  // then the post. The module's name comes from the page model the card was drawn from.
  const askStartTrial = useCallback(
    (code: ModuleCode) => {
      const moduleName = page?.cards.find((c) => c.code === code)?.name ?? code;
      setTrialPrompt({ code, moduleName });
    },
    [page],
  );

  const dismissTrialPrompt = useCallback(() => {
    if (!busyCode) setTrialPrompt(null);
  }, [busyCode]);

  const confirmStartTrial = useCallback(async () => {
    if (!trialPrompt) return;
    const { code } = trialPrompt;
    setBusyCode(code);
    try {
      await postStartTrial(entityId, code);
      setTrialPrompt(null);
      // The news is told on the list, in the company's row (Figma RV11), as it is when a trial
      // is started from there - so this page is left rather than refetched.
      router.push(moduleRoutes(entityId).started(code));
    } catch (err) {
      // The dialog stays open on a refusal, so the answer can be read and tried again.
      showToast(sentence(err), "error");
    } finally {
      setBusyCode(null);
    }
  }, [trialPrompt, entityId, router, showToast]);

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
  // 03-F's "Payment failed … here": the card that failed is the company's BILLING ACCOUNT's
  // card, so this opens that account's page (08-B, its details and payment methods) by
  // `?entity=`, as the list's banner does - not a per-company screen (the user, 2026-09-29).
  const updatePaymentMethod = useCallback(
    () => router.push(BILLING.account({ entity: entityId })),
    [router, entityId],
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
    trialPrompt,
    askStartTrial,
    dismissTrialPrompt,
    confirmStartTrial,
    manage,
    activate,
    resume,
    reactivate,
    updatePaymentMethod,
  };
}
