"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PORTAL } from "@/features/subscription/lib/paths";

/**
 * The portal's tabs (billing-frontend's PortalTabs, behaviour only). The module settings page
 * of a company is reached from a row, not from here.
 *
 * OVERVIEW IS THE LANDING, and it had no tab until now: `/subscription` is Subscription &
 * Billing (08-A), and standing on it lit nothing at all, so the only way back was the browser's
 * back button. "Manage Subscriptions" rather than the shorter "Subscriptions" it used to say —
 * beside a landing called Subscription & Billing and a tab called Billing, three names that
 * sound alike help nobody, and Manage Subscriptions is what every button in the app calls that
 * page (and what billing-frontend's own tab said).
 *
 * `exact` marks a tab whose href is a PREFIX of every other one. Without it the landing's tab
 * would be current on every page in the portal, and two tabs would be lit at once.
 */
const TABS = [
  { href: PORTAL.index, label: "Overview", exact: true },
  { href: PORTAL.subscriptions, label: "Manage Subscriptions", exact: false },
  { href: PORTAL.billing, label: "Billing", exact: false },
  { href: PORTAL.invoices, label: "Invoices", exact: false },
] as const;

export function PortalTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Subscription sections" className="flex gap-4 border-b border-[var(--border)]">
      {TABS.map((t) => {
        // The prefix rule is what keeps Billing lit on /subscription/billing/add.
        const current = t.exact
          ? pathname === t.href
          : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={current ? "page" : undefined}
            className={`-mb-px border-b-2 px-1 py-2 text-sm ${
              current ? "border-secondary font-semibold" : "border-transparent text-muted"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
