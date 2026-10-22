// Into minty-petty-cash-web (Step 5, 2026-10-19): through Minty's /enter, which rebuilds the
// Flask session from this app's token, on to Flask's /handoff/petty-cash-web, which mints the
// Petty Cash app's token for THIS company - the same road as Bills' /entity/<id>/payment-request.

import { beforeEach, describe, expect, it } from "vitest";

import { clearAuth, setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { pettyCashWebUrl } from "@/lib/mintyEntry";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const ID = "360812e1-9f94-46a3-aa31-347e21afde8e";

/** The `/handoff/petty-cash-web` address `/enter` is told to go on to. */
function handoff(href: string): URL {
  const enter = new URL(href);
  expect(`${enter.origin}${enter.pathname}`).toBe(`${env.PETTY_CASH_URL}/entity/${ID}/enter`);
  expect(enter.searchParams.get("token")).toBe(TOKEN);
  const next = enter.searchParams.get("next");
  expect(next).toMatch(/^\/handoff\/petty-cash-web\?/);
  return new URL(next!, "https://flask.test");
}

describe("pettyCashWebUrl", () => {
  beforeEach(() => setAuth(TOKEN, ID, "Olive & Vine"));

  it("enters Minty and goes on to the Petty Cash app's hand-off for this company", () => {
    const target = handoff(pettyCashWebUrl(ID));
    expect(target.searchParams.get("entity_id")).toBe(ID);
    // no page: Flask's default, the company's dashboard on the Petty Cash app
    expect(target.searchParams.has("next")).toBe(false);
  });

  it("names a page on the Petty Cash app as the hand-off's next", () => {
    const target = handoff(pettyCashWebUrl(ID, "/entity/360812e1/olive-and-vine/petty-cash/reports"));
    expect(target.searchParams.get("next")).toBe("/entity/360812e1/olive-and-vine/petty-cash/reports");
  });

  it("names this page's origin, so Flask can hand back into a preview set", () => {
    expect(handoff(pettyCashWebUrl(ID)).searchParams.get("return_origin")).toBe(window.location.origin);
  });

  it("falls back to the entity list with no token", () => {
    clearAuth();
    expect(pettyCashWebUrl(ID)).toBe("/entities");
  });
});

describe("pettyCashWebUrl's exact spelling", () => {
  // Pins pettyCashWebUrl before it moves to @minty/shared (the shared-code refactor, 2026-10-21)
  beforeEach(() => setAuth(TOKEN, ID, "Olive & Vine"));

  it("orders entity_id, next, return_origin inside the encoded next", () => {
    const inner = `/handoff/petty-cash-web?entity_id=${ID}&next=%2Fp&return_origin=${encodeURIComponent(window.location.origin)}`;
    expect(pettyCashWebUrl(ID, "/p")).toBe(
      `${env.PETTY_CASH_URL}/entity/${ID}/enter?token=${encodeURIComponent(TOKEN)}&next=${encodeURIComponent(inner)}`,
    );
  });

  it("an empty next is no next", () => {
    expect(handoff(pettyCashWebUrl(ID, "")).searchParams.has("next")).toBe(false);
  });

  it("an empty company id falls back to the cookie's company in /enter, with entity_id= empty", () => {
    const enter = new URL(pettyCashWebUrl(""));
    expect(enter.pathname).toBe(`/entity/${ID}/enter`);
    expect(new URL(enter.searchParams.get("next")!, "https://flask.test").searchParams.get("entity_id")).toBe("");
  });
});
