// A company's module choice (phase 2) over a STUBBED Flask: the doors the database's modules
// call for, each entering its module through Minty's /enter; a wrong name in the address is
// corrected; one module goes straight in; and nothing is wider than the screen at 360 / 768 / 1440.

import { expect, test, type Page } from "@playwright/test";

import { PETTY_CASH_URL, SUBSCRIPTION_API_URL, credentials, handoff, requireApp } from "../../../e2e/helpers";

const COMPANY = { id: "360812e1-9f94-46a3-aa31-347e21afde8e", name: "Olive & Vine" };
const STUB_CREDS = { secret: "stub-flask-never-sees-this", userId: "u-e2e", entityId: COMPANY.id, entityName: COMPANY.name };
const creds = () => ({ ...(credentials() ?? STUB_CREDS), entityId: COMPANY.id, entityName: COMPANY.name });

async function stubFlask(page: Page, modules: string[]) {
  const row = {
    id: COMPANY.id,
    name: COMPANY.name,
    status: "connected",
    modules,
    trial_modules: [],
    trial_module_names: [],
    last_accessed_at: null,
    last_accessed_by: null,
  };
  await page.route(`${PETTY_CASH_URL}/api/me/entities**`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ entities: [row], notices: [] }) }),
  );
  await page.route(`${PETTY_CASH_URL}/api/me/profile**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: { id: "u-e2e", first_name: "Olive", last_name: "Vine", name: "Olive Vine", initials: "OV", email: "o@x.com" }, entity: null }),
    }),
  );
  await page.route(`${SUBSCRIPTION_API_URL}/api/me/subscriptions**`, (route) =>
    route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not_found" }) }),
  );
  // Where the doors lead: Minty's /enter, answered here so the browser stays put.
  await page.route(`${PETTY_CASH_URL}/entity/**/enter**`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>Minty enters the module</p>" }),
  );
}

test.describe("module choice", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("two doors, each entering its module through Minty; a wrong name is corrected", async ({ page }) => {
    await stubFlask(page, ["PETTY_CASH", "PAYMENT_REQUEST"]);
    await handoff(page, creds(), "/entities/360812e1/old-name");

    await expect(page).toHaveURL(/\/entities\/360812e1\/olive-and-vine$/);
    await expect(page.getByRole("heading", { level: 1, name: "Choose Module Type" })).toBeVisible();
    const petty = page.getByRole("link", { name: "Petty Cash" });
    await expect(petty).toHaveAttribute("href", new RegExp(`/entity/${COMPANY.id}/enter\\?token=.+&next=%2Fentity%2F${COMPANY.id}%2Fpetty-cash$`));
    await expect(page.getByRole("link", { name: "Payment Request" })).toHaveAttribute(
      "href",
      new RegExp(`next=%2Fentity%2F${COMPANY.id}%2Fpayment-request$`),
    );

    await page.getByRole("link", { name: "Payment Request" }).click();
    await expect(page).toHaveURL(new RegExp(`${PETTY_CASH_URL}/entity/${COMPANY.id}/enter`));
  });

  test("one module goes straight into it", async ({ page }) => {
    await stubFlask(page, ["PETTY_CASH"]);
    await handoff(page, creds(), "/entities/360812e1/olive-and-vine");
    await expect(page).toHaveURL(new RegExp(`${PETTY_CASH_URL}/entity/${COMPANY.id}/enter.*petty-cash`));
  });

  for (const width of [360, 768, 1440]) {
    test(`nothing is wider than the screen at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await stubFlask(page, ["PETTY_CASH", "PAYMENT_REQUEST"]);
      await handoff(page, creds(), "/entities/360812e1/olive-and-vine");
      await expect(page.getByRole("link", { name: "Petty Cash" })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});
