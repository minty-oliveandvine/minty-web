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
/** The Minty cat's pop-up line for a new company (the floating "+" until 2026-11-05). */
export const CREATE_COMPANY = "Create company";
export const LOAD_FAILED = "Your companies didn't load. Mind trying again?";

/** Archived companies (superusers only): the pill, the filter and the way back. */
export const ARCHIVED = "Archived";
export const RESTORE = "Restore";
export const RESTORE_TITLE = (name: string) => `Restore ${name}?`;
export const RESTORE_TEXT = "It comes back for everyone who belongs to it.";
export const RESTORED = "Company restored.";
export const ARCHIVE = "Archive";
export const ARCHIVE_COMPANY = "Archive company";
export const ARCHIVE_TITLE = (name: string) => `Archive ${name}?`;
export const ARCHIVE_TEXT = "It disappears for everyone. Only Minty support can bring it back.";
export const ARCHIVED_DONE = "Company archived.";
/** The list's manage mode (admins): "Archive companies" turns it on, "Done" off. */
export const MANAGE_ARCHIVE = "Archive companies";
export const MANAGE_DONE = "Done";
export const FILTER_LABEL = "Show companies";
export const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
] as const;

/** Case-insensitive, anywhere in the name - Flask's `filterCompanies`, as a person types. */
export function filterRows(rows: EntityRow[], query: string): EntityRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => row.name.toLowerCase().includes(q));
}

/**
 * "Setup in progress" first, then A→Z by name - case-insensitive, numbers in numeric order
 * ("Scenario 2" before "Scenario 10"). Flask sends most-recently-opened; this list re-sorts.
 * Archived companies (a superuser's "All") go last, in the same order among themselves.
 */
export function sortRows(rows: EntityRow[]): EntityRow[] {
  return [...rows].sort(
    (a, b) =>
      Number(isArchived(a)) - Number(isArchived(b)) ||
      Number(isSettingUp(b)) - Number(isSettingUp(a)) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true }),
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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
  return row.status === "onboarding" && !isArchived(row);
}

/** The row offers Archive: an active company the person is an admin of (the API's rule). */
export function canArchive(row: EntityRow): boolean {
  return !isArchived(row) && row.role === "admin";
}

/** Archived: hidden from everyone but superusers, and never opened until it is restored. */
export function isArchived(row: EntityRow): boolean {
  return Boolean(row.archived_at);
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
  return `${env.ACCOUNTS_API_URL}/entity/create`;
}
