/**
 * The select-company list per state - the rows of Figma 02-A's background (the design drew
 * today's Flask page), shared by Vitest, Playwright's `page.route` stubs and the dev-only
 * `?fixture=` switch (`hooks/useEntityList`).
 */

import type { EntityListAnswer, EntityRow } from "@/features/entities/api/entities";

const HOUR = 3_600_000;

/** An instant `hours` ago - so a fixture's "last opened" never drifts into the future. */
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

function row(overrides: Partial<EntityRow> & Pick<EntityRow, "id" | "name">): EntityRow {
  return {
    status: "connected",
    modules: ["PETTY_CASH"],
    trial_modules: [],
    trial_module_names: [],
    last_accessed_at: hoursAgo(2),
    last_accessed_by: "Olive Vine",
    ...overrides,
  };
}

const BOTH = ["PAYMENT_REQUEST", "PETTY_CASH"];

export const LIST: EntityListAnswer = {
  entities: [
    row({
      id: "e-scenario",
      name: "Scenario",
      status: "onboarding",
      last_accessed_at: null,
      last_accessed_by: null,
    }),
    row({
      id: "e-scenario-5",
      name: "Digitalisation - Scenario 5 - Free trial + Active",
      modules: BOTH,
      trial_modules: ["PETTY_CASH"],
      trial_module_names: ["Petty Cash"],
      last_accessed_at: hoursAgo(1),
    }),
    row({
      id: "e-scenario-6",
      name: "Digitalisation - Scenario 6 - Expired + Free trial",
      trial_modules: ["PETTY_CASH"],
      trial_module_names: ["Petty Cash"],
    }),
    row({ id: "e-scenario-10", name: "Digitalisation - Scenario 10 - Resume Module After A Renewal" }),
    row({
      id: "e-scenario-2",
      name: "Digitalisation - Scenario 2: 1 Trial + Not started",
      modules: BOTH,
      trial_modules: BOTH,
      trial_module_names: ["Payment Request", "Petty Cash"],
      last_accessed_by: null,
    }),
    row({ id: "e-scenario-9", name: "Digitalisation - Scenario 9 - Modules Cancelled On Different Dates", modules: BOTH }),
    row({ id: "e-scenario-8", name: "Digitalisation - Scenario 8 - Both Active", modules: BOTH }),
  ],
  notices: [],
};

export const EMPTY: EntityListAnswer = { entities: [], notices: [] };

export const FIXTURES = { LIST, EMPTY } as const;
export type EntityFixture = keyof typeof FIXTURES;

export function isEntityFixture(name: string | null | undefined): name is EntityFixture {
  return name === "LIST" || name === "EMPTY";
}
