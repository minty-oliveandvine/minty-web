"use client";

/**
 * The module settings page of one company, composed the way minty-payment-request-web composes its
 * settings page (`app/settings/page.tsx` + `components/settings/SettingsContent.tsx` there):
 * its header, a sticky pill row in a 720px column (Minty v2), and then the contents - which is the one
 * thing that differs: the "Modules" heading, the payment-failed banner when a renewal failed,
 * the two cards and their CTAs, from the Figma design. `ModuleSettingsPage` reads the URL and
 * hands the parameters here; the tests render this directly with a fixture and a pinned `today`.
 */

import { useMemo } from "react";

import { moduleClaims } from "@minty/shared/auth";
import { useClientValue } from "@minty/shared/clientValue";
import type { ModuleAccess } from "@minty/shared/sidebar";

import { AppHeader } from "@/components/ui/AppHeader";
import { SettingsTabs } from "@/components/ui/SettingsTabs";
import { getAuth } from "@/lib/auth";
import { settingsBackLink, settingsTabs } from "@/lib/settingsTabs";

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
const readEntityName = () => getAuth()?.entityName ?? "";
const serverEntityName = () => "";
// The token's module claims, read the same way; the cookie is not readable on the server, and
// serialising a fresh object per read would make useClientValue loop - cache by token.
let claimsCache: { token: string; claims: ModuleAccess } | null = null;
const readClaims = (): ModuleAccess | null => {
  const token = getAuth()?.token ?? "";
  if (!claimsCache || claimsCache.token !== token) {
    claimsCache = { token, claims: moduleClaims(token) };
  }
  return claimsCache.claims;
};
const serverClaims = (): ModuleAccess | null => null;

/** The result views take a menu; this page has no row behind them, so there is nothing in it. */
const noMenu = () => {};

export function ModuleSettingsScreen(args: ModuleSettingsScreenProps) {
  const m = useModulePage(args);
  const { entityId } = args;
  const entityName = useClientValue(readEntityName, serverEntityName);

  // The result views want only these two of a PortalEntity, which is as well: this page has no
  // portal row to hand them, and inventing one would be inventing its country and its payer.
  const resultEntity = { entity_id: entityId, entity_name: m.page?.entity_name ?? entityName };

  const claims = useClientValue(readClaims, serverClaims);

  // Which modules the company has, for the pills and the drawer: the page model's fresh
  // `has_access` once it is here, the token's claims until then (minty-payment-request-web's
  // `useEntitlements`, the same two sources in the same order) - so the pills never vanish
  // while the page loads or when the API cannot answer.
  const access = useMemo<ModuleAccess>(() => {
    if (m.page) {
      return {
        pettyCash: m.page.cards.some((c) => c.code === "PETTY_CASH" && c.has_access),
        billing: m.page.cards.some((c) => c.code === "PAYMENT_REQUEST" && c.has_access),
      };
    }
    return claims ?? { pettyCash: false, billing: false };
  }, [m.page, claims]);

  return (
    <div className="flex h-dvh h-screen min-w-0 max-w-full flex-col overflow-hidden bg-canvas">
      <AppHeader
        title="Settings"
        back={settingsBackLink(entityId)}
        companyName={entityName || "Loading…"}
        viewer={m.page?.viewer ?? null}
        nav={{ modules: access }}
        noBorder
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-4 pb-[env(safe-area-inset-bottom,0px)] sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-[720px]">
          <div className="sticky top-0 z-10 bg-canvas pt-3 pb-3 sm:pt-4 sm:pb-4">
            <SettingsTabs
              tabs={settingsTabs({ id: entityId, name: entityName }, access, "modules")}
            />
          </div>

          <section className="pb-16 pt-6">
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
                <h2 className="text-display-m font-bold">Modules</h2>
                <p className="mt-2 text-body-l text-ink-2">
                  View the modules available to this entity, start free trials and manage active
                  subscriptions.
                </p>
                {m.page && !m.page.can_manage_modules && (
                  <div className="mt-2">
                    <ManagedByNotice payer={m.page.payer} />
                  </div>
                )}

                {m.status === "loading" && (
                  <p className="mt-10 text-center text-sm text-ink-2" role="status">
                    Loading…
                  </p>
                )}

                {m.status === "error" && (
                  <div className="mt-10 text-center" role="alert">
                    <p className="text-sm text-danger">{m.error}</p>
                    <button type="button" className="mt-3 min-h-11 rounded-lg px-2 text-body-m font-semibold text-link underline hover:bg-hover" onClick={m.reload}>
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
        </div>
      </main>

      {/* Activate Subscription asks in the SAME section-06 modal Manage Subscriptions asks a
          change in (the user, 2026-10-08) - the person is confirming the same modules and
          should read the same words - and only its Confirm opens the sheet. */}
      {m.activatePrompt && (
        <ChangeDialog
          modal={m.activatePrompt}
          entityName={entityName}
          busy={m.activateBusy}
          onConfirm={() => void m.confirmActivatePrompt()}
          onBack={m.dismissActivatePrompt}
        />
      )}

      {/* Then the same Billing Accounts sheet, over this page, because a company with no
          subscriber is not in anybody's billing relationship yet and the act is one request. */}
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
    </div>
  );
}
