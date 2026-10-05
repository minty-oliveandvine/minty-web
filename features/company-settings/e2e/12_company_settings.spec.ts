// A company's Users and Entity & Integration tabs (phase 2) over a STUBBED Flask: the roster and
// an invitation sent from a phone, the pills moving between the tabs, a save, Disconnect asking
// first, and nothing wider than the screen at 360 / 768 / 1440.

import { expect, test, type Page } from "@playwright/test";

import { PETTY_CASH_URL, SUBSCRIPTION_API_URL, credentials, handoff, requireApp } from "../../../e2e/helpers";

const ID = "360812e1-9f94-46a3-aa31-347e21afde8e";
const NAME = "Olive & Vine";
const BASE = "/entities/360812e1/olive-and-vine/settings";
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
  await answer("/api/me/company/integration", (method, body) =>
    method === "PATCH" ? [200, { ...INTEGRATION, company: { ...INTEGRATION.company, ...(body as object) }, message: "Settings saved!" }] : [200, INTEGRATION],
  );
  await answer("/api/me/company/xero/disconnect", () => [200, { ...INTEGRATION, xero: { ...INTEGRATION.xero, connected: false, status: "disconnected", organisation: null }, message: "You're disconnected from Xero." }]);
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
    });
  }
});
