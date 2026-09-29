// Shared plumbing: the module handoff token Minty mints, the landing handoff, the skips.
//
// WHY THIS MINTS ITS OWN TOKEN
//
// In production a person opens Subscriptions in Minty; Flask mints a 30-minute HS256 JWT
// (blueprints/entity/routes/modules.py::_generate_module_token) and sends the browser to
// /landing?token=... here, which stores it in the `minty_token` cookie. A test cannot go
// through Minty's login (email OTP), but it holds the same SECRET_KEY, so it mints the same
// token. Nothing is bypassed: minty-billing-api verifies signature, expiry and the user exactly
// as it does Flask's. (billing-frontend/e2e/helpers.ts, the same reasoning.)
import { createHmac } from "node:crypto";

import { test, type Page } from "@playwright/test";

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export type Credentials = { secret: string; userId: string; entityId: string; entityName: string };

export const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3002";
export const BILLING_API_URL = process.env.E2E_BILLING_API_URL || "http://localhost:8004";
export const FLASK_URL = process.env.E2E_FLASK_URL || "http://localhost:5001";

export function credentials(): Credentials | null {
  const secret = process.env.E2E_JWT_SECRET;
  const userId = process.env.E2E_MINTY_USER;
  const entityId = process.env.E2E_MINTY_ENTITY;
  if (!secret || !userId || !entityId) return null;
  return {
    secret,
    userId,
    entityId,
    entityName: process.env.E2E_MINTY_ENTITY_NAME || "E2E Petty Cash Shop",
  };
}

export function requireCredentials(): Credentials {
  const creds = credentials();
  test.skip(
    !creds,
    "Set E2E_JWT_SECRET (Minty SECRET_KEY), E2E_MINTY_USER and E2E_MINTY_ENTITY (see e2e/README.md)",
  );
  return creds as Credentials;
}

/** The claims Minty puts in the module token. `entity_id: ""` is the unscoped token the portal gets. */
export function mintModuleToken(
  creds: Credentials,
  overrides: Record<string, unknown> = {},
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      user_id: creds.userId,
      entity_id: creds.entityId,
      xero_org_id: "",
      role: "admin",
      system_role: "normal",
      module: "billing",
      sid: "e2e",
      billing_enabled: true,
      petty_cash_enabled: true,
      exp: now + 1800,
      iat: now,
      ...overrides,
    }),
  );
  const signature = b64url(
    createHmac("sha256", creds.secret).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${signature}`;
}

/** A token with a real shape and a wrong signature - what a forged or stale cookie looks like. */
export function forgedToken(): string {
  return mintModuleToken({
    secret: "not-the-shared-key",
    userId: "nobody",
    entityId: "",
    entityName: "",
  });
}

export async function reachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: "manual" });
    return res.status > 0 && res.status < 500;
  } catch {
    return false;
  }
}

/** The app itself must be up; the API only for the specs that say so. */
export async function requireApp(): Promise<void> {
  test.skip(!(await reachable(BASE_URL + "/landing")), "minty-web (:3002) is not answering");
}

export async function requireStack(): Promise<void> {
  await requireApp();
  test.skip(
    !(await reachable(BILLING_API_URL + "/healthz")),
    "minty-billing-api (:8004) is not answering",
  );
}

/**
 * The mode the stack under test runs in. ``E2E_SUBSCRIPTIONS=0`` says the app was built with
 * NEXT_PUBLIC_SUBSCRIPTION_ENABLED=0 and the backends run with SUBSCRIPTION_ENABLED=0 (dark,
 * the cutover state); unset or ``1`` means live.
 */
export function subscriptionsDark(): boolean {
  const raw = (process.env.E2E_SUBSCRIPTIONS ?? "1").trim().toLowerCase();
  return raw === "0" || raw === "false" || raw === "off";
}

/**
 * Answer Flask's Terms check (`GET /api/me/terms`, the gate over every page - components/ui/
 * TermsGate.tsx) ourselves. `handoff` answers "nothing owed" unless a spec says otherwise: the
 * gate is 09_terms.spec.ts's subject, every other spec is about its own page, and the shared
 * e2e account owes an acceptance that nobody may give on it.
 */
export async function answerTerms(page: Page, answer: unknown = { owed: false }): Promise<void> {
  await page.route(`${FLASK_URL}/api/me/terms`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(answer) }),
  );
}

/**
 * Arrive the way Minty sends people: /landing stores the token and forwards to ``next``.
 * `terms`: what the Terms check answers on the way in (`answerTerms`) - nothing owed by default.
 */
export async function handoff(
  page: Page,
  creds: Credentials,
  next = "/subscription",
  overrides: Record<string, unknown> = {},
  { terms = { owed: false } as unknown } = {},
): Promise<void> {
  await answerTerms(page, terms);
  const token = mintModuleToken(creds, overrides);
  const qs = new URLSearchParams({
    next,
    entity_id: creds.entityId,
    entity_name: creds.entityName,
    token,
  });
  await page.goto(`/landing?${qs.toString()}`);
  await page.waitForURL((u) => !u.pathname.startsWith("/landing"), { timeout: 15_000 });
  await page.waitForLoadState("networkidle");
}

/**
 * Answer the billing API ourselves with what its routers are until Part 2 step 3: a 501 stub.
 * The shell's specs are about the landing and the gates, not the data; over the real API a
 * token for a user the API's database does not hold is a 401, which sends the browser through
 * Flask's re-handoff and out of the app under test.
 */
export async function stubBillingApi(page: Page): Promise<void> {
  await page.route(`${BILLING_API_URL}/api/**`, (route) =>
    route.fulfill({
      status: 501,
      contentType: "application/json",
      body: JSON.stringify({ error: "not_implemented" }),
    }),
  );
}

/**
 * Answer Flask's re-handoff route ourselves. The specs assert WHERE the app sends the browser,
 * not what Flask does with it (Minty's `tests/test_minty_web_handoff.py` covers that side); a
 * real navigation there with Flask down would be a connection error that hides the assertion.
 */
export async function stubFlaskHandoff(page: Page): Promise<void> {
  await page.route(`${FLASK_URL}/handoff/minty-web**`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<title>handoff stub</title>" }),
  );
}

/**
 * Answer Flask's re-handoff AS Flask does, for the journeys that go through it and carry on: a
 * token for the company asked for (`entity_id`) - or an unscoped one when none is - and the
 * browser sent on to this app's landing with it. The portal's Back to Manage Subscriptions goes
 * this way to trade a company's token for an unscoped one. The hop is client-side because
 * Playwright cannot stub the target of a server redirect. Returns each query Flask was asked.
 */
export async function bounceFlaskHandoff(page: Page, creds: Credentials): Promise<string[]> {
  const asked: string[] = [];
  await page.route(`${FLASK_URL}/handoff/minty-web**`, (route) => {
    const url = new URL(route.request().url());
    asked.push(url.search);
    const entityId = url.searchParams.get("entity_id") ?? "";
    const qs = new URLSearchParams({
      next: url.searchParams.get("next") ?? "/subscription",
      entity_id: entityId,
      entity_name: entityId ? creds.entityName : "",
      token: mintModuleToken({ ...creds, entityId }),
    });
    return route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<script>location.replace(${JSON.stringify(`${BASE_URL}/landing?${qs}`)})</script>`,
    });
  });
  return asked;
}

/** What the stored token names: the `minty_entity_id` cookie and the token's own claim. */
export async function storedScope(page: Page): Promise<{ cookie: string; claim: unknown }> {
  const jar = await page.context().cookies(BASE_URL);
  const token = jar.find((c) => c.name === "minty_token")?.value ?? "";
  const payload = decodeURIComponent(token).split(".")[1] ?? "";
  const claims = payload ? JSON.parse(Buffer.from(payload, "base64url").toString()) : {};
  return {
    cookie: decodeURIComponent(jar.find((c) => c.name === "minty_entity_id")?.value ?? ""),
    claim: claims.entity_id,
  };
}
