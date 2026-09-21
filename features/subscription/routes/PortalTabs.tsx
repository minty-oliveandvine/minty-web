"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PORTAL } from "@/features/subscription/lib/paths";

/**
 * The three portal tabs (billing-frontend's PortalTabs, behaviour only). The module settings
 * page of a company is reached from a row, not from here.
 */
const TABS = [
  { href: PORTAL.subscriptions, label: "Subscriptions" },
  { href: PORTAL.billing, label: "Billing" },
  { href: PORTAL.invoices, label: "Invoices" },
] as const;

export function PortalTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Subscription sections" className="flex gap-4 border-b border-[var(--border)]">
      {TABS.map((t) => {
        const current = pathname === t.href || pathname.startsWith(t.href + "/");
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
