// The API's rows -> what the list shows: every module state's cell, the two sections, the three
// menu shapes (section 04·M's rule), the design's orders and the search.

import { describe, expect, it } from "vitest";

import { ENTITIES } from "@/features/subscription/__fixtures__/subscriptions";
import { TODAY } from "@/features/subscription/__fixtures__/modulePage";
import type { PortalEntity } from "@/features/subscription/api/payerPortal";
import {
  matches,
  menuFor,
  moduleCell,
  nextSort,
  rowSection,
  sortEntities,
  toRow,
} from "@/features/subscription/lib/portalRows";

const byName = (name: string): PortalEntity => {
  const e = ENTITIES.find((x) => x.entity_name === name);
  if (!e) throw new Error(name);
  return e;
};

describe("moduleCell", () => {
  it("says what the design's cells say", () => {
    const kestrel = byName("Kestrel Foods Limited");
    expect(moduleCell(kestrel.modules[0], TODAY)).toMatchObject({
      kind: "start_trial",
      text: "Start Trial",
    });
    expect(moduleCell(kestrel.modules[1], TODAY)).toMatchObject({
      kind: "trial",
      eyebrow: "Trial",
      text: "3 days remaining",
      daysRemaining: 3,
    });
    expect(moduleCell(byName("Mino Market Limited").modules[1], TODAY)).toMatchObject({
      kind: "subscribe",
      eyebrow: "Trial Expired",
      text: "Subscribe",
    });
    expect(moduleCell(byName("Lantern Bay Limited").modules[1], TODAY)).toMatchObject({
      kind: "active",
      text: "Active",
    });
    expect(moduleCell(byName("Orchid Lane Limited").modules[1], TODAY)).toMatchObject({
      kind: "cancels",
      text: "Cancels 21 Oct",
    });
    expect(moduleCell(byName("Willow Court Limited").modules[1], TODAY)).toMatchObject({
      kind: "suspended",
      text: "Suspended",
    });
  });
});

describe("rowSection", () => {
  it("puts only a company with every module suspended below the list", () => {
    expect(rowSection(byName("Halcyon Labs Limited").modules)).toBe("suspended");
    expect(rowSection(byName("Willow Court Limited").modules)).toBe("active"); // one still on offer
    expect(rowSection(byName("Marlow Studio Limited").modules)).toBe("active"); // one still live
    expect(rowSection(byName("Nexora Health Limited").modules)).toBe("active");
  });
});

describe("menuFor - the three shapes of the ⋮", () => {
  it("both active: transfer + cancel (04·M-44)", () => {
    expect(menuFor(byName("Nexora Health Limited").modules)).toEqual([
      "request_transfer",
      "cancel_subscription",
    ]);
  });
  it("active + cancelling: transfer + cancel + reactivate (04·M-45)", () => {
    expect(menuFor(byName("Solera Group Limited").modules)).toEqual([
      "request_transfer",
      "cancel_subscription",
      "reactivate",
    ]);
  });
  it("nothing active: transfer + reactivate (04·M-66)", () => {
    expect(menuFor(byName("Halcyon Labs Limited").modules)).toEqual([
      "request_transfer",
      "reactivate",
    ]);
    expect(menuFor(byName("Harbour & Vine Limited").modules)).toEqual([
      "request_transfer",
      "reactivate",
    ]);
  });
});

describe("sortEntities", () => {
  it("newest company first by default, the API's order when there is no created_at", () => {
    const names = sortEntities(ENTITIES, null).map((e) => e.entity_name);
    expect(names[0]).toBe("Harbour & Vine Limited");
    expect(names[names.length - 1]).toBe("Halcyon Labs Limited");
    const undated = ENTITIES.slice(0, 3).map((e) => ({ ...e, created_at: null }));
    expect(
      sortEntities([undated[2], undated[0], undated[1]], null).map((e) => e.entity_name),
    ).toEqual([undated[2].entity_name, undated[0].entity_name, undated[1].entity_name]);
  });

  it("Entity name A→Z and Z→A", () => {
    const az = sortEntities(ENTITIES, { column: "entity", direction: "asc" }).map(
      (e) => e.entity_name,
    );
    expect(az[0]).toBe("Aetheria Capital Limited");
    expect(az[az.length - 1]).toBe("Willow Court Limited");
    const za = sortEntities(ENTITIES, { column: "entity", direction: "desc" }).map(
      (e) => e.entity_name,
    );
    expect(za[0]).toBe("Willow Court Limited");
  });

  it("a module column: whichever date comes soonest first, companies without one last", () => {
    const soonest = sortEntities(ENTITIES, { column: "PAYMENT_REQUEST", direction: "asc" });
    const first = soonest[0].modules[1];
    expect(first.status).toBe("trial_expired"); // the past dates come before the coming ones
    const withDate = soonest.filter((e) => e.modules[1].date_iso);
    const without = soonest.filter((e) => !e.modules[1].date_iso);
    expect(soonest.slice(withDate.length).every((e) => !e.modules[1].date_iso)).toBe(true);
    expect(without.length).toBeGreaterThan(0);
    for (let i = 1; i < withDate.length; i++) {
      expect(Date.parse(withDate[i - 1].modules[1].date_iso!)).toBeLessThanOrEqual(
        Date.parse(withDate[i].modules[1].date_iso!),
      );
    }
  });

  it("the arrow cycles ascending, descending, off", () => {
    expect(nextSort(null, "entity")).toEqual({ column: "entity", direction: "asc" });
    expect(nextSort({ column: "entity", direction: "asc" }, "entity")).toEqual({
      column: "entity",
      direction: "desc",
    });
    expect(nextSort({ column: "entity", direction: "desc" }, "entity")).toBeNull();
    expect(nextSort({ column: "entity", direction: "desc" }, "PETTY_CASH")).toEqual({
      column: "PETTY_CASH",
      direction: "asc",
    });
  });
});

describe("matches", () => {
  it("searches the company, the country, the subscriber and 'module status'", () => {
    const kestrel = byName("Kestrel Foods Limited");
    expect(matches(kestrel, "kestrel")).toBe(true);
    expect(matches(kestrel, "hong kong")).toBe(true);
    expect(matches(kestrel, "olive@example.com")).toBe(true);
    expect(matches(kestrel, "payment request free trial")).toBe(true);
    expect(matches(kestrel, "acme holdings")).toBe(false);
    expect(matches(kestrel, "   ")).toBe(true);
  });
});

describe("toRow", () => {
  it("assembles cells, section and menu", () => {
    const row = toRow(byName("Solera Group Limited"), TODAY);
    expect(row.cells.map((c) => c.kind)).toEqual(["active", "cancels"]);
    expect(row.section).toBe("active");
    expect(row.menu).toHaveLength(3);
  });
});
