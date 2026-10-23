"use client";

/**
 * The ONE file the packaged sidebar (`@minty/shared/sidebar`) reads of this app.
 *
 * Until 2026-10-12 the sidebar was this app's own four components reaching straight into
 * `@/lib/{auth,env,hubPaths,leaveGuard,logout,mintyEntry,moduleClaims}`, with a copy in
 * minty-payment-request-web behind a file of this name. Now there is one implementation and two
 * hosts; everything app-specific is here and nowhere else.
 *
 * Imported for its side effect by every shim in this folder (and by `@/lib/viewer`), so the host
 * is registered before anything renders. An unregistered host throws by design.
 */

import { usePathname } from "next/navigation";

import { setSidebarHost, type SidebarHost, type Viewer } from "@minty/shared/sidebar";

import { mintyFetch } from "@/lib/apiClient";
import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { previewSetSlug, siblingUrl } from "@/lib/previewSibling";
import {
  COMPANY_SETTINGS_PATTERN,
  companyPath,
  companySettingsPath,
  HUB_PATHS,
} from "@/lib/hubPaths";
import { logOut } from "@/lib/logout";
import { mintyEntryUrl, pettyCashWebUrl } from "@/lib/mintyEntry";
import { getModuleClaims } from "@/lib/moduleClaims";
import { guardLeave } from "@minty/shared/leaveGuard";

/** The side menu's Bills, for a page served on `host` (see `links` below). */
export function billsHref(host: string | null): string {
  if (previewSetSlug(host) !== null) {
    return `${siblingUrl(env.PAYMENT_REQUEST_WEB_URL, "payment-request", host)}/`;
  }
  const entityId = getAuth()?.entityId;
  return mintyEntryUrl(entityId ? `/entity/${entityId}/payment-request` : undefined);
}

export const sidebarHost: SidebarHost = {
  app: "minty-web",
  entityId: () => getAuth()?.entityId ?? "",
  entityName: () => getAuth()?.entityName ?? "",

  /** The token's claims, both on when unknown - never hide nav on a guess. */
  moduleAccess: () => getModuleClaims(),

  /**
   * This app IS the hub, so most of these are its own pages. Petty Cash goes into Minty through
   * `/entity/<id>/enter`, whose token re-establishes the Flask session, on to Flask's
   * `/handoff/petty-cash-web`, which mints the Petty Cash app's token (lib/mintyEntry.ts's
   * `pettyCashWebUrl`; Flask's own Petty Cash pages are retired, Step 5); Bills the same way, on to
   * Minty's `entity.go_to_bills`, which hands the payments app a token for THIS company - that
   * app's bare `/` opens the company in its own cookie, which may be another one. Except inside
   * a branch preview set, where Bills stays in the set (lib/previewSibling.ts): Minty's hand-over
   * would send it to the payments app Flask is configured with, outside the set.
   */
  links: {
    entities: () => HUB_PATHS.entities,
    subscriptions: () => HUB_PATHS.subscription,
    pettyCashDashboard: () => pettyCashWebUrl(getAuth()?.entityId ?? ""),
    pettyCashReports: (entityId) =>
      pettyCashWebUrl(
        entityId,
        companyPath(entityId, getAuth()?.entityName ?? "", "/petty-cash/reports"),
      ),
    bills: () => billsHref(typeof window === "undefined" ? null : window.location.host),
    settings: () => companySettingsPath(getAuth()?.entityId ?? "", getAuth()?.entityName ?? ""),
    profile: () => HUB_PATHS.profile,
  },

  /**
   * This app's router. Imported HERE and not in the package, so a test's
   * `vi.mock("next/navigation")` reaches it - a mock does not apply to a module inside
   * node_modules, and the real hook returns null outside an app-router tree.
   */
  usePathname: () => usePathname() ?? "",

  /** Which of this app's pages is showing. It has all four, unlike the payments app. */
  currentOf: (pathname) => {
    if (pathname === HUB_PATHS.profile) return "profile";
    if (pathname === HUB_PATHS.entities) return "entities";
    if (COMPANY_SETTINGS_PATTERN.test(pathname)) return "settings";
    if (pathname === HUB_PATHS.subscription || pathname.startsWith(`${HUB_PATHS.subscription}/`)) {
      return "subscriptions";
    }
    return null;
  },

  /** `body`, because this app scrolls the document (the payments app cannot - see its host). */
  lockScroll: () => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  },

  /**
   * A page with unsaved changes asks first (`@minty/shared/leaveGuard`): Logout is a button, so
   * the guard's click rule never sees it, and `logOut` clears the token BEFORE it navigates - a
   * prompt answered with "stay" would leave the person on the page signed out. Nothing here runs
   * until they pick "Discard changes", so "Go Back" leaves them where they were, still signed in,
   * with the menu still open. `guardLeave` does nothing on a page that arms no guard.
   */
  logOut: (onLeaving) =>
    guardLeave(() => {
      onLeaving?.();
      logOut();
    }),

  currentToken: () => getAuth()?.token ?? "",

  /**
   * Flask's hub surface. DECORATION: a read that fails must never move the page, so a 401 only
   * rejects (`onUnauthorized: "reject"`) and the badge stays empty - the page's own reads are
   * what a lapsed token is the business of.
   */
  loadViewer: async (): Promise<Viewer | null> => {
    const body = await mintyFetch<{ user?: { name?: unknown; initials?: unknown } }>(
      "/api/me/profile",
      { onUnauthorized: "reject" },
    );
    const user = body?.user;
    if (typeof user?.name !== "string" || typeof user.initials !== "string") return null;
    return { name: user.name, initials: user.initials };
  },
};

setSidebarHost(sidebarHost);
