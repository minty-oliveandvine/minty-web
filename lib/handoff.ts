/**
 * Getting a token, and getting a new one.
 *
 * This app never mints a token and never refreshes one (Flask is the single minter -
 * cross-cutting rule 1). Both the first arrival and a lapsed session go through Flask's
 * login-gated `GET /handoff/minty-web?next=<path>&entity_id=<id>` (Minty, Part 2 step 5):
 * with a live Flask session it mints the module token and sends the browser straight back to
 * `/landing?token=…&next=<path>` here - a silent round trip, because Flask's 24-hour session
 * outlives the 30-minute token; without one it shows the login first and then does the same.
 */

import { clearAuth } from "@/lib/auth";
import { env } from "@/lib/env";

/** A path this app may land on after the handoff: same-origin, absolute, not protocol-relative. */
export function safeNext(raw: string | null | undefined, fallback = "/subscription"): string {
  if (!raw) return fallback;
  return raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}

export function handoffUrl(next: string, entityId?: string): string {
  const qs = new URLSearchParams({ next: safeNext(next) });
  if (entityId) qs.set("entity_id", entityId);
  return `${env.MINTY_URL}/handoff/minty-web?${qs.toString()}`;
}

type Navigate = (url: string) => void;

const defaultNavigate: Navigate = (url) => {
  window.location.href = url;
};

let navigate: Navigate = defaultNavigate;
let redirecting = false;

/**
 * Send the browser to Flask for a fresh token, once. Several requests in flight fail together
 * on an expired token, and each one reassigning `location.href` while the first navigation is
 * already under way is how a redirect turns into a flicker.
 */
export function redirectToHandoff(next?: string, entityId?: string) {
  if (redirecting || typeof window === "undefined") return;
  redirecting = true;
  clearAuth();
  const target = next ?? window.location.pathname + window.location.search;
  navigate(handoffUrl(target, entityId));
}

/** Send the browser somewhere outside the app - Stripe's card form - through the same seam. */
export function leaveTo(url: string) {
  navigate(url);
}

/** Test seam: forget that a redirect is under way, and optionally capture the navigation
 * instead of assigning `location.href` (jsdom does not allow `location` to be replaced). */
export function _resetHandoffForTests(capture?: Navigate) {
  redirecting = false;
  navigate = capture ?? defaultNavigate;
}
