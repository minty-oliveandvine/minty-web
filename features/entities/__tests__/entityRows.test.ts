// The select-company list's rules: search as Flask searched, the clock in the viewer's own
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
  lastAccessedLabel,
  lastOpenedLabel,
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

  it("a card leads into its company through Minty's re-entry; + leads to a new one", () => {
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    expect(enterHref(LIST.entities[1])).toBe(
      `${env.MINTY_URL}/entity/e-scenario-5/enter?token=h.eyJ1c2VyX2lkIjoidTEifQ.s` +
        `&next=${encodeURIComponent("/entity/e-scenario-5/modules")}`,
    );
    expect(createEntityHref()).toBe(`${env.MINTY_URL}/entity/create`);
  });
});
