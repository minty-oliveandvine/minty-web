/**
 * What the Manage Subscriptions list SHOWS, derived from what `/api/me/subscriptions` SAYS.
 *
 * The Figma design (file 43YI3MYtTfX5Xzz6dRoRuT, section "04 · Manage Subscriptions — the payer
 * portal" and "04·M · Row menu open") draws one row per company, a cell per module, and the ⋮
 * menu in three shapes. This module turns the API's `PortalEntity` into that vocabulary, groups
 * the rows into the two sections, decides the menu, and does the sorting and searching the
 * design asks for ("The list scrolls — there is no pager … ordered newest entity first. The
 * sort arrows re-order it: Entity name A→Z / Z→A, and the module columns by whichever trial
 * expires soonest."). Pure; takes `today` for the day counts.
 */

import type { ModuleCode } from "@/features/subscription/api/moduleSettings";
import type {
  ModuleStatus,
  PortalEntity,
  PortalModule,
} from "@/features/subscription/api/payerPortal";
import { daysUntil, daysLabel } from "@/features/subscription/lib/moduleState";

/** The cell a module gets. `start_trial` and `subscribe` are buttons; the rest are words. */
export type ModuleCellKind =
  "start_trial" | "subscribe" | "trial" | "active" | "cancels" | "suspended" | "ended";

export type ModuleCell = {
  code: ModuleCode;
  name: string;
  status: ModuleStatus;
  kind: ModuleCellKind;
  /** The small first line ("Trial", "Trial Expired"); absent for one-liners and buttons. */
  eyebrow?: string;
  /** The line or the button's label. */
  text: string;
  tone: "accent" | "amber" | "muted" | "teal" | "quiet";
  /** Days to the module's date where the state counts down (trial); else null. */
  daysRemaining: number | null;
};

export type RowSection = "active" | "suspended";

export type MenuItem = "request_transfer" | "cancel_subscription" | "reactivate";

export type SubscriptionRow = {
  entity: PortalEntity;
  cells: ModuleCell[];
  section: RowSection;
  menu: MenuItem[];
};

function cellFor(m: PortalModule, today: Date): Omit<ModuleCell, "code" | "name" | "status"> {
  switch (m.status) {
    case "not_subscribed":
      return { kind: "start_trial", text: "Start Trial", tone: "teal", daysRemaining: null };
    case "trial_expired":
      return {
        kind: "subscribe",
        eyebrow: "Trial Expired",
        text: "Subscribe",
        tone: "teal",
        daysRemaining: null,
      };
    case "ended":
      return {
        kind: "subscribe",
        eyebrow: "Ended",
        text: "Subscribe",
        tone: "teal",
        daysRemaining: null,
      };
    case "trialing": {
      const days = daysUntil(m.date_iso, today);
      return {
        kind: "trial",
        eyebrow: "Trial",
        text: days === null ? "Active" : daysLabel(days),
        tone: "accent",
        daysRemaining: days,
      };
    }
    case "active":
      return { kind: "active", text: "Active", tone: "quiet", daysRemaining: null };
    case "cancelled":
      return {
        kind: "cancels",
        text: m.date ? `Cancels ${shortDate(m.date)}` : "Cancelling",
        tone: "amber",
        daysRemaining: null,
      };
    case "past_due":
      return { kind: "suspended", text: "Suspended", tone: "muted", daysRemaining: null };
  }
}

/** "15 Aug 2026" (the API's padded date) -> "15 Aug", as the design writes it. */
function shortDate(date: string): string {
  const m = /^(\d{1,2}) (\w{3})/.exec(date.trim());
  return m ? `${m[1]} ${m[2]}` : date;
}

export function moduleCell(m: PortalModule, today: Date): ModuleCell {
  return { code: m.code as ModuleCode, name: m.name, status: m.status, ...cellFor(m, today) };
}

/**
 * The bottom section holds the companies with nothing to offer at all: EVERY module suspended
 * (frame 04-A's Halcyon Labs). A company with one suspended module and anything else on the
 * other - live, or even a trial still on offer - stays in the main list (Willow Court, Barley
 * & Co … are drawn there).
 */
export function rowSection(modules: PortalModule[]): RowSection {
  return modules.length > 0 && modules.every((m) => m.status === "past_due")
    ? "suspended"
    : "active";
}

/**
 * The ⋮ menu (section 04·M's rule): Request transfer on every company; Cancel subscription only
 * when a module is ACTIVE (it unticks every active one); Reactivate when any module is not
 * ACTIVE — trial available, trial running, trial expired, suspended or cancelling — and ticks
 * every one of them.
 */
export function menuFor(modules: PortalModule[]): MenuItem[] {
  const items: MenuItem[] = ["request_transfer"];
  if (modules.some((m) => m.status === "active")) items.push("cancel_subscription");
  if (modules.some((m) => m.status !== "active")) items.push("reactivate");
  return items;
}

export function toRow(entity: PortalEntity, today: Date): SubscriptionRow {
  return {
    entity,
    cells: entity.modules.map((m) => moduleCell(m, today)),
    section: rowSection(entity.modules),
    menu: menuFor(entity.modules),
  };
}

// ---- ordering ---------------------------------------------------------------------------------

export type SortColumn = "entity" | ModuleCode;
export type SortDirection = "asc" | "desc";
export type ListSort = { column: SortColumn; direction: SortDirection } | null;

/** The instant a module's date names, for "whichever trial expires soonest"; Infinity when none. */
function moduleInstant(entity: PortalEntity, code: ModuleCode): number {
  const m = entity.modules.find((x) => x.code === code);
  if (!m?.date_iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(m.date_iso);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/**
 * Newest company first when nothing is chosen (the API's `created_at`, else the order the API
 * gave); the sort arrows re-order by entity name or by a module's date, soonest first.
 */
export function sortEntities(entities: PortalEntity[], sort: ListSort): PortalEntity[] {
  const rows = entities.map((entity, index) => ({ entity, index }));
  const dir = sort?.direction === "desc" ? -1 : 1;
  rows.sort((a, b) => {
    if (!sort) {
      const ta = a.entity.created_at ? Date.parse(a.entity.created_at) : Number.NaN;
      const tb = b.entity.created_at ? Date.parse(b.entity.created_at) : Number.NaN;
      if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return tb - ta;
      return a.index - b.index;
    }
    if (sort.column === "entity") {
      const cmp = a.entity.entity_name.localeCompare(b.entity.entity_name, undefined, {
        sensitivity: "base",
      });
      return cmp !== 0 ? cmp * dir : a.index - b.index;
    }
    const ia = moduleInstant(a.entity, sort.column);
    const ib = moduleInstant(b.entity, sort.column);
    if (ia !== ib) {
      // a company with no date on this module sits last either way
      if (ia === Number.POSITIVE_INFINITY) return 1;
      if (ib === Number.POSITIVE_INFINITY) return -1;
      return (ia - ib) * dir;
    }
    return a.index - b.index;
  });
  return rows.map((r) => r.entity);
}

/** Pressing a column's arrow: first press ascending, again descending, a third clears it. */
export function nextSort(current: ListSort, column: SortColumn): ListSort {
  if (!current || current.column !== column) return { column, direction: "asc" };
  return current.direction === "asc" ? { column, direction: "desc" } : null;
}

// ---- searching --------------------------------------------------------------------------------

/**
 * billing-frontend searched on the server over the company name, country, subscriber and
 * "{module name} {status label}"; the same fields here, over the loaded list.
 */
export function matches(entity: PortalEntity, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    entity.entity_name,
    entity.country ?? "",
    entity.subscriber?.name ?? "",
    entity.subscriber?.email ?? "",
    ...entity.modules.map((m) => `${m.name} ${m.status_label}`),
  ]
    .join(" \n ")
    .toLowerCase();
  return hay.includes(q);
}

export function pluralEntities(n: number): string {
  return `${n} ${n === 1 ? "entity" : "entities"}`;
}
