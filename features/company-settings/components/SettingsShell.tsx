"use client";

/**
 * A company settings tab's frame - the Module tab's (features/subscription
 * `ModuleSettingsScreen`): the header (Back, "Settings", the company, the initials and the menu),
 * the sticky pill row in a 1024px column, then the tab's heading and its cards in Payment
 * Settings' card look. Which pills show follows the company's modules: the page's own once it is
 * here, the token's claims until then (`lib/moduleClaims.ts`).
 */

import { useMemo, type ReactNode } from "react";

import { AppHeader } from "@/components/ui/AppHeader";
import { SettingsTabs } from "@/components/ui/SettingsTabs";
import type { CompanySettingsTab } from "@/lib/hubPaths";
import { getModuleClaims, type ModuleClaims } from "@/lib/moduleClaims";
import { settingsBackLink, settingsTabs } from "@/lib/settingsTabs";

export function SettingsShell({
  company,
  modules,
  tab,
  title,
  lead,
  children,
}: {
  company: { id: string; name: string };
  /** The company's module codes, once the page has them. */
  modules: string[] | null;
  tab: CompanySettingsTab;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  const access = useMemo<ModuleClaims>(
    () =>
      modules
        ? { pettyCash: modules.includes("PETTY_CASH"), billing: modules.includes("PAYMENT_REQUEST") }
        : getModuleClaims(),
    [modules],
  );
  return (
    <div className="flex h-dvh h-screen min-w-0 max-w-full flex-col overflow-hidden bg-white">
      <AppHeader title="Settings" back={settingsBackLink(company.id)} companyName={company.name} nav={{ modules: access }} noBorder />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto w-full max-w-[1024px] px-4 sm:px-6">
          <div className="sticky top-0 z-10 bg-white pt-3 pb-3 sm:pt-4 sm:pb-4">
            <SettingsTabs tabs={settingsTabs(company, access, tab)} />
          </div>
          <section className="pb-16 pt-6">
            <h2 className="text-[25px] font-bold">{title}</h2>
            <p className="mt-2 text-[15px] text-ink-soft">{lead}</p>
            <div className="mt-6 flex flex-col gap-6">{children}</div>
          </section>
        </div>
      </main>
    </div>
  );
}

/** Payment Settings' card: a white box with its heading and a line under it. */
export function SettingsCard({
  title,
  lead,
  readOnly = false,
  action,
  children,
}: {
  title: string;
  lead?: string;
  readOnly?: boolean;
  /** A control at the heading's right (Invite). */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`min-w-0 overflow-hidden rounded-lg border border-gray-200 shadow-sm ${readOnly ? "bg-gray-100" : "bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-gray-800 sm:text-lg">{title}</h3>
          {lead ? <p className="text-sm text-gray-600">{lead}</p> : null}
        </div>
        {action}
      </div>
      <div className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5">{children}</div>
    </div>
  );
}

/** Why the controls are dead - Payment Settings' read-only line. */
export function ReadOnlyNotice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-600">
      <span className="material-symbols-outlined shrink-0 text-[18px] leading-none text-gray-400" aria-hidden>
        visibility
      </span>
      <span>{children}</span>
    </div>
  );
}

export function LoadState({ status, error, onRetry }: { status: "loading" | "error"; error?: string; onRetry: () => void }) {
  return status === "loading" ? (
    <p className="mt-6 text-center text-sm text-muted" role="status">
      Loading…
    </p>
  ) : (
    <div className="mt-6 text-center" role="alert">
      <p className="text-sm text-danger">{error}</p>
      <button type="button" className="mt-2 min-h-11 text-sm underline" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
