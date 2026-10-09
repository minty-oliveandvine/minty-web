// A company's Users and Entity & Integration tabs (phase 2) over a STUBBED Flask: the roster and
// an invitation sent from a phone, the pills moving between the tabs, a save, Disconnect asking
// first, "Leave without saving?" on every way out of a changed form - including Back and the
// browser's own Back, which only a real browser can test - and nothing wider than the screen at
// 360 / 768 / 1440.

import { expect, test, type Page } from "@playwright/test";

import { PETTY_CASH_URL, SUBSCRIPTION_API_URL, credentials, handoff, requireApp } from "../../../e2e/helpers";

const ID = "360812e1-9f94-46a3-aa31-347e21afde8e";
const NAME = "Olive & Vine";
const BASE = "/entity/360812e1/olive-and-vine/settings";
const STUB_CREDS = { secret: "stub-flask-never-sees-this", userId: "u-e2e", entityId: ID, entityName: NAME };
const creds = () => ({ ...(credentials() ?? STUB_CREDS), entityId: ID, entityName: NAME });

const USERS = {
  company: { id: ID, name: NAME },
  modules: ["PETTY_CASH", "PAYMENT_REQUEST"],
  members: [
    { id: "u1", first_name: "Ada", last_name: "Admin", email: "ada@test.com", initials: "AA", role: "admin", role_label: "Admin", subscriber: true, is_you: true, can_change_role: true, can_remove: true },
    { id: "u2", first_name: "Cas", last_name: "Hier", email: "cas@test.com", initials: "CH", role: "cashier", role_label: "Cashier", subscriber: false, is_you: false, can_change_role: true, can_remove: true },
  ],
  invitations: [],
  roles: [
    { value: "admin", label: "Admin" },
    { value: "accountant", label: "Accountant" },
    { value: "shop_manager", label: "Shop Manager" },
    { value: "cashier", label: "Cashier" },
  ],
  can_invite: true,
  notices: [],
};

const INTEGRATION = {
  company: { id: ID, name: NAME, country_code: "HK", currency_id: "c-hkd" },
  modules: ["PETTY_CASH", "PAYMENT_REQUEST"],
  countries: [{ code: "HK", name: "Hong Kong" }, { code: "SG", name: "Singapore" }],
  currencies: [{ id: "c-hkd", name: "Hong Kong Dollar" }, { id: "c-sgd", name: "Singapore Dollar" }],
  xero: { status: "connected", connected: true, needs_reconnect: false, organisation: "Olive & Vine Ltd", last_connected_at: "2026-09-01T02:00:00Z" },
  can_edit: true,
  can_rename: true,
  notices: [],
};

/** The same company with no Xero connection - what a refused connect leaves behind. */
const FREE = { ...INTEGRATION, xero: { status: "disconnected", connected: false, needs_reconnect: false, organisation: null, last_connected_at: null } };
/** The company already holding the organisation, as `?xero_conflict=` resolves to. */
const HELD = { entity_id: "e-vine", entity_name: "Vine Cafe", organisation: "Vine Cafe Ltd", can_move: true };

async function stubFlask(page: Page) {
  const asked: { method: string; path: string; body: unknown }[] = [];
  const answer = (path: string, handler: (method: string, body: unknown) => [number, unknown]) =>
    page.route(`${PETTY_CASH_URL}${path}**`, (route) => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
      const raw = req.postData();
      const body = raw ? JSON.parse(raw) : null;
      asked.push({ method: req.method(), path, body });
      const [status, out] = handler(req.method(), body);
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(out) });
    });
  await answer("/api/me/company/users", () => [200, USERS]);
  await answer("/api/me/company/invitations", () => [201, { invitation_id: "i9", email_sent: true, message: "Invitation sent." }]);
  // `?xero_conflict=` on the read is Flask saying the connect was refused: another company holds
  // the organisation. Signed in reality; the stub only has to answer it.
  await page.route(`${PETTY_CASH_URL}/api/me/company/integration**`, (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204 });
    const raw = req.postData();
    const body = raw ? JSON.parse(raw) : null;
    asked.push({ method: req.method(), path: "/api/me/company/integration", body });
    const refused = new URL(req.url()).searchParams.get("xero_conflict");
    const out =
      req.method() === "PATCH"
        ? { ...INTEGRATION, company: { ...INTEGRATION.company, ...(body as object) }, message: "Settings saved!" }
        : { ...FREE, xero_conflict: refused ? HELD : null };
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(out) });
  });
  await answer("/api/me/company/xero/disconnect", () => [200, { ...INTEGRATION, xero: { ...INTEGRATION.xero, connected: false, status: "disconnected", organisation: null }, message: "You're disconnected from Xero." }]);
  await answer("/api/me/company/xero/release", () => [200, { message: '"Vine Cafe" is disconnected from Xero.' }]);
  await page.route(`${PETTY_CASH_URL}/api/me/profile**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "u1", first_name: "Ada", last_name: "Admin", name: "Ada Admin", initials: "AA", email: "ada@test.com" }, entity: null }),
    }),
  );
  await page.route(`${SUBSCRIPTION_API_URL}/api/me/subscriptions**`, (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not_found" }) }),
  );
  return asked;
}

test.describe("company settings", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("on a phone: the roster, an invitation sent, then the pills to Entity & Integration", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const asked = await stubFlask(page);
    await handoff(page, creds(), `${BASE}/users`);

    await expect(page.getByRole("heading", { level: 2, name: "Users" })).toBeVisible();
    // the browser tab names the company (lib/companyTitle.ts)
    await expect(page).toHaveTitle(`Users - ${NAME}`);
    await expect(page.getByText("Subscriber")).toBeVisible();
    await page.getByRole("button", { name: "Invite" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Email").fill("new@test.com");
    await dialog.getByLabel("First name").fill("New");
    await dialog.getByLabel("Last name").fill("Person");
    await dialog.getByLabel("Last name").press("Enter");
    await expect(page.getByText("Invitation sent.")).toBeVisible();
    expect(asked.find((a) => a.method === "POST" && a.path === "/api/me/company/invitations")?.body).toEqual({
      email: "new@test.com",
      role: "cashier",
      first_name: "New",
      last_name: "Person",
    });

    await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Entity & Integration" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/integration$`));
    await expect(page.getByRole("heading", { level: 2, name: "Entity & Integration" })).toBeVisible();
    await expect(page).toHaveTitle(`Entity & Integration - ${NAME}`);
  });

  test("Entity & Integration: a save sends only what changed; Disconnect asks first", async ({ page }) => {
    const asked = await stubFlask(page);
    await handoff(page, creds(), `${BASE}/integration`);

    await page.getByLabel("Country").selectOption("SG");
    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Settings saved!")).toBeVisible();
    expect(asked.filter((a) => a.method === "PATCH").map((a) => a.body)).toEqual([{ country_code: "SG" }]);

    await page.getByRole("button", { name: "Disconnect" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByText("Not connected")).toBeVisible();
  });

  // The guard's link rules are lib/__tests__/leaveGuard.test.tsx; what needs a REAL browser is
  // the history sentinel (the Navigation API, which jsdom has not) and the header's Back link,
  // which goes through history.go - no `beforeunload` could hold that one.
  test("Entity & Integration: leaving a changed form asks - the pills, Back, and the browser's Back", async ({ page }) => {
    const asked = await stubFlask(page);
    await handoff(page, creds(), `${BASE}/integration`);
    const pills = page.getByRole("navigation", { name: "Settings sections" });
    const dialog = page.getByRole("dialog");

    // nothing changed yet: the pill just goes
    await pills.getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/users$`));
    await pills.getByRole("link", { name: "Entity & Integration" }).click();
    await expect(page.getByLabel("Country")).toBeVisible();

    // changed: the pill asks, and Go Back keeps both the page and what was typed
    await page.getByLabel("Country").selectOption("SG");
    await pills.getByRole("link", { name: "Users" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("You have unsaved changes.")).toBeVisible();
    await dialog.getByRole("button", { name: "Go Back" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`${BASE}/integration$`));
    await expect(page.getByLabel("Country")).toHaveValue("SG");

    // the browser's own Back: held by the sentinel, with nothing clicked at all
    await page.goBack();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Go Back" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/integration$`));
    await expect(page.getByLabel("Country")).toHaveValue("SG");

    // Discard changes puts the saved value back and then goes, and nothing was ever sent
    await pills.getByRole("link", { name: "Users" }).click();
    await dialog.getByRole("button", { name: "Discard changes" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/users$`));
    expect(asked.filter((a) => a.method === "PATCH")).toEqual([]);
  });

  test("Entity & Integration: the header's Back link asks too, and a save clears the guard", async ({ page }) => {
    await stubFlask(page);
    await handoff(page, creds(), `${BASE}/integration`);
    const dialog = page.getByRole("dialog");

    await page.getByLabel("Country").selectOption("SG");
    // Back is history.go, not an address - the click rule is what holds it
    await page.getByRole("link", { name: /Back/ }).first().click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Go Back" }).click();

    await page.getByRole("button", { name: "Save Changes" }).click();
    await expect(page.getByText("Settings saved!")).toBeVisible();

    // saved: clean again, so every exit goes at once - and a reload raises no in-app dialog
    // (a reload's own warning is the browser's, which Playwright always dismisses)
    await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/users$`));
    await expect(dialog).toBeHidden();
  });

  // A refused Xero connect. The toast said what happened and nothing more; what the person
  // needs is the way on, which is a real disconnect of another company - so it is asked for.
  test("Entity & Integration: a refused connect offers to move the organisation", async ({ page }) => {
    const asked = await stubFlask(page);
    await handoff(page, creds(), `${BASE}/integration?xero_conflict=signed`);

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "That Xero organisation is taken" })).toBeVisible();
    await expect(dialog.getByText("Vine Cafe Ltd")).toBeVisible();

    // Go back changes nothing, and the card is left as it was - not connected.
    await dialog.getByRole("button", { name: "Go back" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Not connected")).toBeVisible();
    expect(asked.filter((a) => a.path === "/api/me/company/xero/release")).toEqual([]);

    // A reload does not raise it again: the hand-over is spent on the first read.
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Entity & Integration" })).toBeVisible();
    await expect(dialog).toBeHidden();
  });

  test("Entity & Integration: Move it here frees the other company, then leaves for Xero", async ({ page }) => {
    const asked = await stubFlask(page);
    // The second half is a navigation to Flask's OAuth start, which this stub does not answer:
    // catch it instead, so the test can see where the browser was sent.
    let wentTo = "";
    await page.route(`${PETTY_CASH_URL}/entity/**`, (route) => {
      wentTo = route.request().url();
      return route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>Xero</body></html>" });
    });
    await handoff(page, creds(), `${BASE}/integration?xero_conflict=signed`);

    await page.getByRole("dialog").getByRole("button", { name: "Move it here" }).click();

    // The company freed is the OTHER one, named in the body - never the one being viewed.
    await expect
      .poll(() => asked.filter((a) => a.path === "/api/me/company/xero/release").map((a) => a.body))
      .toEqual([{ entity_id: "e-vine" }]);
    // Then on to Xero for this company, through Flask's /enter so the session owns the token.
    // `next` is URL-encoded in there, hence the decode.
    await expect.poll(() => decodeURIComponent(wentTo)).toContain("next=/xero_reconnect?entity_id=");
  });

  for (const width of [360, 768, 1440]) {
    test(`nothing is wider than the screen at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await stubFlask(page);
      for (const tab of ["users", "integration"]) {
        await handoff(page, creds(), `${BASE}/${tab}`);
        await expect(page.getByRole("navigation", { name: "Settings sections" })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, tab).toBeLessThanOrEqual(0);
      }

      // The leave dialog at this width too: at 360 it crosses ConfirmDialog's stacked branch,
      // where the two answers sit one above the other.
      await page.getByLabel("Country").selectOption("SG");
      await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Users" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("button", { name: "Discard changes" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Go Back" })).toBeVisible();
      const asked = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(asked, `leave dialog at ${width}`).toBeLessThanOrEqual(0);

      // The refused-connect dialog at this width too: its sentences carry two company names and
      // an organisation's, which is the longest text any of these cards holds.
      await page.getByRole("button", { name: "Discard changes" }).click();
      await handoff(page, creds(), `${BASE}/integration?xero_conflict=signed`);
      const taken = page.getByRole("dialog");
      await expect(taken.getByRole("button", { name: "Move it here" })).toBeVisible();
      await expect(taken.getByRole("button", { name: "Go back" })).toBeVisible();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(over, `conflict dialog at ${width}`).toBeLessThanOrEqual(0);
    });
  }
});
