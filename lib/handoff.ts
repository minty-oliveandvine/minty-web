/**
 * Getting a token, getting a new one, and leaving - this app's instance of
 * `@minty/shared/handoff` (owner 2026-10-21: one shared module).
 *
 * This app never mints a token and never refreshes one (Flask is the single minter -
 * cross-cutting rule 1). Both the first arrival and a lapsed session go through Flask's
 * login-gated `GET /handoff/minty-web?next=<path>&entity_id=<id>` (Minty, Part 2 step 5):
 * with a live Flask session it mints the module token and sends the browser straight back to
 * `/landing?token=…&next=<path>` here - a silent round trip, because Flask's 24-hour session
 * outlives the 30-minute token; without one it shows the login first and then does the same.
 *
 * No `companyFromNext`: Flask's minty-web hand-off accepts only a full company id, never the
 * address form `<shortid>/<name>`. Every trip names the page's origin as `return_origin`
 * (`withReturnOrigin`, `@minty/shared/previewSibling`) so Flask can hand back into a branch
 * preview set; the proxy passes the request's origin, since it runs on the server.
 */

import { createHandoff, logoutUrl } from "@minty/shared/handoff";

import { clearAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { HUB_HOME } from "@/lib/hubPaths";

const handoff = createHandoff({
  flaskBase: () => env.PETTY_CASH_URL,
  route: "/handoff/minty-web",
  clearAuth,
  home: HUB_HOME,
});

/** A path this app may land on after the handoff; anything else is the hub home (or `fallback`). */
export const safeNext = handoff.safeNext;

/** Flask's hand-off back into this app for `next` (made safe), naming the company when given. */
export const handoffUrl = handoff.handoffUrl;

/**
 * Send the browser to Flask for a fresh token, once - several requests in flight fail together
 * on an expired token. Clears the cookie first; with no `next`, the page it is on.
 */
export const redirectToHandoff = handoff.redirectToHandoff;

/** Send the browser somewhere outside the app - Stripe's card form - through the same seam. */
export const leaveTo = handoff.leaveTo;

/**
 * Log out - the side menu's Logout and My Profile's Log Out are the same act: forget this
 * app's token, then end the session at Minty (Flask's /logout signs the person out and lands
 * on the sign-in page - this app's /login since phase 2), so no app is left signed in behind
 * the one that said goodbye. Not the once-only redirect: a second log out goes again.
 */
export function logOut(): void {
  clearAuth();
  leaveTo(logoutUrl(env.PETTY_CASH_URL));
}

/** Test seam: forget that a redirect is under way, and optionally capture the navigation
 * instead of assigning `location.href` (jsdom does not allow `location` to be replaced). */
export const _resetHandoffForTests = handoff._resetForTests;
