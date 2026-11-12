// Petty Cash Settings' rules (lib/settings.ts), ported from minty-petty-cash-web's
// lib/__tests__/settings.test.ts. The page's address and its links to the other tabs are the hub's
// now (lib/paths.ts), so the Petty Cash app's address and hand-off tests became the ones below.

import { afterEach, describe, expect, it } from "vitest";

import { clearAuth, setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import { companyApiPath } from "@/features/petty-cash-settings/api/pettyCashSettings";
import { connectXeroPath, pettyCashSettingsPath } from "@/features/petty-cash-settings/lib/paths";
import {
  ADD_NAME_MAX,
  NAME_EMPTY,
  RENAME_NAME_MAX,
  catalogueOptions,
  kindFor,
  methodNameProblem,
  movedIds,
  placedIds,
  shownTypes,
  viewOnly,
  type SettingsPermissions,
} from "@/features/petty-cash-settings/lib/settings";

const ENTITY = "360812e1-9f94-46a3-aa31-347e21afde8e";

const NONE: SettingsPermissions = {
  edit_xero: false,
  view_sales_methods: true,
  add_sales_method: false,
  rename_sales_method: false,
  remove_sales_method: false,
  reorder_sales_methods: false,
};

describe("the page's address and its links", () => {
  afterEach(() => clearAuth());

  it("is the hub's settings tab: /entity/<shortid>/<name>/settings/petty-cash", () => {
    expect(pettyCashSettingsPath(ENTITY, "Olive & Vine")).toBe(
      "/entity/360812e1/olive-and-vine/settings/petty-cash",
    );
  });

  it("sends 'Xero isn't connected' to this app's Integration tab, never a hand-off", () => {
    expect(connectXeroPath(ENTITY, "Olive & Vine")).toBe(
      "/entity/360812e1/olive-and-vine/settings/integration",
    );
  });

  it("calls minty-petty-cash-api with the company in the path and nowhere else", () => {
    expect(companyApiPath(ENTITY, "/settings")).toBe(
      `/api/petty-cash/v1/companies/${ENTITY}/settings`,
    );
    expect(companyApiPath("a/b", "/settings")).toBe("/api/petty-cash/v1/companies/a%2Fb/settings");
  });
});

describe("the cards follow the business type (owner, 2026-11-11)", () => {
  const lists = (delivery: number) => ({
    electronic: [{ id: "v", name: "Visa", value_name: "visa_sales", own: false }],
    delivery: Array.from({ length: delivery }, (_, i) => ({
      id: `d${i}`,
      name: `D${i}`,
      value_name: `d${i}_sales`,
      own: false,
    })),
  });

  it("Restaurant & Food and an older company: Electronic and Delivery", () => {
    expect(shownTypes({ sales_groups: "electronic_delivery", sales_methods: lists(0) })).toEqual([
      "electronic",
      "delivery",
    ]);
    expect(shownTypes({ sales_methods: lists(0) })).toEqual(["electronic", "delivery"]);
    expect(kindFor("electronic", "electronic_delivery").title).toBe("Electronic");
  });

  it("a retail shop, a service or a general business: one Non-cash card", () => {
    expect(shownTypes({ sales_groups: "non_cash", sales_methods: lists(0) })).toEqual([
      "electronic",
    ]);
    expect(kindFor("electronic", "non_cash").title).toBe("Non-cash");
    expect(kindFor("delivery", "non_cash").title).toBe("Delivery");
  });

  it("keeps a Delivery card that still holds methods, so they can be seen and removed", () => {
    expect(shownTypes({ sales_groups: "non_cash", sales_methods: lists(1) })).toEqual([
      "electronic",
      "delivery",
    ]);
  });
});

describe("the catalogue picker (Flask's method catalogue)", () => {
  const available = [
    { id: "1", name: "Octopus" },
    { id: "2", name: "AlipayHK" },
    { id: "3", name: "PayMe" },
  ];

  it("offers every method not on the list, filtered by any part of the name", () => {
    expect(catalogueOptions(available, "").map((m) => m.id)).toEqual(["1", "2", "3"]);
    expect(catalogueOptions(available, "pay").map((m) => m.id)).toEqual(["2", "3"]);
    expect(catalogueOptions(available, "zz")).toEqual([]);
  });
});

describe("a method's name, checked as it is typed", () => {
  const listed = [
    { id: "a", name: "Visa", value_name: "visa_sales", own: true },
    { id: "b", name: "Octopus", value_name: "octopus_sales", own: false },
  ];

  it("says nothing while it is empty: that only means it is not finished", () => {
    expect(methodNameProblem("", listed, ADD_NAME_MAX)).toBeNull();
    expect(methodNameProblem("   ", listed, ADD_NAME_MAX)).toBeNull();
    expect(NAME_EMPTY).toBe("The method's name is still empty. Type a name to add it.");
  });

  it("names the API's limits: 74 to add (room for _sales), 80 to rename", () => {
    expect(ADD_NAME_MAX).toBe(74);
    expect(RENAME_NAME_MAX).toBe(80);
    expect(methodNameProblem("x".repeat(74), listed, ADD_NAME_MAX)).toBeNull();
    expect(methodNameProblem("x".repeat(75), listed, ADD_NAME_MAX)).toBe(
      "That name is too long. Keep it to 74 characters or fewer.",
    );
    expect(methodNameProblem("x".repeat(80), listed, RENAME_NAME_MAX, "a")).toBeNull();
    expect(methodNameProblem("x".repeat(81), listed, RENAME_NAME_MAX, "a")).toBe(
      "That name is too long. Keep it to 80 characters or fewer.",
    );
  });

  it("refuses a name already on the list, in any case, as the API does", () => {
    expect(methodNameProblem(" visa ", listed, ADD_NAME_MAX)).toBe("visa is already on the list.");
  });

  it("lets a rename keep its own name", () => {
    expect(methodNameProblem("VISA", listed, RENAME_NAME_MAX, "a")).toBeNull();
    expect(methodNameProblem("Octopus", listed, RENAME_NAME_MAX, "a")).toBe(
      "Octopus is already on the list.",
    );
  });
});

describe("a dragged method dropped on another row", () => {
  it("takes that row's place and gives the type's full list in its new order", () => {
    expect(placedIds(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(placedIds(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("is nothing for a drop on itself or outside the list", () => {
    expect(placedIds(["a", "b"], 1, 1)).toBeNull();
    expect(placedIds(["a", "b"], 0, 2)).toBeNull();
    expect(placedIds(["a", "b"], -1, 0)).toBeNull();
  });
});

describe("Move up and Move down", () => {
  it("moves one place and gives the type's full list in its new order", () => {
    expect(movedIds(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(movedIds(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
  });

  it("goes nowhere past either end", () => {
    expect(movedIds(["a", "b"], 0, -1)).toBeNull();
    expect(movedIds(["a", "b"], 1, 1)).toBeNull();
  });
});

describe("view-only", () => {
  it("is a person who may change nothing on the page (a cashier)", () => {
    expect(viewOnly(NONE)).toBe(true);
    expect(viewOnly({ ...NONE, reorder_sales_methods: true })).toBe(false);
    expect(viewOnly({ ...NONE, edit_xero: true })).toBe(false);
  });
});
