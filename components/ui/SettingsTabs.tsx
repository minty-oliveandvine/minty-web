/**
 * The settings pill row - minty-payment-request-web's `SettingsPills` look (`components/settings/
 * SettingsPills.tsx` there), so a company's settings read as one place across the apps. The tabs
 * and their addresses come from `lib/settingsTabs.ts`.
 */

import type { SettingsTab } from "@/lib/settingsTabs";

const pill = (active: boolean) =>
  `cursor-pointer shrink-0 rounded-full px-4 py-2 text-center text-sm font-medium transition-colors flex items-center justify-center ${
    active ? "bg-secondary font-semibold text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
  }`;

export function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  return (
    <nav aria-label="Settings sections" className="w-full">
      <div className="flex flex-wrap gap-2 pb-1">
        {tabs.map((tab) =>
          tab.current ? (
            <span key={tab.label} aria-current="page" className={pill(true)}>
              {tab.label}
            </span>
          ) : (
            <a key={tab.label} href={tab.href} className={pill(false)}>
              {tab.label}
            </a>
          ),
        )}
      </div>
    </nav>
  );
}
