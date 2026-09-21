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

/** Arrive the way Minty sends people: /landing stores the token and forwards to ``next``. */
export async function handoff(
  page: Page,
  creds: Credentials,
  next = "/subscription",
  overrides: Record<string, unknown> = {},
): Promise<void> {
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
 * Answer Flask's re-handoff route ourselves. The specs assert WHERE the app sends the browser,
 * not what Flask does with it (that is Minty's e2e); and until Part 2 step 5 lands the route in
 * Flask, a real navigation there would be a connection error or a 404 that hides the assertion.
 */
export async function stubFlaskHandoff(page: Page): Promise<void> {
  await page.route(`${FLASK_URL}/handoff/minty-web**`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<title>handoff stub</title>" }),
  );
}
