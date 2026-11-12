/**
 * Every company settings tab's page (Figma 353:999, owner 2026-11-10): the app's bar (the way
 * back, "Settings", the initials and the menu), then an 880px column - the company's name, the
 * "Settings" heading, the tab row - and the tab's own cards under it. Shared chrome, so the Module
 * tab (features/subscription) and the other five (features/company-settings and the two module
 * settings features) draw one page. Which tabs show is the caller's `access`.
 */

import type { ReactNode } from "react";

import { AppHeader } from "@/components/ui/AppHeader";
import { SettingsTabs } from "@/components/ui/SettingsTabs";
import type { CompanySettingsTab } from "@/lib/hubPaths";
import type { ModuleClaims } from "@/lib/moduleClaims";
import { settingsBackLink, settingsTabs } from "@/lib/settingsTabs";
import type { Viewer } from "@/lib/viewer";

export function SettingsPage({
  company,
  access,
  tab,
  viewer,
  children,
}: {
  company: { id: string; name: string };
  access: ModuleClaims;
  tab: CompanySettingsTab;
  /** The person looking, when the page's model already names them. */
  viewer?: Viewer | null;
  children: ReactNode;
}) {
  return (
    // One scroll: the document's, under the sticky header (owner, 2026-11-12). The frame used to lock
    // the window and scroll inside <main>, so a long list drew a second scroll bar beside it.
    <div className="flex min-h-dvh min-w-0 max-w-full flex-col bg-white">
      <AppHeader
        title="Settings"
        back={settingsBackLink(company.id)}
        viewer={viewer}
        nav={{ modules: access }}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-x-clip pb-[env(safe-area-inset-bottom,0px)]">
        <div className="mx-auto flex w-full max-w-[928px] min-w-0 flex-col gap-6 px-4 pt-6 pb-14 sm:px-6 sm:pt-10">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-[13px] font-medium text-set-mute">
              {company.name || "Loading…"}
            </p>
            <h2 className="text-[28px] font-bold text-set-ink">Settings</h2>
          </div>
          <SettingsTabs tabs={settingsTabs(company, access, tab)} />
          {children}
        </div>
      </main>
    </div>
  );
}
