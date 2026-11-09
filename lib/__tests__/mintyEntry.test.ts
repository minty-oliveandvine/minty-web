// Into minty-petty-cash-web (Step 5, 2026-10-19): through Minty's /enter, on the accounts-api
// session (gap 4, 2026-11-09: never this app's token in the address), on to accounts-api's
// /handoff/petty-cash-web, which hands the Petty Cash app over for THIS company - the same road
// as Bills' /entity/<id>/payment-request.

import { beforeEach, describe, expect, it } from "vitest";

import { clearAuth, setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { pettyCashWebUrl } from "@/lib/mintyEntry";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const ID = "360812e1-9f94-46a3-aa31-347e21afde8e";

/** The `/handoff/petty-cash-web` address `/enter` is told to go on to. */
function handoff(href: string): URL {
  const enter = new URL(href);
  expect(`${enter.origin}${enter.pathname}`).toBe(`${env.ACCOUNTS_API_URL}/entity/${ID}/enter`);
  expect(enter.searchParams.has("token")).toBe(false);
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
    const target = handoff(
      pettyCashWebUrl(ID, "/entity/360812e1/olive-and-vine/petty-cash/reports"),
    );
    expect(target.searchParams.get("next")).toBe(
      "/entity/360812e1/olive-and-vine/petty-cash/reports",
    );
  });

  it("names this page's origin, so Flask can hand back into a preview set", () => {
    expect(handoff(pettyCashWebUrl(ID)).searchParams.get("return_origin")).toBe(
      window.location.origin,
    );
  });

  it("needs no token: the accounts-api session carries the way back", () => {
    clearAuth();
    expect(handoff(pettyCashWebUrl(ID)).searchParams.get("entity_id")).toBe(ID);
  });
});
