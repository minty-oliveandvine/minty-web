// Sign-in in a real browser over a STUBBED Flask (no credentials needed): log in by code at a
// phone's width, ending on Flask's hand-off with `next` carried; sign-up with the Terms read to
// the end in a real layout; an invitation's address fixed and its secret out of the address bar;
// Xero as a navigation; and no page wider than the screen at 360 / 768 / 1440.

import { expect, test, type Page } from "@playwright/test";

import { PETTY_CASH_URL, requireApp } from "../../../e2e/helpers";

type Asked = { path: string; body: unknown }[];

const LONG_TERMS = Array.from({ length: 60 }, (_, i) => `<p>Clause ${i + 1}. Words to read.</p>`).join("");

async function stubFlask(page: Page): Promise<Asked> {
  const asked: Asked = [];
  const answer = (path: string, body: unknown, status = 200) =>
    page.route(`${PETTY_CASH_URL}${path}**`, (route) => {
      const raw = route.request().postData();
      asked.push({ path, body: raw ? JSON.parse(raw) : null });
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    });
  await answer("/auth/email/request-code", { status: "success" });
  await answer("/auth/email/verify-code", {
    status: "success",
    redirect_url: `${PETTY_CASH_URL}/auth/email/handoff?h=signed`,
  });
  await answer("/auth/notices", { notices: [{ category: "info", message: "Please log in to access this page." }] });
  await answer("/legal/content/terms", { version: "beta-1", html: LONG_TERMS, effective_date: null, is_pinned: true });
  await answer("/legal/invite-terms-status", { terms_required: true });
  await page.route(`${PETTY_CASH_URL}/auth/email/handoff**`, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<p>Flask signs you in</p>" }),
  );
  return asked;
}

test.describe("sign-in", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("log in by code on a phone: Flask's message, the code, then Flask's hand-off with next", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    const asked = await stubFlask(page);
    await page.goto("/login?next=%2Fprofile&flash=signed");

    await expect(page.getByText("Please log in to access this page.")).toBeVisible();
    await page.getByLabel("Email").fill("jane@example.com");
    await page.getByLabel("Email").press("Enter");

    await expect(page).toHaveURL(/\/login\/confirm$/);
    await expect(page.getByText(/j\*\*\*@example\.com/)).toBeVisible();
    await page.getByLabel("Digit 1").click();
    await page.keyboard.insertText("123456");
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page).toHaveURL(`${PETTY_CASH_URL}/auth/email/handoff?h=signed`);
    expect(asked.find((a) => a.path === "/auth/email/request-code")?.body).toEqual({
      email: "jane@example.com",
      mode: "login",
    });
    expect(asked.find((a) => a.path === "/auth/email/verify-code")?.body).toMatchObject({
      email: "jane@example.com",
      code: "123456",
      next: "/profile",
    });
  });

  test("sign-up: the Terms open from the box and unlock only at the end of the document", async ({ page }) => {
    const asked = await stubFlask(page);
    await page.goto("/signup");

    await page.getByLabel("First name").fill("Jane");
    await page.getByLabel("Last name").fill("Doe");
    await page.getByLabel("Email").fill("jane@example.com");
    await page.getByRole("checkbox").click();

    const dialog = page.getByRole("dialog", { name: "Terms & Conditions" });
    await expect(dialog).toBeVisible();
    const agree = dialog.getByRole("checkbox");
    await expect(agree).toBeDisabled();
    await dialog.getByRole("region", { name: "The Terms & Conditions" }).evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(agree).toBeEnabled();
    await agree.check();
    await dialog.getByRole("button", { name: "Accept & Continue" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("checkbox")).toBeChecked();
    await page.getByRole("button", { name: "Continue with Email" }).click();
    await expect(page).toHaveURL(/\/login\/confirm$/);
    await page.getByLabel("Digit 1").click();
    await page.keyboard.insertText("123456");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/auth\/email\/handoff/);
    expect(asked.find((a) => a.path === "/auth/email/verify-code")?.body).toMatchObject({
      first_name: "Jane",
      last_name: "Doe",
      terms_accepted: true,
      terms_version: "beta-1",
    });
  });

  test("an invitation: the address is fixed, the secret leaves the address bar, Xero keeps it", async ({ page }) => {
    await stubFlask(page);
    await page.goto("/login?invite=secret-token&email=ivy%40example.com&fn=Ivy&ln=Lee");

    await expect(page.getByText("This invitation was sent to")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel("Email")).toHaveValue("ivy@example.com");
    await expect(page.getByLabel("Email")).toHaveAttribute("readonly", "");
    await expect(page.getByRole("link", { name: /Log in with Xero/ })).toHaveAttribute(
      "href",
      `${PETTY_CASH_URL}/xero_auth?invite=secret-token`,
    );
  });

  test("the old sign-up address redirects to /signup", async ({ page }) => {
    await stubFlask(page);
    await page.goto("/login?mode=signup&next=%2Fprofile");

    await expect(page).toHaveURL(/\/signup\?next=%2Fprofile$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Create your account");
  });

  for (const width of [360, 768, 1440]) {
    test(`nothing is wider than the screen at ${width}px`, async ({ page }) => {
      await stubFlask(page);
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/login", "/signup", "/login/confirm?email=a%40b.com"]) {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, path).toBeLessThanOrEqual(0);
      }
    });
  }
});
