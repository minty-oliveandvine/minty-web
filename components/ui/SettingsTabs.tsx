"use client";

/**
 * The settings tab row (Figma 353:999, owner 2026-11-10): plain tabs on a hairline, the open one
 * underlined in teal and bold. On a phone the row scrolls sideways inside itself - never the page -
 * and starts scrolled so the open tab is in view (Petty Cash Settings is past the edge at 360px),
 * with no scroll bar drawn.
 * Every tab is a plain link to this app's own page, so the leave guard sees each click. The tabs
 * and their addresses come from `lib/settingsTabs.ts`.
 */

import { useEffect, useRef } from "react";

import type { SettingsTab } from "@/lib/settingsTabs";

const TAB =
  "flex min-h-11 shrink-0 items-center border-b-[3px] px-2.5 py-3 text-sm whitespace-nowrap lg:px-3";

export function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const row = useRef<HTMLDivElement>(null);
  const open = useRef<HTMLSpanElement>(null);
  const current = tabs.find((t) => t.current)?.label;

  useEffect(() => {
    const r = row.current;
    const t = open.current;
    if (!r || !t) return;
    // Only the row moves (never scrollIntoView, which could move the page too): centre the open tab
    // when it is not wholly visible.
    const left = t.offsetLeft - r.offsetLeft;
    if (left < r.scrollLeft || left + t.offsetWidth > r.scrollLeft + r.clientWidth) {
      r.scrollLeft = Math.max(0, left - (r.clientWidth - t.offsetWidth) / 2);
    }
  }, [current]);

  return (
    <nav aria-label="Settings sections" className="w-full min-w-0">
      <div
        ref={row}
        // The hairline is an inset shadow, so the open tab's underline covers it inside the row: a
        // border with the tabs pulled 1px over it overflowed downwards, and the row then showed a
        // vertical scroll bar. Sideways it still scrolls (a swipe), with no bar drawn.
        className="relative flex gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--set-line)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) =>
          tab.current ? (
            <span
              key={tab.label}
              ref={open}
              aria-current="page"
              className={`${TAB} border-set-tab font-semibold text-set-tab-ink`}
            >
              {tab.label}
            </span>
          ) : (
            <a
              key={tab.label}
              href={tab.href}
              className={`${TAB} border-transparent font-medium text-set-ink-2 hover:text-set-ink`}
            >
              {tab.label}
            </a>
          ),
        )}
      </div>
    </nav>
  );
}
