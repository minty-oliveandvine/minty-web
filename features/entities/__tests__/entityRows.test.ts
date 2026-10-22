// The select-company list's rules: the order, search as Flask searched, the clock in the viewer's own
// zone, the trial badge naming its modules, and where a card leads.

import { afterEach, describe, expect, it } from "vitest";

import { clearAuth, setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { HUB_PATHS } from "@/lib/hubPaths";

import { LIST, NEEDS_YOU } from "@/features/entities/__fixtures__/entities";
import type { EntityRow } from "@/features/entities/api/entities";
import {
  createEntityHref,
  enterHref,
  filterRows,
  groupRows,
  lastAccessedLabel,
  lastOpenedLabel,
  needsYou,
  roleLabel,
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
    expect(needsYou(onboarding)).toEqual({
      reason: "Setup not finished",
      action: "continue setup",
      tone: "warning",
    });
    expect(needsYou(cut)).toEqual({
      reason: "Xero is disconnected",
      action: "reconnect it in Settings",
      tone: "warning",
    });
    // a trial with no end on the read is not a reason
    expect(needsYou(five)).toBeNull();
    const groups = groupRows([five, cut, onboarding, six]);
    expect(groups.needsYou.map((r) => r.id)).toEqual(["e-scenario-6", "e-scenario"]);
    expect(groups.others.map((r) => r.id)).toEqual(["e-scenario-5", "e-scenario-6"]);
  });

  it("a failed payment comes first and is Danger; a trial ending within seven days next", () => {
    const today = new Date("2026-10-19T04:00:00Z");
    const [onboarding, five] = LIST.entities;
    const failed = { ...onboarding, payment_failed: true, trial_ends_on: "2026-10-20" };
    expect(needsYou(failed, today)).toEqual({
      reason: "Payment failed",
      action: "update the payment method",
      tone: "danger",
    });
    // a trial ending soon outranks setup, and says how many days are left
    const ending = (on: string) => needsYou({ ...onboarding, trial_ends_on: on }, today);
    expect(ending("2026-10-22")).toEqual({
      reason: "Trial ends in 3 days",
      action: "choose a plan",
      tone: "warning",
    });
    expect(ending("2026-10-20")?.reason).toBe("Trial ends in 1 day");
    expect(ending("2026-10-19")?.reason).toBe("Trial ends today");
    expect(ending("2026-10-26")?.reason).toBe("Trial ends in 7 days");
    // eight days out, or already past, is not a trial reason: setup is said instead
    expect(ending("2026-10-27")?.reason).toBe("Setup not finished");
    expect(ending("2026-10-18")?.reason).toBe("Setup not finished");
    expect(needsYou({ ...five, trial_ends_on: "2026-10-27" }, today)).toBeNull();
    expect(needsYou({ ...five, trial_ends_on: "not a date" }, today)).toBeNull();
  });

  it("an older Flask without the new fields still draws: missing is none", () => {
    const today = new Date("2026-10-19T04:00:00Z");
    const [onboarding, five] = LIST.entities;
    const old = ({ role, trial_ends_on, payment_failed, ...rest }: EntityRow): EntityRow => {
      void role;
      void trial_ends_on;
      void payment_failed;
      return rest;
    };
    expect(needsYou(old(five), today)).toBeNull();
    expect(needsYou(old(onboarding), today)?.reason).toBe("Setup not finished");
    expect(roleLabel(old(five).role)).toBeNull();
    const groups = groupRows([old(five), old(onboarding)], today);
    expect(groups.needsYou.map((r) => r.id)).toEqual(["e-scenario"]);
  });

  it("every reason in one list: Needs you runs most urgent first (a failed payment above a trial ending), last used within the same reason; a trial weeks away stays out", () => {
    const groups = groupRows(sortRows(NEEDS_YOU.entities));
    expect(groups.needsYou.map((r) => r.id)).toEqual([
      "e-payment-failed",
      "e-trial-soon",
      "e-scenario",
    ]);
    expect(groups.others.map((r) => r.id)).toContain("e-trial-later");
  });

  it("names the person's role as Flask does, and nothing for a role it does not know", () => {
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("entity_base")).toBe("Member");
    expect(roleLabel("shop_manager")).toBe("Shop Manager");
    expect(roleLabel("super_admin")).toBe("Super Admin");
    // Flask's word for a system superadmin who is not a member of the company
    expect(roleLabel("superadmin")).toBe("Super Admin");
    expect(roleLabel("cashier")).toBe("Cashier");
    expect(roleLabel("accountant")).toBe("Accountant");
    expect(roleLabel("owner")).toBeNull();
    expect(roleLabel(null)).toBeNull();
    expect(roleLabel(undefined)).toBeNull();
  });

  it("reads the last opening in the viewer's zone, as Flask's page did", () => {
    // built from local fields, so the expectation holds in whatever zone the suite runs
    expect(lastAccessedLabel(new Date(2026, 5, 9, 17, 42).toISOString())).toBe("9 Jun 5:42 PM");
    expect(lastAccessedLabel(new Date(2026, 0, 3, 0, 5).toISOString())).toBe("3 Jan 12:05 AM");
    expect(lastAccessedLabel(new Date(2026, 11, 31, 12, 0).toISOString())).toBe("31 Dec 12:00 PM");
    expect(lastAccessedLabel(null)).toBeNull();
    expect(lastAccessedLabel("not a date")).toBeNull();
    expect(lastOpenedLabel("9 Jun 5:42 PM", "Olive Vine")).toBe(
      "Last opened 9 Jun 5:42 PM by Olive Vine",
    );
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
