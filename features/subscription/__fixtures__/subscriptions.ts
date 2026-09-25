/**
 * `/api/me/subscriptions` and `/api/me/subscriptions/transfers` as the Figma design draws them
 * (file 43YI3MYtTfX5Xzz6dRoRuT, section "04 · Manage Subscriptions — the payer portal", frame
 * 04-A "one row per scenario"): the companies of frame 04-A in its order, every module-status
 * pair once, the one company with nothing running, and the transfer request at the top. Shared
 * by the Vitest suites, the Playwright specs (served through `page.route`) and the dev-only
 * `?fixture=` switch. Dates are relative to `TODAY` (the module page's) so day counts hold.
 */

import type {
  IncomingTransfer,
  ModuleStatus,
  PayerSubscriptions,
  PortalEntity,
  PortalModule,
} from "@/features/subscription/api/payerPortal";
import { TODAY } from "@/features/subscription/__fixtures__/modulePage";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function inDays(days: number): { iso: string; text: string } {
  const d = new Date(TODAY);
  d.setUTCDate(d.getUTCDate() + days);
  const text = `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return { iso: d.toISOString(), text };
}

const LABEL: Record<ModuleStatus, string> = {
  active: "active",
  trialing: "free trial",
  cancelled: "cancelled",
  past_due: "payment due",
  ended: "ended",
  trial_expired: "trial expired",
  not_subscribed: "not subscribed",
};

/** A module cell in one of the API's states; the date follows the state's meaning. */
function mod(code: "PETTY_CASH" | "PAYMENT_REQUEST", status: ModuleStatus, days = 3): PortalModule {
  const name = code === "PETTY_CASH" ? "Petty Cash" : "Payment Request";
  const base = { code, name, status, status_label: LABEL[status] };
  switch (status) {
    case "trialing": {
      const d = inDays(days);
      return { ...base, date_label: "Trial ends", date: d.text, date_iso: d.iso };
    }
    case "active": {
      const d = inDays(21);
      return { ...base, date_label: "Next billing", date: d.text, date_iso: d.iso };
    }
    case "cancelled": {
      const d = inDays(days);
      return { ...base, date_label: "Expires", date: d.text, date_iso: d.iso };
    }
    case "past_due": {
      const d = inDays(9);
      return { ...base, date_label: "Access ends", date: d.text, date_iso: d.iso };
    }
    case "trial_expired": {
      const d = inDays(-4);
      return { ...base, date_label: "Trial ended", date: d.text, date_iso: d.iso };
    }
    case "ended": {
      const d = inDays(-30);
      return { ...base, date_label: "Ended", date: d.text, date_iso: d.iso };
    }
    case "not_subscribed":
      return { ...base, date_label: null, date: null, date_iso: null };
  }
}

export const PAYER = { id: "u-payer", name: "Olive Vine", email: "olive@example.com" };

let created = 0;
function company(
  name: string,
  pc: PortalModule,
  pr: PortalModule,
  country = "Hong Kong",
): PortalEntity {
  const id = `e-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
  // newest first in the design's order: each next company is a day older
  const createdAt = inDays(-created++).iso;
  return {
    entity_id: id,
    entity_name: name,
    country,
    country_code: "HK",
    subscriber: PAYER,
    modules: [pc, pr],
    settings_path: `/entity/settings/module/${id}`,
    created_at: createdAt,
  };
}

/** Frame 04-A, top to bottom. */
export const ENTITIES: PortalEntity[] = [
  company(
    "Harbour & Vine Limited",
    mod("PETTY_CASH", "not_subscribed"),
    mod("PAYMENT_REQUEST", "not_subscribed"),
  ),
  company(
    "Kestrel Foods Limited",
    mod("PETTY_CASH", "not_subscribed"),
    mod("PAYMENT_REQUEST", "trialing", 3),
  ),
  company(
    "Mino Market Limited",
    mod("PETTY_CASH", "not_subscribed"),
    mod("PAYMENT_REQUEST", "trial_expired"),
  ),
  company(
    "Lantern Bay Limited",
    mod("PETTY_CASH", "not_subscribed"),
    mod("PAYMENT_REQUEST", "active"),
  ),
  company(
    "Orchid Lane Limited",
    mod("PETTY_CASH", "not_subscribed"),
    mod("PAYMENT_REQUEST", "cancelled", 30),
  ),
  company(
    "Pier 9 Trading Limited",
    mod("PETTY_CASH", "trialing", 3),
    mod("PAYMENT_REQUEST", "trialing", 15),
  ),
  company(
    "Quarry Hill Limited",
    mod("PETTY_CASH", "trialing", 3),
    mod("PAYMENT_REQUEST", "trial_expired"),
  ),
  company(
    "Aetheria Capital Limited",
    mod("PETTY_CASH", "trialing", 3),
    mod("PAYMENT_REQUEST", "active"),
  ),
  company(
    "Redwood Post Limited",
    mod("PETTY_CASH", "trialing", 3),
    mod("PAYMENT_REQUEST", "cancelled", 30),
  ),
  company(
    "Ember & Co Limited",
    mod("PETTY_CASH", "trial_expired"),
    mod("PAYMENT_REQUEST", "trial_expired"),
  ),
  company(
    "Thread & Craft Limited",
    mod("PETTY_CASH", "trial_expired"),
    mod("PAYMENT_REQUEST", "active"),
  ),
  company(
    "Saltwater Studio Limited",
    mod("PETTY_CASH", "trial_expired"),
    mod("PAYMENT_REQUEST", "cancelled", 30),
  ),
  company("Nexora Health Limited", mod("PETTY_CASH", "active"), mod("PAYMENT_REQUEST", "active")),
  company(
    "Solera Group Limited",
    mod("PETTY_CASH", "active"),
    mod("PAYMENT_REQUEST", "cancelled", 30),
  ),
  company(
    "Tidal Works Limited",
    mod("PETTY_CASH", "cancelled", 30),
    mod("PAYMENT_REQUEST", "cancelled", 30),
  ),
  company(
    "Willow Court Limited",
    mod("PETTY_CASH", "not_subscribed"),
    mod("PAYMENT_REQUEST", "past_due"),
  ),
  company(
    "Barley & Co Limited",
    mod("PETTY_CASH", "trialing", 3),
    mod("PAYMENT_REQUEST", "past_due"),
  ),
  company(
    "Copperline Limited",
    mod("PETTY_CASH", "trial_expired"),
    mod("PAYMENT_REQUEST", "past_due"),
  ),
  company("Marlow Studio Limited", mod("PETTY_CASH", "active"), mod("PAYMENT_REQUEST", "past_due")),
  company(
    "Northgate Limited",
    mod("PETTY_CASH", "cancelled", 30),
    mod("PAYMENT_REQUEST", "past_due"),
  ),
  company(
    "Halcyon Labs Limited",
    mod("PETTY_CASH", "past_due"),
    mod("PAYMENT_REQUEST", "past_due"),
  ),
];

export function subscriptionsPage(entities: PortalEntity[] = ENTITIES): PayerSubscriptions {
  return {
    payer: PAYER,
    billing: {
      // The cycle's START, two months back - deliberately NOT the next billing date, so a
      // screen that prints the anchor as "next" (the bug 08-A shipped with) fails its tests.
      anchor: "28 Jul 2026",
      anchor_iso: inDays(-53).iso,
      paid_through: "28 Sep 2026",
      paid_through_iso: inDays(7).iso,
      next_billing: "28 Sep 2026",
      next_billing_iso: inDays(7).iso,
      currency: "HKD",
    },
    entities,
    total: entities.length,
    page: 1,
    pages: 1,
    per_page: 100,
    sort: "entity",
    direction: "asc",
    query: "",
  };
}

/** The "Transfer Request Received" card at the top of frame 04-A. */
export const INCOMING_TRANSFERS: IncomingTransfer[] = [
  {
    id: "t-1",
    entity_id: "e-new-company",
    entity_name: "New Company Limited",
    settings_path: "/entity/settings/module/e-new-company",
    from_name: "Priya Chan",
    from_user_id: "u-priya",
    status: "pending",
    expires_at: inDays(5).iso,
    amount: 8800,
    currency: "HKD",
    quote: null,
    trials: [],
    blockers: [],
  },
];

export type ListFixture = "A" | "B" | "F";

/** 04-A the full list, 04-B nothing paid for, 04-F a payment failed (the suspended rows only). */
export const LIST_FIXTURES: Record<
  ListFixture,
  { page: PayerSubscriptions; transfers: IncomingTransfer[] }
> = {
  A: { page: subscriptionsPage(), transfers: INCOMING_TRANSFERS },
  B: { page: subscriptionsPage([]), transfers: [] },
  F: {
    page: subscriptionsPage(ENTITIES.filter((e) => e.modules.some((m) => m.status === "past_due"))),
    transfers: [],
  },
};

export function isListFixture(value: string | null | undefined): value is ListFixture {
  return value === "A" || value === "B" || value === "F";
}
