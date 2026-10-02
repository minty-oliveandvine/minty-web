// The shell's contract: how a person gets in. The handoff stores the cookie and lands on
// `next`; no token -> Flask's re-handoff; no cookie on a page -> Flask's re-handoff for THAT
// page; `/` -> /entities (the list).
//
// Skeletal screens are located by role and text, never by class: the design pass may change
// every class name and these must still pass.
import { expect, test } from "@playwright/test";

import type { Page } from "@playwright/test";

import {
  PETTY_CASH_URL,
  handoff,
  requireApp,
  requireCredentials,
  stubBillingApi,
  stubFlaskHandoff,
} from "./helpers";

/** The entity list reads Flask; answer it, with nobody's companies - these specs are about where
 *  the browser lands, not what the list says. */
async function stubEntityList(page: Page) {
  await page.route(`${PETTY_CASH_URL}/api/me/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entities: [], notices: [], user: null, entity: null }),
    }),
  );
}

/** Arriving with no company - as Minty's /entity sends people - so the list keeps the token. */
const unscoped = (creds: ReturnType<typeof requireCredentials>) => ({
  ...creds,
  entityId: "",
  entityName: "",
});

test.describe("landing and the gates", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("no token: the landing sends the browser to Flask's re-handoff", async ({ page }) => {
    await stubFlaskHandoff(page);
    const response = await page.goto("/landing?next=/subscription/billing");
    expect(response?.ok()).toBeTruthy();
    await page.waitForURL((u) => u.pathname.endsWith("/handoff/minty-web"), { timeout: 15_000 });
    const landed = new URL(page.url());
    expect(landed.origin).toBe(new URL(PETTY_CASH_URL).origin);
    expect(landed.searchParams.get("next")).toBe("/subscription/billing");
  });

  test("no cookie: a subscription page goes to Flask's re-handoff for that page", async ({
    page,
  }) => {
    // The gate is a server-side 307 from proxy.ts. Read it directly rather than following it: a
    // browser follows the redirect at network level, where page.route cannot stub Flask.
    const res = await page.request.get("/subscription/billing?page=2", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const location = new URL(res.headers()["location"]);
    expect(location.origin + location.pathname).toBe(PETTY_CASH_URL + "/handoff/minty-web");
    expect(location.searchParams.get("next")).toBe("/subscription/billing?page=2");
  });

  test("the handoff stores the token and lands on next", async ({ page, context }) => {
    const creds = requireCredentials();
    await stubBillingApi(page);
    await handoff(page, creds, "/subscription");

    expect(new URL(page.url()).pathname).toBe("/subscription");
    const cookies = await context.cookies();
    const token = cookies.find((c) => c.name === "minty_token");
    expect(token).toBeTruthy();
    const payload = JSON.parse(
      Buffer.from(decodeURIComponent(token!.value).split(".")[1], "base64url").toString("utf8"),
    ) as { user_id: string };
    expect(payload.user_id).toBe(creds.userId);
    expect(cookies.find((c) => c.name === "minty_entity_name")?.value).toBe(
      encodeURIComponent(creds.entityName),
    );
    // the cookie lives as long as the token (30 minutes), not longer
    expect(token!.expires * 1000 - Date.now()).toBeLessThan(31 * 60 * 1000);

    // /subscription is the portal's landing - the account at a glance (Figma 08-A); the list
    // of companies is a page on from it.
    await expect(page.getByRole("heading", { name: "Subscription & Billing" })).toBeVisible();
    // No tab row above the page (removed 2026-09-29): the landing's own buttons lead on (not
    // asserted here - the API is a 501 stub in this spec, so the page shows its retry state).
    await expect(page.getByRole("navigation", { name: "Subscription sections" })).toHaveCount(0);
  });

  test("an unsafe next is ignored: the entity list instead", async ({ page }) => {
    const creds = requireCredentials();
    await stubEntityList(page);
    await handoff(page, unscoped(creds), "//evil.example/phish");
    expect(new URL(page.url()).pathname).toBe("/entities");
  });

  test("/ is the entity list, the hub's first page", async ({ page }) => {
    const creds = requireCredentials();
    await stubEntityList(page);
    await handoff(page, unscoped(creds), "/");
    expect(new URL(page.url()).pathname).toBe("/entities");
    await expect(page.getByRole("heading", { level: 1, name: "Select Company" })).toBeVisible();
  });
});
