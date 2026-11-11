// The Minty cat at a phone's width, over a STUBBED Flask: tucked to a tab on the edge at first
// (owner, 2026-11-11), the tab bringing it back with its pop-up open, "Talk to Minty", and the
// scripted chat ending in Flask's `POST /api/me/contact`. Flask's side is Minty's tests/test_hub_contact.py.
import { expect, test, type Page } from "@playwright/test";

import { LIST } from "../features/entities/__fixtures__/entities";
import {
  ACCOUNTS_API_URL,
  SUBSCRIPTION_API_URL,
  credentials,
  handoff,
  requireApp,
} from "./helpers";

const STUB = {
  secret: "stub-flask-never-sees-this",
  userId: "u-e2e",
  entityId: "",
  entityName: "",
};
const creds = () => ({ ...(credentials() ?? STUB), entityId: "", entityName: "" });
const VIEWER = { user: { id: "u-e2e", name: "Olive Vine", initials: "OV" }, entity: null };

async function stubFlask(page: Page) {
  const sent: unknown[] = [];
  const json = (body: unknown, status = 200) => ({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
  await page.route(`${ACCOUNTS_API_URL}/api/me/entities**`, (route) => route.fulfill(json(LIST)));
  await page.route(`${ACCOUNTS_API_URL}/api/me/profile**`, (route) => route.fulfill(json(VIEWER)));
  await page.route(`${SUBSCRIPTION_API_URL}/api/me/subscriptions**`, (route) =>
    route.fulfill(json({ error: "not_found" }, 404)),
  );
  await page.route(`${ACCOUNTS_API_URL}/api/me/contact`, (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204 });
    sent.push(route.request().postDataJSON());
    return route.fulfill(json({ sent: true, reply_to: "o@x.com" }));
  });
  return sent;
}

test.describe("the Minty cat", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("at 360px: the tab, the pop-up, and a message sent through the chat", async ({ page }) => {
    const sent = await stubFlask(page);
    await page.setViewportSize({ width: 360, height: 760 });
    await handoff(page, creds(), "/entities");

    // tucked by default: only the tab on the right edge
    const tab = page.getByRole("button", { name: "Bring Minty back" });
    await expect(tab).toBeVisible();
    await expect(page.getByRole("button", { name: "Talk to Minty" })).toHaveCount(0);
    const box = (await tab.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(360 - (box.x + box.width)).toBeLessThan(1);

    // the tab brings the cat back with its pop-up open; the entity list adds no line to it
    await tab.click();
    const cat = page.getByRole("button", { name: "Talk to Minty" });
    await expect(cat).toBeVisible();
    await expect(page.getByRole("menu", { name: "Minty" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Create company" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Talk to Minty" }).click();

    const chat = page.getByRole("dialog", { name: "Talk to Minty" });
    await expect(chat.getByText("Hi Olive! What can I help you with?")).toBeVisible();
    // a phone gets the whole screen, with nothing scrolling sideways
    // measured once the window has finished rising out of the cat
    await expect.poll(async () => (await chat.boundingBox())!.width).toBe(360);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );

    await chat.getByRole("button", { name: "Contact Support" }).click();
    // one question at a time; the name is a one-tap answer (the viewer's)
    await chat.getByRole("button", { name: "Olive Vine" }).click();
    const email = chat.getByLabel("Your email");
    await email.fill("o@");
    await email.blur();
    await expect(chat.getByText(/This email looks unfinished/)).toBeVisible();
    await email.fill("o@x.com");
    await chat.getByRole("button", { name: "Send answer" }).click();
    await chat.getByLabel("Your company").fill("Olive Tree Cafe");
    await chat.getByRole("button", { name: "Send answer" }).click();
    await chat.getByRole("button", { name: "Technical issue" }).click();
    await chat.getByLabel("Your message").fill("The report won't open.");
    await chat.getByRole("button", { name: "Send answer" }).click();
    // the review: change the company before it goes
    await chat.getByRole("button", { name: "Edit company" }).click();
    await chat.getByLabel("Your company").fill("Olive & Vine");
    await chat.getByRole("button", { name: "Save answer" }).click();
    await chat.getByRole("button", { name: "Send", exact: true }).click();
    await expect(chat.getByText(/Sent! We'll reply to o@x.com/)).toBeVisible();
    expect(sent).toEqual([
      {
        name: "Olive Vine",
        email: "o@x.com",
        company: "Olive & Vine",
        topic: "Technical issue",
        message: "The report won't open.",
        app: "minty-web",
      },
    ]);

    await page.keyboard.press("Escape");
    await expect(chat).toHaveCount(0);
    await expect(cat).toBeFocused();
  });
});
