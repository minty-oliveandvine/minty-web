import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// proxy.ts is Next 16's name for what the sibling apps still call proxy.ts (the old
// convention is deprecated in 16 and this repo starts on the current one).

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { env } from "@/lib/env";
import { handoffUrl } from "@/lib/handoff";
import { HUB_PATHS, isOpenPath } from "@/lib/hubPaths";

/**
 * Two gates, in this order:
 *
 * 1. THE COOKIE. Every page but the landing, the maintenance page and the not-available page
 *    needs the module token cookie (lib/auth.ts). Without it the browser goes to Flask's
 *    login-gated re-handoff for the page it asked for - not to a login form of this app's,
 *    which has none. The cookie's max-age is the token's `exp`, so "no cookie" and "expired
 *    token" are the same case here.
 * 2. THE SWITCH. With NEXT_PUBLIC_SUBSCRIPTION_ENABLED off (lib/env.ts), the subscription
 *    feature's routes go to the static not-available page; the hub's own pages (the entity
 *    list, the profile - and `/`, which is the list) are not the feature's and stay
 *    reachable. The backends are the real guard (404 while dark); this keeps the doors out of
 *    sight, the same rule billing-frontend applies to its portal.
 *
 * Only the shell knows where the feature is mounted (`lib/hubPaths.ts`, beside the folder
 * app/subscription). Extracting the feature into its own app deletes both.
 */
const FEATURE_PREFIX = HUB_PATHS.subscription;

function isFeature(pathname: string): boolean {
  return pathname === FEATURE_PREFIX || pathname.startsWith(FEATURE_PREFIX + "/");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isOpenPath(pathname)) {
    return NextResponse.next();
  }

  // The entity list and the profile (and `/`, which is the list) answer whatever the switch says.
  if (!env.SUBSCRIPTION_ENABLED && isFeature(pathname)) {
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
