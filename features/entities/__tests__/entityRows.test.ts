// The select-company list's rules: the order, search as Flask searched, the clock in the viewer's own
// zone, the trial badge naming its modules, and where a card leads.

import { afterEach, describe, expect, it } from "vitest";

import { clearAuth, setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { HUB_PATHS } from "@/lib/hubPaths";

import { LIST } from "@/features/entities/__fixtures__/entities";
import {
  createEntityHref,
  enterHref,
  filterRows,
  groupRows,
  lastAccessedLabel,
  lastOpenedLabel,
  needsYou,
  sortRows,
  trialLabel,
} from "@/features/entities/lib/entityRows";
import { ENTITIES_BASE_PATH } from "@/features/entities/lib/paths";

describe("entityRows", () => {
  afterEach(() => clearAuth());

  it("mounts where the shell says it does", () => {
    expect(ENTITIES_BASE_PATH).toBe(HUB_PATHS.entities);
  });

  it("searches case-insensitively, anywhere in the name, and ignores surrounding spaces", () => {
    const names = (q: string) => filterRows(LIST.entities, q).map((r) => r.name);
    expect(names("")).toHaveLength(LIST.entities.length);
    expect(names("  SCENARIO 8 ")).toEqual(["Digitalisation - Scenario 8 - Both Active"]);
    expect(names("trial")).toEqual([
      "Digitalisation - Scenario 5 - Free trial + Active",
      "Digitalisation - Scenario 6 - Expired + Free trial",
      "Digitalisation - Scenario 2: 1 Trial + Not started",
    ]);
    expect(names("nothing like it")).toEqual([]);
  });

  it("puts the last used first, then the never-opened A→Z ignoring case, input untouched", () => {
    const before = LIST.entities.map((r) => r.id);
    const at = (iso: string) => ({ last_accessed_at: iso });
    const rows = [
      { ...LIST.entities[3], ...at("2026-10-01T09:00:00Z") }, // e-scenario-10
      { ...LIST.entities[6], ...at("2026-10-18T09:00:00Z") }, // e-scenario-8
      { ...LIST.entities[0] }, // e-scenario, never opened
      { ...LIST.entities[1], ...at("2026-10-10T09:00:00Z") }, // e-scenario-5
      { ...LIST.entities[4], last_accessed_at: null }, // e-scenario-2, never opened
      { ...LIST.entities[5], last_accessed_at: "not a date" }, // e-scenario-9, unreadable
    ];
    expect(sortRows(rows).map((r) => r.id)).toEqual([
      "e-scenario-8",
      "e-scenario-5",
      "e-scenario-10",
      // nobody opened these: A→Z, "Digitalisation - Scenario 2" and "… 9" before "Scenario"
      "e-scenario-2",
      "e-scenario-9",
      "e-scenario",
    ]);
    expect(LIST.entities.map((r) => r.id)).toEqual(before);
  });

  it("says why a company needs the person, and lifts those out, each group keeping its order", () => {
    const [onboarding, five, six] = LIST.entities;
    const cut = { ...six, status: "disconnected" as const };
    expect(needsYou(onboarding)).toEqual({ reason: "Setup not finished", action: "continue setup" });
    expect(needsYou(cut)).toEqual({ reason: "Xero is disconnected", action: "reconnect it in Settings" });
    // a trial is not a reason: the list carries no trial end to act on
    expect(needsYou(five)).toBeNull();
    const groups = groupRows([five, cut, onboarding, six]);
    expect(groups.needsYou.map((r) => r.id)).toEqual(["e-scenario-6", "e-scenario"]);
    expect(groups.others.map((r) => r.id)).toEqual(["e-scenario-5", "e-scenario-6"]);
  });

  it("reads the last opening in the viewer's zone, as Flask's page did", () => {
    // built from local fields, so the expectation holds in whatever zone the suite runs
    expect(lastAccessedLabel(new Date(2026, 5, 9, 17, 42).toISOString())).toBe("9 Jun 5:42 PM");
    expect(lastAccessedLabel(new Date(2026, 0, 3, 0, 5).toISOString())).toBe("3 Jan 12:05 AM");
    expect(lastAccessedLabel(new Date(2026, 11, 31, 12, 0).toISOString())).toBe("31 Dec 12:00 PM");
    expect(lastAccessedLabel(null)).toBeNull();
    expect(lastAccessedLabel("not a date")).toBeNull();
    expect(lastOpenedLabel("9 Jun 5:42 PM", "Olive Vine")).toBe("Last opened 9 Jun 5:42 PM by Olive Vine");
    expect(lastOpenedLabel("9 Jun 5:42 PM", null)).toBe("Last opened 9 Jun 5:42 PM");
  });

  it("the trial badge says which modules it is about, and is absent without a trial", () => {
    const [, five, , ten, two] = LIST.entities;
    expect(trialLabel(five)).toBe("Free trial: Petty Cash");
    expect(trialLabel(two)).toBe("Free trial: Payment Request, Petty Cash");
    expect(trialLabel(ten)).toBeNull();
  });

  it("a card leads into its company through Minty's re-entry; Create a business to a new one", () => {
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    expect(enterHref(LIST.entities[1])).toBe(
      `${env.PETTY_CASH_URL}/entity/e-scenario-5/enter?token=h.eyJ1c2VyX2lkIjoidTEifQ.s` +
        `&next=${encodeURIComponent("/entity/e-scenario-5/modules")}`,
    );
    expect(createEntityHref()).toBe(`${env.PETTY_CASH_URL}/entity/create`);
  });
});
