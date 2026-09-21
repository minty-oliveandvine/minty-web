"use client";

/**
 * The module settings page of one company, composed the way billing-frontend composes its
 * settings page (`app/settings/page.tsx` + `components/settings/SettingsContent.tsx` there):
 * its header, a sticky pill row in a 1024px column, and then the contents - which is the one
 * thing that differs: the "Modules" heading, the payment-failed banner when a renewal failed,
 * the two cards and their CTAs, from the Figma design. `ModuleSettingsPage` reads the URL and
 * hands the parameters here; the tests render this directly with a fixture and a pinned `today`.
 */

import { useMemo, useSyncExternalStore } from "react";

import { AppHeader } from "@/components/ui/AppHeader";
import { getAuth } from "@/lib/auth";
import { getModuleClaims, type ModuleClaims } from "@/lib/moduleClaims";

import { ManagedByNotice } from "@/features/subscription/components/ManagedByNotice";
import { ModuleCardGrid } from "@/features/subscription/components/ModuleCardGrid";
import { PaymentFailedBanner } from "@/features/subscription/components/PaymentFailedBanner";
import { SettingsTabs } from "@/features/subscription/components/SettingsTabs";
import { useModulePage, type UseModulePageArgs } from "@/features/subscription/hooks/useModulePage";
import { backLink, settingsTabs, type PageOrigin } from "@/features/subscription/lib/flaskLinks";
import { modulesPath } from "@/features/subscription/lib/paths";

export type ModuleSettingsScreenProps = UseModulePageArgs & { from: PageOrigin };

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

/** "Olive & Vine Limited" -> "O&VL", as billing-frontend abbreviates the company. */
function abbreviate(name: string): string {
  if (!name) return "---";
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
}

export function ModuleSettingsScreen({ from, ...args }: ModuleSettingsScreenProps) {
  const m = useModulePage(args);
  const { entityId } = args;
  const entityName = useSyncExternalStore(noSubscribe, readEntityName, serverEntityName);

  const claims = useSyncExternalStore(noSubscribe, readClaims, serverClaims);

  // Which modules the company has, for the pills and the drawer: the page model's fresh
  // `has_access` once it is here, the token's claims until then (billing-frontend's
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
    <div className="flex h-dvh h-screen min-w-0 max-w-full flex-col overflow-hidden bg-white">
      <AppHeader
        title="Settings"
        back={backLink(entityId, from)}
        companyName={entityName || "Loading…"}
        companyAbbreviation={abbreviate(entityName)}
        viewer={m.page?.viewer ?? null}
        nav={{ modules: access, settingsHref: modulesPath(entityId) }}
        noBorder
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto w-full max-w-[1024px] px-4 sm:px-6">
          <div className="sticky top-0 z-10 bg-white pt-3 pb-3 sm:pt-4 sm:pb-4">
            <SettingsTabs tabs={settingsTabs(entityId, access, from)} />
          </div>

          <section className="pb-16 pt-6">
            <h2 className="text-[25px] font-bold">Modules</h2>
            <p className="mt-2 text-[15px] text-ink-soft">
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
                    startTrial: (code) => void m.startTrial(code),
                    manage: m.manage,
                    activate: m.activate,
                    resume: m.resume,
                    reactivate: m.reactivate,
                  }}
                />
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
