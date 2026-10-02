// My Profile in a browser (Figma 10-A / 10-B), over a STUBBED Flask and billing API: the page in
// the real app - the route, the company it was opened from, the subscription feature's card in
// its slot, an edit saved in place and the menu naming the person anew - and the same profile in
// the sidebar, from both of its doors; not the backends (Minty's tests/test_hub_profile.py
// covers Flask's side). Located by role and text.
import { expect, test, type Page } from "@playwright/test";

import {
  SUBSCRIPTION_API_URL,
  credentials,
  PETTY_CASH_URL,
  handoff,
  requireApp,
} from "../../../e2e/helpers";
import { SCOPED, SUPERMINTY, UNSCOPED } from "../__fixtures__/profile";
import type { Profile } from "../api/profile";

const STUB_CREDS = {
  secret: "stub-flask-never-sees-this",
  userId: "u-john",
  entityId: "e-company-a",
  entityName: "Company A Limited",
};
const creds = () => credentials() ?? STUB_CREDS;

// The billing API's list, as small as the card needs: one company paying for Petty Cash. Written
// here rather than borrowed from the subscription feature's fixtures - a feature never reaches
// into another, its tests included.
const PAYER_LIST = {
  payer: { id: "u-john", name: "John Birmingha", email: "john.doe@oliveandvinehk.com" },
  billing: {
    anchor: null,
    anchor_iso: null,
    paid_through: null,
    paid_through_iso: null,
    next_billing: null,
    next_billing_iso: null,
    currency: "HKD",
  },
  entities: [
    {
      entity_id: "e-company-a",
      entity_name: "Company A Limited",
      country_code: "HK",
      country: "Hong Kong",
      subscriber: { id: "u-john", name: "John Birmingha" },
      modules: [
        {
          code: "PETTY_CASH",
          name: "Petty Cash",
          status: "active",
          status_label: "Active",
          date_label: "",
          date: "",
          date_iso: null,
        },
      ],
      settings_path: "",
      created_at: "2026-01-01",
    },
  ],
  total: 1,
  page: 1,
  pages: 1,
  per_page: 100,
  sort: "entity",
  direction: "asc",
  query: "",
  transfer_outcomes: [],
};

async function stub(page: Page, profile: Profile, saved?: Profile): Promise<unknown[]> {
  const sent: unknown[] = [];
  await page.route(`${PETTY_CASH_URL}/api/me/profile**`, (route) => {
    const req = route.request();
    if (req.method() === "PATCH") {
      sent.push(req.postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(saved ?? profile),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(profile),
    });
  });
  await page.route(`${SUBSCRIPTION_API_URL}/api/me/subscriptions**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PAYER_LIST),
    }),
  );
  return sent;
}

test.describe("My Profile", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("10-A: opened inside a company - its plan, the role, the details, the overview", async ({
    page,
  }) => {
    await stub(page, SCOPED);
    await handoff(page, creds(), "/profile");

    const main = page.getByRole("main");
    await expect(page.getByRole("heading", { level: 1, name: "My Profile" })).toBeVisible();
    const who = main.getByRole("region", { name: "Who you are" });
    await expect(who.getByText("Company A Limited")).toBeVisible();
    await expect(who.getByText("Payment Request")).toBeVisible();
    await expect(who.getByText("Shop Manager")).toBeVisible();
    await expect(
      main.getByRole("region", { name: "Your details" }).getByText("john.doe@oliveandvinehk.com"),
    ).toBeVisible();
    await expect(main.getByRole("link", { name: /Change password/ })).toHaveAttribute(
      "href",
      "https://identity.xero.com/account",
    );

    const overview = main.getByRole("region", { name: "Subscriptions Overview" });
    await expect(overview.getByRole("link", { name: "Manage Subscription" })).toHaveAttribute(
      "href",
      "/subscription",
    );
  });

  test("an edit is saved in place and the menu names the person anew", async ({ page }) => {
    const saved: Profile = {
      ...SCOPED,
      user: { ...SCOPED.user, first_name: "Jonathan", name: "Jonathan Birmingha" },
    };
    const sent = await stub(page, SCOPED, saved);
    await handoff(page, creds(), "/profile");

    const details = page.getByRole("region", { name: "Your details" });
    await details.getByRole("button", { name: "Edit" }).click();
    await details.getByRole("textbox", { name: "FIRST NAME" }).fill("Jonathan");
    await details.getByRole("button", { name: "Save" }).click();

    await expect(details.getByText("Jonathan", { exact: true })).toBeVisible();
    expect(sent).toEqual([{ first_name: "Jonathan" }]);
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const menu = page.getByRole("navigation", { name: "Main navigation" });
    const name = menu.getByRole("button", { name: "Jonathan Birmingha, My Profile" });
    await expect(name).toBeVisible();
    // on the profile page the menu's name only closes the sidebar - this page IS the profile
    await name.click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/\/profile$/);
  });

  test("the sidebar's My Profile: from the header's initials, and from the menu's name, over the page", async ({
    page,
  }) => {
    await stub(page, UNSCOPED);
    await page.route(`${PETTY_CASH_URL}/api/me/entities**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ entities: [], notices: [] }),
      }),
    );
    await handoff(page, { ...creds(), entityId: "", entityName: "" }, "/entities");

    const panel = page.getByRole("region", { name: "My Profile" });
    await page
      .getByRole("banner")
      .getByRole("button", { name: "John Birmingha, My Profile" })
      .click();
    await expect(panel.getByRole("heading", { level: 2, name: "John Birmingha" })).toBeVisible();
    await expect(panel.getByRole("region", { name: "Your details" })).toBeVisible();
    await expect(page).toHaveURL(/\/entities$/);

    // ‹ back to the menu, and the menu's name back again
    await panel.getByRole("button", { name: "Back to the menu" }).click();
    const menu = page.getByRole("navigation", { name: "Main navigation" });
    await expect(menu).toBeVisible();
    await menu.getByRole("button", { name: "John Birmingha, My Profile" }).click();
    await expect(panel.getByRole("heading", { level: 2, name: "John Birmingha" })).toBeVisible();

    // on a phone the panel fills the screen (10-A is drawn at 375), and its own close is the
    // way out - there is nothing beside it to click (the region sits inside its 1 px border)
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(388);
    await panel.getByRole("button", { name: "Close My Profile" }).click();
    await expect(panel).toBeHidden();
  });

  test("the sidebar's My Profile never scrolls sideways - 440 px wide, the caped cat inside it", async ({
    page,
  }) => {
    // SuperMinty beside a long company name: the cat hangs 74 px off the name's right, and used
    // to reach 38 px past the 375 px panel's edge
    await stub(page, {
      ...SUPERMINTY,
      entity: { ...SUPERMINTY.entity!, name: "Digitalisation - Scenario 5 - Free trial + Active" },
    });
    await page.route(`${PETTY_CASH_URL}/api/me/entities**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ entities: [], notices: [] }),
      }),
    );
    await handoff(page, { ...creds(), entityId: "", entityName: "" }, "/entities");

    const panel = page.getByRole("region", { name: "My Profile" });
    await page
      .getByRole("banner")
      .getByRole("button", { name: "John Birmingha, My Profile" })
      .click();
    const cat = panel.locator('img[src*="super-minty"]');
    await expect(cat).toBeVisible();

    const fits = () =>
      panel.evaluate((el) => {
        const drawer = el.parentElement!;
        const right = drawer.getBoundingClientRect().left + drawer.clientLeft + drawer.clientWidth;
        const cat = el.querySelector('img[src*="super-minty"]')!.getBoundingClientRect();
        return {
          sideways: drawer.scrollWidth - drawer.clientWidth,
          catPastEdge: cat.right - right,
        };
      });

    // wider than 10-A's 375 on a desktop (the region sits inside the panel's 1 px border); the
    // panel animates its width as it opens, so wait for it to settle
    await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(438);
    let measured = await fits();
    expect(measured.sideways).toBe(0);
    expect(measured.catPastEdge).toBeLessThanOrEqual(0);

    // and on a phone, where the panel is the whole screen
    await page.setViewportSize({ width: 375, height: 812 });
    await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(373);
    measured = await fits();
    expect(measured.sideways).toBe(0);
    expect(measured.catPastEdge).toBeLessThanOrEqual(0);
  });

  test("opened from the entity list: no company to name, and the way back is the list", async ({
    page,
  }) => {
    await stub(page, UNSCOPED);
    await handoff(page, { ...creds(), entityId: "", entityName: "" }, "/profile");

    const who = page.getByRole("main").getByRole("region", { name: "Who you are" });
    await expect(who.getByRole("heading", { name: "John Birmingha" })).toBeVisible();
    await expect(who.getByText("Company A Limited")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/entities");
  });
});
