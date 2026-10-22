/**
 * The select-company list per state (each company opened an hour apart, so "last used first"
 * has one answer: Scenario 5, 6, 10, 2, 9, 8; Scenario itself is in setup and never opened) - the rows of Figma 02-A's background (the design drew
 * today's Flask page), shared by Vitest, Playwright's `page.route` stubs and the dev-only
 * `?fixture=` switch (`hooks/useEntityList`).
 */

// Hong Kong's calendar day, written with Intl here rather than @minty/shared/dates: the Playwright
// spec 07 reads this fixture, and Playwright will not load the package's .ts source.
const hkDay = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong" }).format(d);

import type { EntityListAnswer, EntityRow } from "@/features/entities/api/entities";

const HOUR = 3_600_000;

/** A Hong Kong calendar day `days` from today ("YYYY-MM-DD", as `needsYou` counts). */
function dayIn(days: number): string {
  return hkDay(new Date(Date.now() + days * 24 * HOUR));
}

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
    role: "admin",
    trial_ends_on: null,
    payment_failed: false,
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
      last_accessed_at: hoursAgo(2),
    }),
    row({
      id: "e-scenario-10",
      name: "Digitalisation - Scenario 10 - Resume Module After A Renewal",
      role: "entity_base",
      last_accessed_at: hoursAgo(3),
    }),
    row({
      id: "e-scenario-2",
      name: "Digitalisation - Scenario 2: 1 Trial + Not started",
      modules: BOTH,
      trial_modules: BOTH,
      trial_module_names: ["Payment Request", "Petty Cash"],
      last_accessed_at: hoursAgo(4),
      last_accessed_by: null,
    }),
    row({
      id: "e-scenario-9",
      name: "Digitalisation - Scenario 9 - Modules Cancelled On Different Dates",
      modules: BOTH,
      last_accessed_at: hoursAgo(5),
    }),
    row({
      id: "e-scenario-8",
      name: "Digitalisation - Scenario 8 - Both Active",
      modules: BOTH,
      last_accessed_at: hoursAgo(6),
    }),
  ],
  notices: [],
};

/**
 * Every "Needs you" reason at once, on top of LIST (2026-10-19): a declined payment (opened
 * LAST, so the group keeps last-used order rather than urgency), a trial ending in three days,
 * and one ending in twenty - outside `TRIAL_SOON_DAYS`, so it stays in "Your businesses".
 */
export const NEEDS_YOU: EntityListAnswer = {
  entities: [
    ...LIST.entities,
    row({
      id: "e-payment-failed",
      name: "Payment Failed Limited",
      payment_failed: true,
      // a trial ending too: the failed payment is the more urgent, so it is the one said
      trial_ends_on: dayIn(2),
      last_accessed_at: hoursAgo(9),
    }),
    row({
      id: "e-trial-soon",
      name: "Trial Ending Soon Limited",
      modules: ["PAYMENT_REQUEST"],
      trial_modules: ["PAYMENT_REQUEST"],
      trial_module_names: ["Payment Request"],
      trial_ends_on: dayIn(3),
      role: "entity_base",
      last_accessed_at: hoursAgo(7),
    }),
    row({
      id: "e-trial-later",
      name: "Trial Ending Later Limited",
      trial_modules: ["PETTY_CASH"],
      trial_module_names: ["Petty Cash"],
      trial_ends_on: dayIn(20),
      last_accessed_at: hoursAgo(8),
    }),
  ],
  notices: [],
};

export const EMPTY: EntityListAnswer = { entities: [], notices: [] };

export const FIXTURES = { LIST, NEEDS_YOU, EMPTY } as const;
export type EntityFixture = keyof typeof FIXTURES;

export function isEntityFixture(name: string | null | undefined): name is EntityFixture {
  return name === "LIST" || name === "NEEDS_YOU" || name === "EMPTY";
}
