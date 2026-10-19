/**
 * A COPY of `@minty/shared/previewSibling` (v0.2): minty-web stays on v0.1 until it moves to the
 * Part 13 design (owner, 2026-10-13); then delete this file and import the package's. Its
 * `withReturnOrigin` lives in lib/handoff.ts here for the same reason.
 *
 * Preview sets: one branch, one host per app - `pr-<slug>-<app>.dailyminty.com` (2026-10-13).
 *
 * The shared `vercel-preview-set.yml` workflow (the `.github` repo) aliases every frontend onto
 * the branch's set - the branch's own build where the repo has that branch, the fallback build
 * where it does not - so each member always exists. A page served on a set host therefore links
 * to the SAME set's other apps; the sibling URLs baked in at build time (`PAYMENT_REQUEST_WEB_URL`
 * and friends) would leave the set for the fallback's hosts.
 *
 * Decided at runtime from the host the page is served on, never at build: the fallback build
 * is a production build, yet it too must stay inside the set it is served in. Every other host
 * (production, dev-*, localhost, *.vercel.app) gets the configured URL back untouched.
 *
 * The shape matches Flask's and the Django APIs' `PREVIEW_ORIGIN_REGEX` (minty-infra
 * `services.tf`): slug = 1-40 of [a-z0-9-], no leading or trailing hyphen. The app is read from
 * the END of the label, so a slug may itself contain an app's name. Petty Cash's label is
 * `pettycash` (the package's v0.5 rename of `petty-cash`, Step 5 2026-10-19).
 */
export type PreviewApp = "my" | "payment-request" | "onboarding" | "pettycash" | "www";

const SET_HOST =
  /^pr-([a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?)-(?:my|payment-request|onboarding|pettycash|www)\.dailyminty\.com$/;

/** The slug of the preview set `host` belongs to, or null when it is not a set host. */
export function previewSetSlug(host: string | null | undefined): string | null {
  return host ? (SET_HOST.exec(host)?.[1] ?? null) : null;
}

/** `configuredUrl` moved onto `app`'s host in the same set, when `currentHost` is a set host. */
export function siblingUrl(
  configuredUrl: string,
  app: PreviewApp,
  currentHost: string | null | undefined,
): string {
  const slug = previewSetSlug(currentHost);
  if (slug === null) return configuredUrl;
  const url = new URL(configuredUrl);
  url.protocol = "https:";
  url.host = `pr-${slug}-${app}.dailyminty.com`;
  // URL writes a bare origin as "https://host/"; give one back in the form it came in.
  const bare = url.pathname === "/" && !url.search && !url.hash && !configuredUrl.endsWith("/");
  return bare ? url.origin : url.toString();
}
