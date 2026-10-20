/**
 * My Profile's page rules, pure: its title and where its back arrow goes. What the plan says and
 * what a save sends are `@minty/shared/profile`'s now (v0.6) - the same rules in every app.
 */

import { HUB_PATHS } from "@/lib/hubPaths";
import { mintyModulesUrl } from "@/lib/mintyEntry";

export const PAGE_TITLE = "My Profile";

/**
 * The back arrow's fallback, for a new tab: the company it was opened from (Minty's module
 * selector picks the module), or - opened from the entity list - the list. A plain click
 * returns to the page the person came from (components/ui/BackLink.tsx; the `?from=bills`
 * flag went 2026-10-05).
 */
export function backHref(entityId: string): string {
  if (!entityId) return HUB_PATHS.entities;
  return mintyModulesUrl(entityId);
}
