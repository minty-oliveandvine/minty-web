"use client";

/**
 * State and orchestration of the module settings page. The screen calls this and renders
 * what it returns; nothing here knows what the page looks like.
 *
 * Load: the page model, then each card through `resolveModuleState`. There is no return from
 * Stripe to settle: nothing in the app hands the browser to a Stripe-hosted page any more (the
 * user, 2026-10-01 - a card is only ever added through a billing account, in the app).
 *
 * Actions: TWO CTAs act here, and both ask first.
 *
 * Starting a trial - `askStartTrial` opens Figma 04-G's dialog (`StartTrialDialog`, the same one
 * the list uses), `confirmStartTrial` posts and then LEAVES for the list, where the company's
 * row says what happened (RV11); the API's sentence goes to a toast and the dialog stays open
 * to try again.
 *
 * Activating the subscription - a trial establishes no SUBSCRIBER, so a company running one
 * that nobody has confirmed shows "Activate Subscription" instead of "Manage Subscription".
 * `activateTrial` opens the Billing Accounts picker, HERE on the page rather than through a
 * seam: the company belongs to no payer yet, and the act is one request. Confirming posts
 * `activate-subscription` with the account, which places the company on it, records consent and
 * makes the viewer the subscriber - charging nothing, because every module it confirms is a
 * RUNNING trial (seam `confirm_trial`), which is the one thing `activate-subscription` already
 * does. The list's twin applies its ticks afterwards and so can charge; this page has no ticks.
 * A 402 asks the sheet again with the API's own sentence, as Manage Subscriptions does.
 *
 * It LANDS ON ITS RESULT in the cards' place (Figma 05.C), not on a toast - the page model is
 * read again and diffed against the one captured when the act began, through the same
 * `buildChangeResult` the list uses. Its button carries its own words and leaves for the
 * COMPANY's page, because that is where this journey started.
 *
 * The other CTAs are seams - they navigate to the sub-page that owns the flow
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

import { needsAccountChoice } from "@/features/subscription/api/moduleChanges";
import { buildChangeModal, type ChangeModal } from "@/features/subscription/lib/changeModal";
import { buildChangeResult, type ChangeResult } from "@/features/subscription/lib/changeResult";

import {
  activateSubscription,
  getModulePage,
  startTrial as postStartTrial,
  type ModuleCode,
  type ModulePage,
} from "@/features/subscription/api/moduleSettings";
import {
  fetchBillingAccounts,
  type BillingAccounts,
} from "@/features/subscription/api/payerPortal";
import {
  ACCOUNTS_LOAD_FAILED,
  nominateLead,
  nominationChoice,
  type MoveTarget,
} from "@/features/subscription/lib/billingAccounts";
import {
  paymentFailed,
  resolveModuleState,
  sharedCta,
  type ModuleCta,
  type ModuleView,
} from "@/features/subscription/lib/moduleState";
import { BILLING, companyHome, moduleRoutes } from "@/features/subscription/lib/paths";

export type UseModulePageArgs = {
  entityId: string;
  fixture?: string | null;
  /** The day the "N days remaining" counts from; defaults to now. Tests pin it. */
  today?: Date;
};

export type ModulePageStatus = "loading" | "ready" | "error";

/**
 * The activation being asked about: the page model it is read against (captured when the act
 * begins), the modules it confirms, and the section-06 modal - null when `buildChangeModal`
 * had nothing to say, which is the straight-to-sheet path.
 */
type ActivateAsk = { page: ModulePage; codes: ModuleCode[]; modal: ChangeModal | null };

/** A trial asked about and not yet confirmed: the module, and its name for the dialog. */
export type ModuleTrialPrompt = { code: ModuleCode; moduleName: string };

/**
 * The Billing Accounts sheet, open over the page because the subscription is being activated.
 * `key` remounts it so a re-ask starts from the API's new sentence; `targets` carries the rows
 * that cannot be picked with the reason why.
 */
export type ModuleAccountAsk = {
  data: BillingAccounts;
  picked: string | null;
  targets: MoveTarget[];
  error: string | null;
  lead: string;
  key: number;
};

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
  /** The Billing Accounts sheet while the subscription is being activated. */
  accountAsk: ModuleAccountAsk | null;
  /** Confirm is pressed and the activation is in flight; nothing closes the sheet. */
  activateBusy: boolean;
  activateTrial: () => Promise<void>;
  /** The section-06 modal Activate Subscription asks in, before Billing Accounts. */
  activatePrompt: ChangeModal | null;
  confirmActivatePrompt: () => Promise<void>;
  dismissActivatePrompt: () => void;
  /** Where the activation landed (Figma 05.C), shown in the cards' place until it is dismissed. */
  result: ChangeResult | null;
  /** Its button: back to the COMPANY's own page, not the payer's portal. */
  dismissResult: () => void;
  confirmActivate: (accountId: string, accounts?: BillingAccounts) => Promise<void>;
  dismissAccountAsk: () => void;
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
  const [accountAsk, setAccountAsk] = useState<ModuleAccountAsk | null>(null);
  const [activateBusy, setActivateBusy] = useState(false);
  const [activateAsk, setActivateAsk] = useState<ActivateAsk | null>(null);
  const [result, setResult] = useState<ChangeResult | null>(null);

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

  // ONE day for the whole page: the cards' "N days remaining" and the result's dates are read
  // off the same clock, so they cannot disagree.
  const day = useMemo(() => fixtureToday ?? today ?? new Date(), [fixtureToday, today]);

  const views = useMemo(() => {
    if (!page) return [];
    // `has_subscriber !== false` rather than `=== true`: a fixture or an older answer without
    // the key behaves as it did before, which is "the company has a payer".
    const hasSubscriber = page.has_subscriber !== false;
    return page.cards.map((card) => resolveModuleState(card, day, hasSubscriber));
  }, [page, day]);

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
    const before = page;
    setBusyCode(code);
    try {
      await postStartTrial(entityId, code);
      setTrialPrompt(null);
      // THE NEWS IS TOLD HERE, in the cards' place, exactly as an activation's is (the user,
      // 2026-10-08). It used to leave for the list and land on the row there (Figma RV11,
      // `?started=`), which meant a journey that began on this page ended on another, under a
      // button offering to go back to a third.
      const { page: after, today: pinned } = await fetchPageModel(entityId, fixture);
      setPage(after);
      setFixtureToday(pinned);
      if (before) {
        setResult(
          buildChangeResult(
            { kind: "start_trial", code },
            before,
            after,
            { entity_name: before.entity_name, created_at: null },
            pinned ?? day,
          ),
        );
      }
    } catch (err) {
      // The dialog stays open on a refusal, so the answer can be read and tried again.
      showToast(sentence(err), "error");
    } finally {
      setBusyCode(null);
    }
  }, [trialPrompt, page, entityId, fixture, day, showToast]);

  // --- Activate Subscription: the Billing Accounts sheet, here on the page ------------------
  //
  // An account with no card CANNOT be picked (`needCard`), even though confirming a running
  // trial charges nothing. Confirming billing to an account that has nothing to charge would
  // produce a company that looks activated and whose trial still expires - the one outcome
  // this screen exists to prevent.
  const askAccounts = useCallback(
    async (error: string | null) => {
      let data: BillingAccounts;
      try {
        data = await fetchBillingAccounts();
      } catch (err) {
        const said = err instanceof ApiError ? err.message : ACCOUNTS_LOAD_FAILED;
        showToast(error ? `${error} ${said}` : said, "error");
        return;
      }
      const { targets, picked } = nominationChoice(data, entityId, { needCard: true });
      setAccountAsk((ask) => ({
        data,
        picked,
        targets,
        error,
        lead: nominateLead(page?.entity_name ?? ""),
        key: (ask?.key ?? 0) + 1,
      }));
    },
    [entityId, page, showToast],
  );

  /** The modules this page would be confirming: every running trial with no subscriber. */
  const activateCodes = useMemo(
    () => views.filter((v) => v.state === "needs_activation").map((v) => v.code),
    [views],
  );

  // PER COMPANY, not per module, and that is why it takes no code: confirming billing gives
  // the company its subscriber and stamps every one of its module rows. Nothing is charged -
  // naming codes is how a LAPSED module is bought back, and a running trial must not.
  //
  // It ASKS FIRST, in the same section-06 modal Manage Subscriptions asks a change in (the
  // user, 2026-10-08), built from the modules being confirmed - an unconfirmed trial's seam is
  // `confirm_trial`, so the words are already the right ones. `buildChangeModal` can answer
  // null, and the button must not go dead with it: no modal, straight to the sheet.
  const activateTrial = useCallback(async () => {
    if (activateBusy || !page || !activateCodes.length) return;
    // THE BEFORE IS CAPTURED HERE, at the start of the act, not when the sheet confirms: a 402
    // re-asks the sheet, and a reload in between must not change what the result is diffed
    // against. The modal may be null (see above); the ask is made either way, so the straight-
    // to-sheet path carries its `before` too.
    const modal = buildChangeModal(page, activateCodes);
    setActivateAsk({ page, codes: activateCodes, modal });
    if (!modal) await askAccounts(null);
  }, [activateBusy, page, activateCodes, askAccounts]);

  /** The modal's Confirm: on to Billing Accounts, as the list's does. */
  const confirmActivatePrompt = useCallback(async () => {
    if (activateBusy) return;
    setActivateAsk((ask) => ask && { ...ask, modal: null });
    await askAccounts(null);
  }, [activateBusy, askAccounts]);

  const dismissActivatePrompt = useCallback(() => {
    if (!activateBusy) setActivateAsk(null);
  }, [activateBusy]);

  const confirmActivate = useCallback(
    async (accountId: string) => {
      if (activateBusy) return;
      const ask = activateAsk;
      setActivateBusy(true);
      try {
        await activateSubscription(entityId, accountId);
        // The page model is read AGAIN rather than reloaded: this answer IS the after-model the
        // result is diffed against, and `reload()` would be a second GET with a "Loading..."
        // flash under the result. `fetchPageModel`, not `getModulePage`, so `?fixture=` stays
        // offline in `next dev`.
        const { page: after, today: pinned } = await fetchPageModel(entityId, fixture);
        setAccountAsk(null);
        setPage(after);
        setFixtureToday(pinned);
        // No toast: the result says it, and the same news twice over it reads as a flow that
        // does not believe in its own result screen. `created_at` is not on the page model, so
        // the footer loses its "originally created" sentence and keeps the rest.
        if (ask) {
          setResult(
            buildChangeResult(
              { kind: "ticks", codes: ask.codes },
              ask.page,
              after,
              { entity_name: ask.page.entity_name, created_at: null },
              pinned ?? day,
            ),
          );
        }
        setActivateAsk(null);
      } catch (err) {
        if (needsAccountChoice(err)) {
          // The sheet is asked AGAIN for the same act, with the API's sentence as its error -
          // the loop Manage Subscriptions already uses. A refusal left the company exactly as
          // subscriber-less as it was, so pressing again is safe.
          await askAccounts(err instanceof ApiError ? err.message : null);
          return;
        }
        showToast(sentence(err), "error");
        if (err instanceof ApiError && err.status === 409) {
          // Somebody else activated it first. Reload, so the page stops offering a button
          // that is no longer this viewer's to press.
          setAccountAsk(null);
          reload();
        }
      } finally {
        setActivateBusy(false);
      }
    },
    [activateBusy, activateAsk, entityId, fixture, day, askAccounts, reload, showToast],
  );

  const dismissAccountAsk = useCallback(() => {
    if (!activateBusy) setAccountAsk(null);
  }, [activateBusy]);

  /**
   * The result's button. It leaves for the COMPANY's own page, not the payer's portal, because
   * that is where this journey began - and a plain push, with no handoff: the list trades a
   * company-scoped token for an unscoped one because the portal belongs to the payer, while the
   * entity page belongs to the company and this token is already scoped to it.
   */
  const dismissResult = useCallback(() => {
    setResult(null);
    router.push(companyHome(entityId, page?.entity_name ?? ""));
  }, [router, entityId, page]);

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
    accountAsk,
    activateBusy,
    activateTrial,
    activatePrompt: activateAsk?.modal ?? null,
    confirmActivatePrompt,
    dismissActivatePrompt,
    result,
    dismissResult,
    confirmActivate,
    dismissAccountAsk,
  };
}
