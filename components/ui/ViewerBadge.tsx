"use client";

// COPIED on 2026-09-30 into billing-frontend (same path, behind its components/ui/sidebarHost.ts)
// and ported to Flask (Minty docs/features/sidebar.md) - change all three until @minty/shared.

/**
 * The person's initials in the header - their name on hover, and My Profile on a click: the
 * sidebar opens over the page on the profile (the user's call, 2026-09-29, reversing the
 * morning's hover-only badge). The menu's name opens the same view.
 *
 * Without a sidebar that can hold the profile (a screen on its own), the badge is a link to the
 * `/profile` page instead - the same place, the long way round.
 *
 * `viewer` is what the page already knows (the module page's own model names the viewer);
 * without one the badge reads it once per token from Flask (`lib/viewer.ts`). Drawn only once
 * known - an empty circle would be a guess.
 */

import { useRef } from "react";

import { useSidebar } from "@/components/ui/Sidebar";
import { HUB_PATHS } from "@/lib/hubPaths";
import { useViewer, type Viewer } from "@/lib/viewer";

const BADGE =
  "inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--avatar-bg)] text-[12px] font-semibold text-[var(--avatar-fg)] transition-shadow hover:ring-2 hover:ring-primary/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function ViewerBadge({ viewer }: { viewer?: Viewer | null }) {
  const person = useViewer(viewer);
  const sidebar = useSidebar();
  const badge = useRef<HTMLButtonElement>(null);
  if (!person) return null;

  const label = `${person.name}, My Profile`;
  if (sidebar?.canOpenProfile) {
    return (
      <button
        ref={badge}
        type="button"
        onClick={() => sidebar.openProfile(badge.current)}
        className={BADGE}
        aria-label={label}
        aria-expanded={sidebar.open && sidebar.view === "profile"}
        aria-controls={sidebar.panelId}
        title={person.name}
      >
        <span aria-hidden>{person.initials}</span>
      </button>
    );
  }
  return (
    <a href={HUB_PATHS.profile} className={BADGE} aria-label={label} title={person.name}>
      <span aria-hidden>{person.initials}</span>
    </a>
  );
}
