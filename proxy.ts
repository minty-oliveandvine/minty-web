import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// proxy.ts is Next 16's name for what the sibling apps still call proxy.ts (the old
// convention is deprecated in 16 and this repo starts on the current one).

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { env } from "@/lib/env";
import { handoffUrl } from "@/lib/handoff";

/**
 * Two gates, in this order:
 *
 * 1. THE COOKIE. Every page but the landing, the maintenance page and the not-available page
 *    needs the module token cookie (lib/auth.ts). Without it the browser goes to Flask's
 *    login-gated re-handoff for the page it asked for - not to a login form of this app's,
 *    which has none. The cookie's max-age is the token's `exp`, so "no cookie" and "expired
 *    token" are the same case here.
 * 2. THE SWITCH. With NEXT_PUBLIC_SUBSCRIPTION_ENABLED off (lib/env.ts), the feature's routes
 *    go to the static not-available page. The backends are the real guard (404 while dark);
 *    this keeps the doors out of sight, the same rule billing-frontend applies to its portal.
 *
 * Only the shell knows the feature lives at /subscription - the folder app/subscription is the
 * shell's, and this constant is the one place outside it that spells the prefix. Extracting
 * the feature into its own app deletes both.
 */
const FEATURE_PREFIX = "/subscription";

const OPEN_PATHS = ["/landing", "/maintenance", "/not-available"];

function isOpen(pathname: string): boolean {
  return OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isFeature(pathname: string): boolean {
  return pathname === FEATURE_PREFIX || pathname.startsWith(FEATURE_PREFIX + "/");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isOpen(pathname)) {
    return NextResponse.next();
  }

  if (!env.SUBSCRIPTION_ENABLED && (isFeature(pathname) || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/not-available";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(handoffUrl(pathname + search));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
