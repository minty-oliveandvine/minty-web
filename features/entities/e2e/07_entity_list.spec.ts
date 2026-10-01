// "Select Company" in a browser, over a STUBBED Flask: `/api/me/entities` and `/api/me/profile`
// are answered by page.route from the same fixtures the unit tests use. What this proves is the
// page in the real app - the route and its gate, the whole-screen layout with its centred
// column of rows and where they lead, search, what Flask flashed on the way, the header bar and
// the sidebar - not Flask
// (Minty's tests/test_hub_entity_list.py covers that side). Located by role and text, inside
// `main` or the sidebar, never by class.
import { expect, test, type Page } from "@playwright/test";

import {
  BILLING_API_URL,
  bounceFlaskHandoff,
  credentials,
  FLASK_URL,
  handoff,
  requireApp,
  storedScope,
} from "../../../e2e/helpers";
import { LIST } from "../__fixtures__/entities";
import type { EntityListAnswer } from "../api/entities";

const STUB_CREDS = {
  secret: "stub-flask-never-sees-this",
  userId: "u-e2e",
  entityId: "",
  entityName: "",
};

const creds = () => ({ ...(credentials() ?? STUB_CREDS), entityId: "", entityName: "" });
const VIEWER = {
  user: {
    id: "u-e2e",
    first_name: "Olive",
    last_name: "Vine",
    name: "Olive Vine",
    initials: "OV",
    email: "o@x.com",
  },
  entity: null,
};

async function stubFlask(page: Page, list: EntityListAnswer = LIST): Promise<string[]> {
  const asked: string[] = [];
  await page.route(`${FLASK_URL}/api/me/entities**`, (route) => {
    asked.push(new URL(route.request().url()).search);
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(list),
    });
  });
  await page.route(`${FLASK_URL}/api/me/profile**`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(VIEWER) }),
  );
  // The sidebar's My Profile carries the subscription feature's overview card, which reads the
  // billing API: answered here with a 404 (the card shows its failed-read state, which no test
  // here looks at), so a live billing API never sees the stub token - its 401 would send the
  // browser through Flask's re-handoff.
  await page.route(`${BILLING_API_URL}/api/me/subscriptions**`, (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: "not_found" }),
    }),
  );
  return asked;
}

test.describe("the entity list", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("the cards, each leading into its company, and search", async ({ page }) => {
    await stubFlask(page);
    await handoff(page, creds(), "/entities");

    const main = page.getByRole("main");
    await expect(page.getByRole("heading", { level: 1, name: "Select Company" })).toBeVisible();
    const cards = main.getByRole("list", { name: "Your companies" }).getByRole("link");
    await expect(cards).toHaveCount(LIST.entities.length);
    const five = main.getByRole("link", { name: /Scenario 5 - Free trial \+ Active/ });
    await expect(five).toHaveAttribute(
      "href",
      /\/entity\/e-scenario-5\/enter\?token=.+&next=%2Fentity%2Fe-scenario-5%2Fmodules$/,
    );
    await expect(five.getByRole("img", { name: "Free trial: Petty Cash" })).toBeVisible();
    await expect(main.getByText("Setup in progress")).toBeVisible();
    // the "+" is held to the screen's corner, outside `main`
    const add = page.getByRole("link", { name: "Add a new entity" });
    await expect(add).toHaveAttribute("href", `${FLASK_URL}/entity/create`);
    const viewport = page.viewportSize()!;
    const addBox = (await add.boundingBox())!;
    expect(viewport.width - (addBox.x + addBox.width)).toBeLessThan(64);
    expect(viewport.height - (addBox.y + addBox.height)).toBeLessThan(64);

    await main.getByRole("textbox", { name: "Search company" }).fill("both active");
    await expect(cards).toHaveCount(1);
    await main.getByRole("textbox", { name: "Search company" }).fill("no such company");
    await expect(main.getByText("No companies found.")).toBeVisible();
  });

  test("the whole screen: the bar across the top, the title in its middle, and Flask's column under it", async ({
    page,
  }) => {
    await stubFlask(page);
    await page.setViewportSize({ width: 1280, height: 560 }); // short enough for the rows to scroll
    await handoff(page, creds(), "/entities");

    const width = await page.evaluate(() => document.documentElement.clientWidth);
    const header = page.getByRole("banner");
    expect((await header.boundingBox())!.width).toBeGreaterThanOrEqual(width - 1);
    // the mark at the left, "Select Company" in the middle of the bar
    const mark = (await header.locator('img[src="/minty-mark.png"]').boundingBox())!;
    const title = (await header
      .getByRole("heading", { level: 1, name: "Select Company" })
      .boundingBox())!;
    expect(mark.x).toBeLessThan(40);
    expect(Math.abs(title.x + title.width / 2 - width / 2)).toBeLessThan(2);

    // Flask's column: 1024 px wide from 1200 (976 inside its 24 px padding), in the middle
    const main = page.getByRole("main");
    const column = (await main.boundingBox())!;
    expect(Math.round(column.width)).toBe(1024);
    expect(Math.abs(column.x - (width - (column.x + column.width)))).toBeLessThan(2);

    // Flask's spacing: the doors, 65 px, the search box, 24 px, the rows
    const doors = (await main.locator('img[src="/entities/select_company.webp"]').boundingBox())!;
    const search = main.getByRole("textbox", { name: "Search company" });
    const box = (await search.boundingBox())!;
    const rows = main.getByRole("list", { name: "Your companies" }).getByRole("listitem");
    const [first, second] = await Promise.all(
      [0, 1].map(async (i) => (await rows.nth(i).boundingBox())!),
    );
    expect(Math.round(box.y - (doors.y + doors.height))).toBe(65);
    expect(Math.round(first.y - (box.y + box.height))).toBe(24);
    expect(Math.round(first.width)).toBe(976);
    expect(Math.round(second.x)).toBe(Math.round(first.x));
    expect(second.y).toBeGreaterThan(first.y + first.height);

    // under the header the screen scrolls as one - its scrollbar is the screen's right edge - and
    // the header and the search box stay while the rows go under
    const scroller = main.locator("xpath=..");
    const area = (await scroller.boundingBox())!;
    expect(Math.round(area.width)).toBe(width);
    await scroller.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect
      .poll(async () => Math.round((await search.boundingBox())!.y))
      .toBe(Math.round(area.y + 8));
    await expect(search).toBeInViewport();
    await expect(header).toBeInViewport();

    // a phone: the whole width inside Flask's 24 px, and its taller doors box (76 px to the search)
    await page.setViewportSize({ width: 390, height: 844 });
    await scroller.evaluate((el) => el.scrollTo({ top: 0 }));
    await expect
      .poll(async () => Math.round((await rows.nth(0).boundingBox())!.width))
      .toBe(390 - 48);
    const phoneDoors = (await main
      .locator('img[src="/entities/select_company.webp"]')
      .boundingBox())!;
    expect(Math.round((await search.boundingBox())!.y - (phoneDoors.y + phoneDoors.height))).toBe(
      76,
    );
  });

  test("the header's initials open My Profile over the list; the menu has no Settings, the cat above Logout", async ({
    page,
  }) => {
    await stubFlask(page);
    await handoff(page, creds(), "/entities");

    // exact: every card's clock is named "... by Olive Vine" too
    const badge = page
      .getByRole("banner")
      .getByRole("button", { name: "Olive Vine, My Profile", exact: true });
    await expect(badge).toHaveAttribute("title", "Olive Vine");
    await badge.click();
    const profile = page.getByRole("region", { name: "My Profile" });
    await expect(profile.getByRole("heading", { level: 2, name: "Olive Vine" })).toBeVisible();
    await expect(page).toHaveURL(/\/entities$/); // over the list - nothing navigated
    await page.keyboard.press("Escape");
    await expect(profile).toBeHidden();

    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const menu = page.getByRole("navigation", { name: "Main navigation" });
    await expect(menu.getByRole("button", { name: "Olive Vine, My Profile" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Select Entity" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(menu.getByRole("link", { name: "Settings" })).toHaveCount(0);
    const cat = menu.locator('img[src*="sidepanel_cat"]');
    const logout = menu.getByRole("button", { name: "Logout" });
    const [catBox, logoutBox] = [await cat.boundingBox(), await logout.boundingBox()];
    expect(catBox && logoutBox && catBox.y + catBox.height <= logoutBox.y).toBeTruthy();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("what Flask flashed on the way here is said once, and the hand-over leaves the URL", async ({
    page,
  }) => {
    const asked = await stubFlask(page, {
      ...LIST,
      notices: [
        {
          category: "error",
          message: "Hmm, it looks like you don't have permission to look there.",
        },
      ],
    });
    await handoff(page, creds(), "/entities?flash=signed-hand-over");

    await expect(
      page.getByText("Hmm, it looks like you don't have permission to look there."),
    ).toBeVisible();
    expect(asked[0]).toBe("?flash=signed-hand-over");
    await expect(page).toHaveURL(/\/entities$/);
  });

  test("a token minted inside a company is traded for one that is not", async ({ page }) => {
    await stubFlask(page);
    const flaskAsked = await bounceFlaskHandoff(page, creds());
    await handoff(page, { ...creds(), entityId: "e1", entityName: "Olive Shop" }, "/entities");

    await expect(page.getByRole("list", { name: "Your companies" })).toBeVisible();
    expect(
      flaskAsked.some((q) => q.includes("next=%2Fentities") && !q.includes("entity_id=e1")),
    ).toBe(true);
    expect((await storedScope(page)).cookie).toBe("");
  });
});
