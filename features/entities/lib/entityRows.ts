/**
 * The select-company list's rules, pure - what each card says and where it leads. The look is
 * today's Flask page (`templates/entity/index.html`): Figma 02's background IS that page, so
 * the list moved as it looks.
 */

import { env } from "@/lib/env";
import { mintyEnterCompanyUrl } from "@/lib/mintyEntry";

import type { EntityRow } from "@/features/entities/api/entities";

export const PAGE_TITLE = "Select Company";
export const SEARCH_PLACEHOLDER = "Search company";
export const SETUP_IN_PROGRESS = "Setup in progress";
export const NOT_OPENED_YET = "Not opened yet";
export const NO_MATCH = "No companies found.";
export const EMPTY_TITLE = "No Entity Found";
export const EMPTY_TEXT =
  "You don't have any entities created yet. Connect to Xero to get started and manage your business entities.";
export const CREATE_ENTITY = "Create Entity";
export const ADD_ENTITY = "Add a new entity";
export const LOAD_FAILED = "Your companies didn't load. Mind trying again?";

/** Case-insensitive, anywhere in the name - Flask's `filterCompanies`, as a person types. */
export function filterRows(rows: EntityRow[], query: string): EntityRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => row.name.toLowerCase().includes(q));
}

/**
 * "Setup in progress" first, then A→Z by name - case-insensitive, numbers in numeric order
 * ("Scenario 2" before "Scenario 10"). Flask sends most-recently-opened; this list re-sorts.
 */
export function sortRows(rows: EntityRow[]): EntityRow[] {
  return [...rows].sort(
    (a, b) =>
      Number(isSettingUp(b)) - Number(isSettingUp(a)) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }),
  );
}

const MONTHS =["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "9 Jun 5:42 PM" in the VIEWER's zone - the format and the zone Flask's page ended up with
 * (its `localizeLastAccessed` re-rendered the server's Hong Kong string in the browser's
 * zone). The API sends an instant now, so there is nothing to parse back. Null for a missing
 * or unreadable value: the clock then says "Not opened yet" rather than a guess.
 */
export function lastAccessedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const hour24 = at.getHours();
  const minute = String(at.getMinutes()).padStart(2, "0");
  return `${at.getDate()} ${MONTHS[at.getMonth()]} ${hour24 % 12 || 12}:${minute} ${hour24 < 12 ? "AM" : "PM"}`;
}

/** The clock's accessible name: when, and by whom when known. */
export function lastOpenedLabel(when: string, by: string | null): string {
  return `Last opened ${when}${by ? ` by ${by}` : ""}`;
}

/** "Free trial: Petty Cash, Payment Request" - which modules the one badge is about. */
export function trialLabel(row: EntityRow): string | null {
  return row.trial_modules.length > 0 ? `Free trial: ${row.trial_module_names.join(", ")}` : null;
}

export function isSettingUp(row: EntityRow): boolean {
  return row.status === "onboarding";
}

/**
 * Into the company: Minty's `/entity/<id>/enter` signs the person in on the token and hands on
 * to the company's module selector - which sends a company still in onboarding back into the
 * wizard, and otherwise to its module (or the module selection when both are on).
 */
export function enterHref(row: EntityRow): string {
  return mintyEnterCompanyUrl(row.id);
}

/** A new company: Minty's /entity/create launches the onboarding wizard with its own token. */
export function createEntityHref(): string {
  return `${env.PETTY_CASH_URL}/entity/create`;
}
