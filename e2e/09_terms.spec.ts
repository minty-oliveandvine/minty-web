// The Terms & Conditions gate in a browser, over a STUBBED Flask: `GET /api/me/terms` owes the
// live version and `POST /api/me/terms/accept` records it. What this proves is the gate in the
// real app - the panel over the entity list, the page behind out of reach, the tick box locked
// until the document is scrolled to its end in a real layout, Accept lifting it where the person
// stands, a 409 reading the Terms again, Cancel logging out, and a phone's single column - not
// Flask (Minty's tests/test_hub_terms.py covers that side). Nothing here is ever sent to a real
// Flask: the shared e2e account owes an acceptance nobody may give on it.
//
// The DOCUMENT is not stubbed: since 2026-10-12 it is this app's own, served by
// app/api/legal/[kind]/[version] out of lib/legal/documents/, so the panel shows the real Terms -
// 23 sections, long enough to scroll at any size - and the hash posted back is the real
// fingerprint. The stub reads it from the app first, so the two always agree, which is the
// condition the gate checks before it draws anything.
import { expect, test, type Page } from "@playwright/test";

import {
  answerTerms,
  BASE_URL,
  credentials,
  PETTY_CASH_URL,
  handoff,
  mintModuleToken,
  reachable,
  requireApp,
} from "./helpers";

const STUB_CREDS = {
  secret: "stub-flask-never-sees-this",
  userId: "u-e2e",
  entityId: "",
  entityName: "",
};
const creds = () => ({ ...(credentials() ?? STUB_CREDS), entityId: "", entityName: "" });

type LiveTerms = {
  version: string;
  html: string;
  sha256: string;
  effective_date: string | null;
  show_draft_notice: boolean;
};

/** The live document, as this app serves it - the panel's text and the hash Flask would record. */
async function liveTerms(page: Page): Promise<LiveTerms> {
  const answer = await page.request.get(`${BASE_URL}/api/legal/terms/current`);
  expect(answer.ok()).toBeTruthy();
  return (await answer.json()) as LiveTerms;
}

/** What Flask answers: the version owed and its fingerprint. No wording - that is ours. */
const owedAnswer = (doc: LiveTerms, version = doc.version) => ({
  owed: true,
  document: {
    version,
    effective_date: doc.effective_date,
    sha256: doc.sha256,
    show_draft_notice: doc.show_draft_notice,
  },
  is_update: false,
  previous_version: null,
});

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
  const doc = await liveTerms(page);
  await handoff(page, creds(), "/entities", {}, { terms: owedAnswer(doc) });
  const dialog = page.getByRole("dialog", { name: "Terms & Conditions" });
  await expect(dialog).toBeVisible();
  return { dialog, doc };
}

const readToTheEnd = (page: Page) =>
  page
    .getByRole("region", { name: "The Terms & Conditions" })
    .evaluate((el) => el.scrollTo({ top: el.scrollHeight }));

test.describe("the Terms gate", () => {
  test.beforeEach(async () => {
    await requireApp();
  });

  test("owed: the panel over the list, locked until read, and Accept lifts it where you stand", async ({
    page,
  }) => {
    const posted = await stubFlask(page);
    const { dialog, doc } = await arrive(page);

    // the real document, out of this app's own registry
    await expect(dialog.getByRole("region", { name: "The Terms & Conditions" })).toContainText(
      "hello@dailyminty.com",
    );
    // Case-exact: the real document carries its own "Last Updated:" line, so a loose match finds
    // two - the panel's date line and the Terms' own header.
    await expect(
      dialog.getByText("Last updated: 18 September 2026", { exact: true }),
    ).toBeVisible();
    // and its links are this app's pages - the address stays on the hub, never Flask
    await expect(dialog.getByRole("link", { name: "Terms & Conditions" })).toHaveAttribute(
      "href",
      "/terms",
    );
    await expect(dialog.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    // the list is behind it, out of reach: hidden from the accessibility tree, and inert
    await expect(page.getByRole("list", { name: "Your businesses" })).toHaveCount(0);
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
    // the fingerprint of what was actually on screen rides with the agreement
    expect(posted).toEqual([
      { accepted: true, terms_version: doc.version, document_hash: doc.sha256 },
    ]);
    await expect(page).toHaveURL(/\/entities$/);
    await expect(page.getByRole("list", { name: "Your businesses" }).getByRole("link")).toHaveCount(
      1,
    );
  });

  test("409 - the Terms changed while it sat open: the new version is read, and asked again", async ({
    page,
  }) => {
    const posted = await stubFlask(page, 409);
    const { dialog, doc } = await arrive(page);
    // What Flask says once the new version is live - AND the document this app would serve for
    // it, because no beta-2 exists yet. Both halves are needed: the gate refuses to draw a panel
    // for a version it cannot read, which is the whole point of the two-read check.
    await page.route(`${BASE_URL}/api/legal/terms/beta-2`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...doc,
          kind: "terms",
          version: "beta-2",
          html: `<p>The new wording.</p>${doc.html}`,
          is_pinned: true,
          is_current: true,
        }),
      }),
    );
    await answerTerms(page, owedAnswer(doc, "beta-2"));

    await readToTheEnd(page);
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Accept & Continue" }).click();

    await expect(dialog.getByText("The new wording.")).toBeVisible();
    await expect(dialog.getByRole("checkbox")).not.toBeChecked();
    await expect(dialog.getByRole("checkbox")).toBeDisabled(); // a new reading: locked again
    expect(posted).toEqual([
      { accepted: true, terms_version: doc.version, document_hash: doc.sha256 },
    ]);
  });

  test("Cancel logs out at Minty - someone who will not agree has nowhere else to go", async ({
    page,
  }) => {
    await stubFlask(page);
    await page.route(`${PETTY_CASH_URL}/logout`, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<title>logged out</title>" }),
    );
    const { dialog } = await arrive(page);

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
    const { dialog } = await arrive(page);

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

// --------------------------------------------------------------------------------------------
// THE CROSS-REPO GATE
//
// `MANIFEST` in Minty's legal/registry.py and `PINNED_HASHES` in lib/legal/registry.server.ts
// are the same table held in two repos, and nothing local can compare them: this app has no
// copy of Minty's, and Minty has no copy of the documents. Two RUNNING services can be
// compared, so this is the only real guard against the two drifting apart - make it a required
// check in the stack job.
//
// If it fails: someone edited a published `.md` here, or repinned a hash in one repo and not
// the other. The symptom in production is the Terms gate quietly refusing to draw its panel
// (it fails open and logs) - nobody is locked out, and nobody can agree either.
// --------------------------------------------------------------------------------------------
test.describe("the two repos agree about the Terms", () => {
  test("Minty names the version this app holds, under the same fingerprint", async ({
    request,
  }) => {
    await requireApp();
    test.skip(
      !(await reachable(`${PETTY_CASH_URL}/health`)),
      `Minty (Flask) is not answering at ${PETTY_CASH_URL}`,
    );

    // Minty names the live version (and nothing else: the wording is ours).
    const live = await request.get(`${PETTY_CASH_URL}/legal/current`);
    expect(live.ok()).toBeTruthy();
    const { terms_version: version } = (await live.json()) as { terms_version: string };
    expect(version, "Minty must name a live Terms version").toBeTruthy();

    // This app must hold that exact version...
    const held = await request.get(`${BASE_URL}/api/legal/terms/${version}`);
    expect(
      held.status(),
      `Minty names Terms ${version}, which this app does not hold - the two are deployed out of step`,
    ).toBe(200);
    const document = (await held.json()) as { version: string; sha256: string };
    expect(document.version).toBe(version);

    // ...and `current` must resolve to the same thing, or `/terms` shows one version while the
    // gate asks for another.
    const current = await request.get(`${BASE_URL}/api/legal/terms/current`);
    expect(current.ok()).toBeTruthy();
    expect((await current.json()).version).toBe(version);

    // The fingerprint Minty would RECORD must be the fingerprint of what this app would SHOW.
    // Asked through the bearer route, which is where that number reaches a browser.
    const creds = credentials();
    test.skip(
      creds === null,
      "no E2E_JWT_SECRET: the fingerprint half needs a token Minty will accept",
    );
    const owed = await request.get(`${PETTY_CASH_URL}/api/me/terms`, {
      headers: { Authorization: `Bearer ${mintModuleToken(creds!, { entity_id: null })}` },
    });
    expect(owed.ok()).toBeTruthy();
    const answer = (await owed.json()) as
      { owed: false } | { owed: true; document: { version: string; sha256: string } };
    if (answer.owed) {
      expect(answer.document.version).toBe(version);
      expect(
        answer.document.sha256,
        "Minty would record a different fingerprint than this app shows",
      ).toBe(document.sha256);
    } else {
      // This account has already agreed, so Minty says nothing is owed and sends no hash. The
      // version halves above still ran, which is the part a drifting `.md` breaks.
      expect(answer.owed).toBe(false);
    }
  });
});
