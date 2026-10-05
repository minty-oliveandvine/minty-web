import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// proxy.ts is Next 16's name for what the sibling apps still call proxy.ts (the old
// convention is deprecated in 16 and this repo starts on the current one).

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { handoffUrl } from "@/lib/handoff";
import { isOpenPath } from "@/lib/hubPaths";

/**
 * One gate - THE COOKIE. Every page but the landing, sign-in and the maintenance page
 * (`OPEN_PATHS`, lib/hubPaths.ts) needs the module token cookie (lib/auth.ts). Without it the
 * browser goes to Flask's login-gated re-handoff for the page it asked for: silent while Flask's
 * session lives, else Flask sends it to this app's /login (features/auth) with the re-handoff as
 * `next`. The cookie's max-age is the token's `exp`, so "no cookie" and "expired token" are the
 * same case here.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const moved = movedModulePage(pathname);
  if (moved) {
    // 307, not 308: a 308 is cached for good, and these old links are few and short-lived.
    return NextResponse.redirect(new URL(moved + search, request.url), 307);
  }

  if (isOpenPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(handoffUrl(pathname + search));
  }

  return NextResponse.next();
}

/**
 * The Module tab's addresses before phase 2 (2026-10-05): `/subscription/entities/<shortid>/<name>/modules`
 * and the older `/subscription/entities/<full id>/modules`. Both move to
 * `/entities/<ref>/<name>/settings/modules`; a full id gets a placeholder name, which the page
 * replaces with the company's own (lib/companyFromAddress.ts).
 */
const OLD_MODULE_PAGE = /^\/subscription\/entities\/([^/]+)(?:\/([^/]+))?\/modules\/?$/;

export function movedModulePage(pathname: string): string | null {
  const m = OLD_MODULE_PAGE.exec(pathname);
  if (!m) return null;
  return `/entities/${m[1]}/${m[2] ?? "company"}/settings/modules`;
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
