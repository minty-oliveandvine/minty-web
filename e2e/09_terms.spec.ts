// The Terms & Conditions gate in a browser, over a STUBBED Flask: `GET /api/me/terms` owes a long
// document and `POST /api/me/terms/accept` records it. What this proves is the gate in the real
// app - Flask's panel over the entity list, the page behind out of reach, the tick box locked
// until the document is scrolled to its end in a real layout, Accept lifting it where the person
// stands, a 409 reading the Terms again, Cancel logging out, and a phone's single column - not
// Flask (Minty's tests/test_hub_terms.py covers that side). Nothing here is ever sent to a real
// Flask: the shared e2e account owes an acceptance nobody may give on it.
import { expect, test, type Page } from "@playwright/test";

import { answerTerms, BASE_URL, credentials, PETTY_CASH_URL, handoff, requireApp } from "./helpers";

const STUB_CREDS = {
  secret: "stub-flask-never-sees-this",
  userId: "u-e2e",
  entityId: "",
  entityName: "",
};
const creds = () => ({ ...(credentials() ?? STUB_CREDS), entityId: "", entityName: "" });

// Long enough to scroll inside its box at any window size.
const LONG = Array.from(
  { length: 40 },
  (_, i) => `<h2>${i + 1}. Clause</h2><p>${"Olive &amp; Vine runs Minty. ".repeat(12)}</p>`,
).join("");

const OWED = {
  owed: true,
  document: {
    version: "beta-1",
    effective_date: "18 September 2026",
    html: LONG,
    show_draft_notice: true,
  },
  is_update: false,
  previous_version: null,
  links: { terms: "/legal/terms", privacy: "/legal/privacy", previous: null },
};

const COMPANY = {
  id: "e-olive",
  name: "Olive Shop Limited",
  status: "active",
  modules: ["PETTY_CASH"],
  trial_modules: [],
  trial_module_names: [],
  last_accessed_at: null,
  last_accessed_by: null,
};

/** The list and the viewer behind the gate; returns every acceptance posted. */
async function stubFlask(page: Page, acceptStatus = 200): Promise<unknown[]> {
  const posted: unknown[] = [];
  await page.route(`${PETTY_CASH_URL}/api/me/entities**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entities: [COMPANY], notices: [] }),
    }),
  );
  await page.route(`${PETTY_CASH_URL}/api/me/profile**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "u-e2e",
          first_name: "Olive",
          last_name: "Vine",
          name: "Olive Vine",
          initials: "OV",
          email: "o@x.com",
        },
        entity: null,
      }),
    }),
  );
  await page.route(`${PETTY_CASH_URL}/api/me/terms/accept`, (route) => {
    posted.push(route.request().postDataJSON());
    const body =
      acceptStatus === 409
        ? { error: "version_changed", terms_version: "beta-2" }
        : { ok: true, terms_version: "beta-1" };
    return route.fulfill({
      status: acceptStatus,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return posted;
}

async function arrive(page: Page) {
  await handoff(page, creds(), "/entities", {}, { terms: OWED });
  const dialog = page.getByRole("dialog", { name: "Terms & Conditions" });
  await expect(dialog).toBeVisible();
  return dialog;
}

const readToTheEnd = (page: Page) =>
  page
    .getByRole("region", { name: "The Terms & Conditions" })
    .evaluate((el) => el.scrollTo({ top: el.scrollHeight }));

test.describe("the Terms gate", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("owed: Flask's panel over the list, locked until read, and Accept lifts it where you stand", async ({
    page,
  }) => {
    const posted = await stubFlask(page);
    const dialog = await arrive(page);

    await expect(dialog.getByText(/This wording is not final/)).toBeVisible();
    await expect(dialog.getByText("Last updated: 18 September 2026")).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Terms & Conditions" })).toHaveAttribute(
      "href",
      `${PETTY_CASH_URL}/legal/terms`,
    );
    // the list is behind it, out of reach: hidden from the accessibility tree, and inert
    await expect(page.getByRole("list", { name: "Your companies" })).toHaveCount(0);
    await expect(page.locator("[inert]").getByText("Olive Shop Limited")).toBeAttached();

    const box = dialog.getByRole("checkbox");
    const accept = dialog.getByRole("button", { name: "Accept & Continue" });
    await expect(box).toBeDisabled();
    await expect(accept).toBeDisabled();
    // Flask's look, from the CSS module: the grey of a locked Accept
    await expect(accept).toHaveCSS("background-color", "rgb(209, 213, 219)");

    // not dismissible
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    await readToTheEnd(page);
    await expect(box).toBeEnabled();
    await box.check();
    await expect(accept).toBeEnabled();
    await expect(accept).toHaveCSS("background-color", "rgb(54, 195, 180)");
    await accept.click();

    await expect(dialog).toBeHidden();
    expect(posted).toEqual([{ accepted: true, terms_version: "beta-1" }]);
    await expect(page).toHaveURL(/\/entities$/);
    await expect(page.getByRole("list", { name: "Your companies" }).getByRole("link")).toHaveCount(
      1,
    );
  });

  test("409 - the Terms changed while it sat open: the new version is read, and asked again", async ({
    page,
  }) => {
    const posted = await stubFlask(page, 409);
    const dialog = await arrive(page);
    // what Flask says once the new version is live
    await answerTerms(page, {
      ...OWED,
      document: { ...OWED.document, version: "beta-2", html: `<p>The new wording.</p>${LONG}` },
    });

    await readToTheEnd(page);
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Accept & Continue" }).click();

    await expect(dialog.getByText("The new wording.")).toBeVisible();
    await expect(dialog.getByRole("checkbox")).not.toBeChecked();
    await expect(dialog.getByRole("checkbox")).toBeDisabled(); // a new reading: locked again
    expect(posted).toEqual([{ accepted: true, terms_version: "beta-1" }]);
  });

  test("Cancel logs out at Minty - someone who will not agree has nowhere else to go", async ({
    page,
  }) => {
    await stubFlask(page);
    await page.route(`${PETTY_CASH_URL}/logout`, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<title>logged out</title>" }),
    );
    const dialog = await arrive(page);

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await page.waitForURL(`${PETTY_CASH_URL}/logout`);
    const jar = await page.context().cookies(BASE_URL);
    expect(jar.find((c) => c.name === "minty_token")?.value ?? "").toBe("");
  });

  test("a phone: one column, the illustration left out, the agreement within reach", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubFlask(page);
    const dialog = await arrive(page);

    await expect(dialog.locator('img[src*="minty_important_update"]')).toBeHidden();
    await readToTheEnd(page);
    await dialog.getByRole("checkbox").check();
    const accept = dialog.getByRole("button", { name: "Accept & Continue" });
    await accept.scrollIntoViewIfNeeded();
    await expect(accept).toBeInViewport();
    const box = (await dialog.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(390);
  });
});
