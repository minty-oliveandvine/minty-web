/**
 * Where this app mounts each feature - the SHELL's knowledge, spelled once.
 *
 * A feature knows its own paths (each has a `lib/paths.ts` behind its index) and nothing about
 * another's: the boundary rules forbid it. So whatever crosses between features - the side
 * menu's Select Entity / Manage subscriptions / the profile, a profile's way back to the
 * list - asks here. Each feature's guard test asserts its own base path equals its entry, so
 * the two spellings cannot drift. Extracting a feature deletes its line.
 */
import { companyRef } from "@/lib/companyRef";

export const HUB_PATHS = {
  entities: "/entities",
  profile: "/profile",
  subscription: "/subscription",
} as const;

/** The hub's first page - where `/` and a landing with no `next` go. */
export const HUB_HOME = HUB_PATHS.entities;

/**
 * The pages that stand without a person: the landing (where a token arrives) and the
 * maintenance page. proxy.ts lets them through without the cookie, and the Terms gate
 * (`components/ui/TermsGate.tsx`) asks nothing on them - there is nobody to ask yet.
 */
export const OPEN_PATHS = ["/landing", "/maintenance"] as const;

export function isOpenPath(pathname: string): boolean {
  return OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * A company's own settings page (Figma 03-A, the module settings page), addressed by the
 * company's short id and name (lib/companyRef.ts) - where the side menu's
 * Settings goes from inside a company. It belongs to the subscription feature
 * (`modulesPath`); spelled here too because the menu is shared chrome and may not reach into a
 * feature, and pinned equal to it by that feature's paths test.
 */
export function companySettingsPath(entityId: string, entityName: string): string {
  return `${HUB_PATHS.subscription}/entities/${companyRef(entityId, entityName)}/modules`;
}
