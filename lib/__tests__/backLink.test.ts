// "Back" goes to the page the person came from (lib/backLink.ts): past this app's settings-type
// entries, out to another app when they came from one, and to the fallback in a fresh tab.

import { describe, expect, it } from "vitest";

import { inSettingsArea, stepsBack } from "@/lib/backLink";

const ORIGIN = "https://hub.minty.test";
const MODULES = `${ORIGIN}/entity/e1/olive-shop/settings/modules`;
const USERS = `${ORIGIN}/entity/e1/olive-shop/settings/users`;

/** A tab's history as the Navigation API reports it: only THIS origin's run of entries, each
 * `index` its place in that run (not in the whole tab), the current one last. */
function nav(urls: string[]) {
  const entries = urls.map((url, index) => ({ index, url }));
  return { currentEntry: entries[entries.length - 1] ?? null, entries: () => entries };
}

describe("inSettingsArea", () => {
  it("knows a company's settings tabs, and nothing else", () => {
    expect(inSettingsArea(MODULES, ORIGIN)).toBe(true);
    expect(inSettingsArea(`${USERS}?fixture=a`, ORIGIN)).toBe(true);
    // My Profile is the sidebar's sheet, not a page (no /profile since 2026-11-03)
    expect(inSettingsArea(`${ORIGIN}/profile`, ORIGIN)).toBe(false);
    expect(inSettingsArea(`${ORIGIN}/entities`, ORIGIN)).toBe(false);
    expect(inSettingsArea(`${ORIGIN}/subscription`, ORIGIN)).toBe(false);
    expect(
      inSettingsArea("https://elsewhere.test/entity/e1/olive-shop/settings/users", ORIGIN),
    ).toBe(false);
    expect(inSettingsArea(null, ORIGIN)).toBe(false);
  });
});

describe("stepsBack", () => {
  it("goes back to the last page outside the area, past reloads of this one", () => {
    // /entities -> modules -> users -> modules (now), all in this tab
    const n = nav([`${ORIGIN}/entities`, MODULES, USERS, MODULES]);
    expect(stepsBack(n, ORIGIN, 4)).toBe(3);
  });

  it("leaves the app when the person came from another one", () => {
    // [Flask, Payments] -> modules -> users (now): the tab holds 4 entries, this run 2
    const n = nav([MODULES, USERS]);
    expect(stepsBack(n, ORIGIN, 4)).toBe(2);
  });

  it("answers 0 when the tab started here (the fallback is followed)", () => {
    expect(stepsBack(nav([MODULES]), ORIGIN, 1)).toBe(0);
    expect(stepsBack(nav([MODULES, USERS]), ORIGIN, 2)).toBe(0);
  });

  it("is unknown without the Navigation API", () => {
    expect(stepsBack(undefined, ORIGIN, 3)).toBeNull();
  });
});
