import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// proxy.ts is Next 16's name for what the sibling apps still call proxy.ts (the old
// convention is deprecated in 16 and this repo starts on the current one).

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { handoffUrl } from "@/lib/handoff";
import { isOpenPath } from "@/lib/hubPaths";
import { previewSetSlug } from "@/lib/previewSibling";

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

  const signUp = movedSignUpPage(request.nextUrl);
  if (signUp) {
    return NextResponse.redirect(new URL(signUp, request.url), 307);
  }

  if (isOpenPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return toFlask(request, handoffUrl(pathname + search, undefined, request.nextUrl.origin));
  }

  return NextResponse.next();
}

/**
 * Sign-up was `/login?mode=signup` until 2026-10-09; it has its own route now, like log in
 * (features/auth `lib/paths.ts`). An old link keeps its other params and drops `mode`. An
 * invitation is NOT sign-up - it stays on `/login`, where the invited address is locked.
 */
export function movedSignUpPage(url: URL): string | null {
  if (url.pathname !== "/login" || url.searchParams.get("mode") !== "signup") return null;
  if (url.searchParams.get("invite")) return null;
  const params = new URLSearchParams(url.searchParams);
  params.delete("mode");
  const query = params.toString();
  return query ? `/signup?${query}` : "/signup";
}

/**
 * The Module tab's addresses before phase 2 (2026-10-05): `/subscription/entities/<shortid>/<name>/modules`
 * and the older `/subscription/entities/<full id>/modules`. Both move to
 * `/entity/<ref>/<name>/settings/modules`; a full id gets a placeholder name, which the page
 * replaces with the company's own (lib/companyFromAddress.ts).
 */
const OLD_MODULE_PAGE = /^\/subscription\/entities\/([^/]+)(?:\/([^/]+))?\/modules\/?$/;

/**
 * One company's pages were under the PLURAL `/entity/<shortid>/<name>/…` until 2026-10-07. The
 * address names a single company, so they are `/entity/…` now (lib/hubPaths.ts) - the plural is
 * the LIST and nothing below it. `/entities` itself is untouched.
 */
const OLD_PLURAL_COMPANY = /^\/entities\/(.+)$/;

export function movedModulePage(pathname: string): string | null {
  const m = OLD_MODULE_PAGE.exec(pathname);
  if (m) return `/entity/${m[1]}/${m[2] ?? "company"}/settings/modules`;
  const plural = OLD_PLURAL_COMPANY.exec(pathname);
  if (plural) return `/entity/${plural[1]}`;
  return null;
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};

/**
 * Off to Flask. A plain redirect - except on a branch preview-set host, where the trip has to
 * START on a page of this host: a visitor arriving from a link on GitHub or in an email makes
 * the whole redirect chain cross-site, and Flask names a preview set only on a same-site
 * navigation (Minty blueprints/shared/preview_origin.py), so it would hand back to the
 * configured hub instead of the set. A meta refresh is navigated by the page itself.
 */
export function toFlask(request: NextRequest, url: string): NextResponse {
  if (previewSetSlug(request.nextUrl.host) === null) return NextResponse.redirect(url);
  const attr = url.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${attr}"><title>Minty</title>`,
    {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    },
  );
}
