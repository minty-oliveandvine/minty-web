import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// proxy.ts is Next 16's name for what the sibling apps still call proxy.ts (the old
// convention is deprecated in 16 and this repo starts on the current one).

import { AUTH_COOKIE_NAME } from "@/lib/auth";
import { handoffUrl } from "@/lib/handoff";
import { isOpenPath } from "@/lib/hubPaths";

/**
 * One gate - THE COOKIE. Every page but the landing and the maintenance page (`OPEN_PATHS`,
 * lib/hubPaths.ts) needs the module token cookie (lib/auth.ts). Without it the browser goes to
 * Flask's login-gated re-handoff for the page it asked for - not to a login form of this app's,
 * which has none. The cookie's max-age is the token's `exp`, so "no cookie" and "expired token"
 * are the same case here.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isOpenPath(pathname)) {
    return NextResponse.next();
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
