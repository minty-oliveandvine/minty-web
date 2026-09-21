/**
 * The settings pill row - billing-frontend's `SettingsPills` look (`components/settings/
 * SettingsPills.tsx` there), so this page reads as its settings page. Every pill but the
 * current one is a Flask page, spelled by `lib/flaskLinks.ts`.
 */

import type { SettingsTab } from "@/features/subscription/lib/flaskLinks";

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
