/**
 * The select-company list's rules, pure - what each card says and where it leads. The look is
 * today's Flask page (`templates/entity/index.html`): Figma 02's background IS that page, so
 * the list moved as it looks.
 */

import { env } from "@/lib/env";
import { mintyEnterCompanyUrl } from "@/lib/mintyEntry";

import type { EntityRow } from "@/features/entities/api/entities";

export const PAGE_TITLE = "Select Company";
/** Part 15.8's question title, over the list (the header bar keeps the page's h1). */
export const QUESTION = "Which business are you working on?";
export const NEEDS_YOU = "Needs you";
export const YOUR_BUSINESSES = "Your businesses";
export const SEARCH_PLACEHOLDER = "Search company";
/** Part 15.8: search is offered from seven companies - more than six. */
export const SEARCH_FROM = 7;
export const NOT_OPENED_YET = "Not opened yet";
export const NO_MATCH = "No companies found.";
export const EMPTY_TITLE = "No Entity Found";
export const EMPTY_TEXT =
  "You don't have any entities created yet. Connect to Xero to get started and manage your business entities.";
export const CREATE_ENTITY = "Create Entity";
/** The page-level Secondary action that replaced the floating "+" (Part 15.8, 2026-10-19). */
export const CREATE_BUSINESS = "Create a business";
export const LOAD_FAILED = "Your companies didn't load. Mind trying again?";

/** Case-insensitive, anywhere in the name - Flask's `filterCompanies`, as a person types. */
export function filterRows(rows: EntityRow[], query: string): EntityRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => row.name.toLowerCase().includes(q));
}

/**
 * Last used first (Part 15.8; the owner's brief, 2026-10-19 - it was "Setup in progress" first,
 * then A→Z, from 2026-10-05): the most recent `last_accessed_at` - anyone's opening, as the
 * clock shows it - then the companies nobody has opened, A→Z by name (case-insensitive,
 * "Scenario 2" before "Scenario 10"). The rows needing the person are lifted out by `groupRows`.
 */
export function sortRows(rows: EntityRow[]): EntityRow[] {
  const opened = (row: EntityRow) => {
    const at = row.last_accessed_at ? Date.parse(row.last_accessed_at) : NaN;
    return Number.isNaN(at) ? null : at;
  };
  return [...rows].sort((a, b) => {
    const [x, y] = [opened(a), opened(b)];
    if (x !== null && y !== null && x !== y) return y - x;
    if ((x === null) !== (y === null)) return x === null ? 1 : -1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
  });
}

/**
 * Why a company needs the person, and what to do - in words, from the list's own fields. Only
 * two states the list carries are actionable: a company still in the onboarding wizard, and one
 * whose Xero link was cut (`disconnected` - publishing stops until it is reconnected, in the
 * company's Settings). A trial's end and a failed payment are not on this read.
 */
export type NeedsYou = { reason: string; action: string };

export function needsYou(row: EntityRow): NeedsYou | null {
  if (row.status === "onboarding") return { reason: "Setup not finished", action: "continue setup" };
  if (row.status === "disconnected") {
    return { reason: "Xero is disconnected", action: "reconnect it in Settings" };
  }
  return null;
}

/** The two groups, each in the order it was given: those needing the person, then the rest. */
export function groupRows(rows: EntityRow[]): { needsYou: EntityRow[]; others: EntityRow[] } {
  return {
    needsYou: rows.filter((row) => needsYou(row) !== null),
    others: rows.filter((row) => needsYou(row) === null),
  };
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
