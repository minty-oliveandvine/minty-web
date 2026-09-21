// The shell's contract: how a person gets in, and what they see while the feature is dark.
//
//   live  the handoff stores the cookie and lands on `next`; no token -> Flask's re-handoff;
//         no cookie on a page -> Flask's re-handoff for THAT page; `/` -> /subscription
//   dark  /subscription and / -> the not-available page; the landing still stores the cookie
//
// Skeletal screens are located by role and text, never by class: the design pass may change
// every class name and these must still pass.
import { expect, test } from "@playwright/test";

import {
  FLASK_URL,
  handoff,
  requireApp,
  requireCredentials,
  stubFlaskHandoff,
  subscriptionsDark,
} from "./helpers";

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
    expect(landed.origin).toBe(new URL(FLASK_URL).origin);
    expect(landed.searchParams.get("next")).toBe("/subscription/billing");
  });

  test("no cookie: a subscription page goes to Flask's re-handoff for that page", async ({
    page,
  }) => {
    test.skip(subscriptionsDark(), "dark: the page goes to not-available instead (see below)");
    // The gate is a server-side 307 from proxy.ts. Read it directly rather than following it: a
    // browser follows the redirect at network level, where page.route cannot stub Flask.
    const res = await page.request.get("/subscription/invoices?page=2", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const location = new URL(res.headers()["location"]);
    expect(location.origin + location.pathname).toBe(FLASK_URL + "/handoff/minty-web");
    expect(location.searchParams.get("next")).toBe("/subscription/invoices?page=2");
  });

  test("the handoff stores the token and lands on next", async ({ page, context }) => {
    test.skip(subscriptionsDark(), "dark: /subscription is not reachable (see below)");
    const creds = requireCredentials();
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

    await expect(page.getByRole("heading", { name: "Your subscriptions" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Subscription sections" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Invoices" }).first()).toBeVisible();
  });

  test("an unsafe next is ignored", async ({ page }) => {
    test.skip(subscriptionsDark(), "dark: /subscription is not reachable (see below)");
    const creds = requireCredentials();
    await handoff(page, creds, "//evil.example/phish");
    expect(new URL(page.url()).pathname).toBe("/subscription");
  });

  test("/ is the feature", async ({ page }) => {
    test.skip(subscriptionsDark(), "dark: / goes to not-available (see below)");
    const creds = requireCredentials();
    await handoff(page, creds, "/");
    expect(new URL(page.url()).pathname).toBe("/subscription");
  });
});

test.describe("dark", () => {
  test.beforeEach(async () => {
    await requireApp();
    test.skip(!subscriptionsDark(), "the app runs live (E2E_SUBSCRIPTIONS != 0)");
  });

  test("/subscription and / show the not-available page, cookie or not", async ({ page }) => {
    for (const path of ["/subscription", "/subscription/billing", "/"]) {
      await page.goto(path);
      await page.waitForURL((u) => u.pathname === "/not-available", { timeout: 15_000 });
      await expect(page.getByRole("heading", { name: /aren't available yet/ })).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to Minty" })).toHaveAttribute(
        "href",
        FLASK_URL,
      );
    }
  });

  test("the landing still stores the token and then lands on not-available", async ({
    page,
    context,
  }) => {
    const creds = requireCredentials();
    await handoff(page, creds, "/subscription");
    expect(new URL(page.url()).pathname).toBe("/not-available");
    expect((await context.cookies()).some((c) => c.name === "minty_token")).toBe(true);
  });
});
