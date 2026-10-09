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
  company: "/entity",
  profile: "/profile",
  subscription: "/subscription",
} as const;

/** The hub's first page - where `/` and a landing with no `next` go. */
export const HUB_HOME = HUB_PATHS.entities;

/**
 * The pages that stand without a person: the landing (where a token arrives), sign-in
 * (`/login` and `/signup`, features/auth - phase 2) and the maintenance page. proxy.ts lets them
 * through without the cookie, and the Terms gate (`components/ui/TermsGate.tsx`) asks nothing on
 * them - there is nobody to ask yet.
 */
export const OPEN_PATHS = ["/landing", "/login", "/signup", "/maintenance"] as const;

export function isOpenPath(pathname: string): boolean {
  return OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * One company's pages: `/entity/<shortid>/<name>[/…]` (lib/companyRef.ts) - its module choice,
 * then its settings under `/settings/<tab>` (phase 2, 2026-10-05). SINGULAR: the address names
 * one company, like Flask's `/entity/<shortid>/<name>/…` (the plural `/entities` is the LIST
 * and nothing below it - proxy.ts 307s the old plural company addresses here).
 */
export function companyPath(entityId: string, entityName: string, sub = ""): string {
  return `${HUB_PATHS.company}/${companyRef(entityId, entityName)}${sub}`;
}

/** The settings tabs this app draws; the apps keep their own module settings. */
export type CompanySettingsTab = "modules" | "users" | "integration";

/**
 * A company's settings page in this app. With no tab, the Module tab (Figma 03-A) - where the
 * side menu's Settings goes from inside a company. Each tab's page belongs to a feature (the
 * Module tab to subscription's `modulesPath`); spelled here too because the menu is shared chrome
 * and may not reach into a feature, and pinned equal by those features' paths tests.
 */
export function companySettingsPath(
  entityId: string,
  entityName: string,
  tab: CompanySettingsTab = "modules",
): string {
  return companyPath(entityId, entityName, `/settings/${tab}`);
}

/** `/entity/<shortid>/<name>/settings/<tab>` - the area lib/backLink.ts and the menu recognise. */
export const COMPANY_SETTINGS_PATTERN = /^\/entity\/[^/]+\/[^/]+\/settings\/[^/]+\/?$/;
