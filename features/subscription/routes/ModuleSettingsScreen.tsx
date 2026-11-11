"use client";

/**
 * The Module & Subscription tab of one company, in the settings page every tab shares (Figma
 * 353:999, owner 2026-11-10; `components/ui/SettingsPage`): the app's bar, the company, the
 * "Settings" heading and the tab row, and then the contents - which is the one thing that differs: the "Modules" heading, the payment-failed banner when a renewal failed,
 * the two cards and their CTAs, from the Figma design. `ModuleSettingsPage` reads the URL and
 * hands the parameters here; the tests render this directly with a fixture and a pinned `today`.
 */

import { useMemo, useSyncExternalStore } from "react";

import { SettingsPage } from "@/components/ui/SettingsPage";
import { getAuth } from "@/lib/auth";
import { getModuleClaims, type ModuleClaims } from "@/lib/moduleClaims";

import { AccountPickerDialog } from "@/features/subscription/components/BillingAccountDialogs";
import { ChangeDialog } from "@/features/subscription/components/ChangeDialog";
import {
  ChangeResultPage,
  ChangeResultRow,
} from "@/features/subscription/components/ChangeResultView";
import { BACK_TO_COMPANY } from "@/features/subscription/lib/changeResult";
import { ManagedByNotice } from "@/features/subscription/components/ManagedByNotice";
import { ModuleCardGrid } from "@/features/subscription/components/ModuleCardGrid";
import { PaymentFailedBanner } from "@/features/subscription/components/PaymentFailedBanner";
import { StartTrialDialog } from "@/features/subscription/components/StartTrialDialog";
import { useModulePage, type UseModulePageArgs } from "@/features/subscription/hooks/useModulePage";

export type ModuleSettingsScreenProps = UseModulePageArgs;

// The cookie is not readable during server rendering; render "" until hydrated (Header.tsx).
const noSubscribe = () => () => {};
const readEntityName = () => getAuth()?.entityName ?? "";
const serverEntityName = () => "";
// The token's module claims, read the same way; the cookie is not readable on the server, and
// serialising a fresh object per read would make useSyncExternalStore loop - cache by token.
let claimsCache: { token: string; claims: ModuleClaims } | null = null;
const readClaims = (): ModuleClaims | null => {
  const token = getAuth()?.token ?? "";
  if (!claimsCache || claimsCache.token !== token) {
    claimsCache = { token, claims: getModuleClaims() };
  }
  return claimsCache.claims;
};
const serverClaims = (): ModuleClaims | null => null;

/** The result views take a menu; this page has no row behind them, so there is nothing in it. */
const noMenu = () => {};

export function ModuleSettingsScreen(args: ModuleSettingsScreenProps) {
  const m = useModulePage(args);
  const { entityId } = args;
  const entityName = useSyncExternalStore(noSubscribe, readEntityName, serverEntityName);

  // The result views want only these two of a PortalEntity, which is as well: this page has no
  // portal row to hand them, and inventing one would be inventing its country and its payer.
  const resultEntity = { entity_id: entityId, entity_name: m.page?.entity_name ?? entityName };

  const claims = useSyncExternalStore(noSubscribe, readClaims, serverClaims);

  // Which modules the company has, for the pills and the drawer: the page model's fresh
  // `has_access` once it is here, the token's claims until then (minty-payment-request-web's
  // `useEntitlements`, the same two sources in the same order) - so the pills never vanish
  // while the page loads or when the API cannot answer.
  const access = useMemo<ModuleClaims>(() => {
    if (m.page) {
      return {
        pettyCash: m.page.cards.some((c) => c.code === "PETTY_CASH" && c.has_access),
        billing: m.page.cards.some((c) => c.code === "PAYMENT_REQUEST" && c.has_access),
      };
    }
    return claims ?? { pettyCash: false, billing: false };
  }, [m.page, claims]);

  return (
    <SettingsPage
      company={{ id: entityId, name: m.page?.entity_name ?? entityName }}
      access={access}
      tab="modules"
      viewer={m.page?.viewer ?? null}
    >
      <section>
        {/* The activation landed: its result takes the cards' place, the way Manage
                Subscriptions' page result takes the list's. The chrome stays - the person is
                still inside Settings and the tabs are their way out. */}
        {m.result ? (
          m.result.layout === "page" ? (
            <ChangeResultPage
              entity={resultEntity}
              result={m.result}
              menu={[]}
              onMenu={noMenu}
              onBack={m.dismissResult}
              backLabel={BACK_TO_COMPANY}
            />
          ) : (
            // A one-item list: ChangeResultRow is an <li>, and it is the only result view
            // that draws `lines` and `money` - which for a congratulation are all there is.
            <ul>
              <ChangeResultRow
                entity={resultEntity}
                result={m.result}
                menu={[]}
                onMenu={noMenu}
                onBack={m.dismissResult}
                backLabel={BACK_TO_COMPANY}
              />
            </ul>
          )
        ) : (
          <>
            <h3 className="text-lg font-bold text-set-ink">Modules</h3>
            <p className="mt-2 text-sm text-set-ink-2">
              View the modules available to this entity, start free trials and manage active
              subscriptions.
            </p>
            {m.page && !m.page.can_manage_modules && (
              <div className="mt-2">
                <ManagedByNotice payer={m.page.payer} />
              </div>
            )}

            {m.status === "loading" && (
              <p className="mt-10 text-center text-sm text-muted" role="status">
                Loading…
              </p>
            )}

            {m.status === "error" && (
              <div className="mt-10 text-center" role="alert">
                <p className="text-sm text-danger">{m.error}</p>
                <button type="button" className="mt-3 text-sm underline" onClick={m.reload}>
                  Try again
                </button>
              </div>
            )}

            {m.status === "ready" && m.page && (
              <div className="mt-6 flex flex-col gap-8">
                {m.paymentFailed && (
                  <PaymentFailedBanner onUpdatePaymentMethod={m.updatePaymentMethod} />
                )}
                <ModuleCardGrid
                  views={m.views}
                  shared={m.shared}
                  canManage={m.page.can_manage_modules}
                  busyCode={m.busyCode}
                  on={{
                    startTrial: m.askStartTrial,
                    manage: m.manage,
                    activate: m.activate,
                    activateTrial: () => void m.activateTrial(),
                    resume: m.resume,
                    reactivate: m.reactivate,
                  }}
                />
              </div>
            )}
          </>
        )}
      </section>

      {/* Activate Subscription opens the Billing Accounts sheet FIRST (the owner, 2026-11-11),
          over this page, because a company with no subscriber is not in anybody's billing
          relationship yet and the act is one request. */}
      {m.accountAsk && (
        <AccountPickerDialog
          key={m.accountAsk.key}
          data={m.accountAsk.data}
          currentId={m.accountAsk.picked}
          targets={m.accountAsk.targets}
          busy={m.activateBusy}
          error={m.accountAsk.error}
          lead={m.accountAsk.lead}
          onConfirm={(accountId) => void m.confirmActivate(accountId)}
          onOpened={(opened) => {
            if (opened.accountId) void m.confirmActivate(opened.accountId);
          }}
          onClose={m.dismissAccountAsk}
        />
      )}

      {/* Then, once activated, the SAME section-06 modal Manage Subscriptions celebrates a change
          in - the person confirmed the same modules and reads the same words. Nothing to go back
          to: its Confirm, Escape and the backdrop all show the result. */}
      {m.celebration && (
        <ChangeDialog
          modal={m.celebration}
          entityName={entityName}
          busy={false}
          hideBack
          onConfirm={m.confirmCelebration}
          onBack={m.confirmCelebration}
        />
      )}

      {m.trialPrompt && (
        <StartTrialDialog
          entityName={entityName}
          code={m.trialPrompt.code}
          moduleName={m.trialPrompt.moduleName}
          busy={m.busyCode !== null}
          onConfirm={() => void m.confirmStartTrial()}
          onBack={m.dismissTrialPrompt}
        />
      )}
    </SettingsPage>
  );
}
