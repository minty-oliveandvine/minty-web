"use client";

/**
 * Where a seam lands while its screen is not built: the CTAs of the module page (Activate,
 * Resume, Reactivate, the payment method), the list's ⋮ items and the portal's other pages
 * each navigate to the route that will own that flow, and Part 2 step 4 builds those one
 * Figma frame at a time. Until then this page says so, instead of Next's "not found" - a
 * broken-looking door on a working app. It reads the path to name the flow.
 */

import { usePathname, useRouter } from "next/navigation";

import { PORTAL } from "@/features/subscription/lib/paths";

const FLOWS: { test: RegExp; name: string }[] = [
  { test: /\/modules\/activate\//, name: "Activate Subscription" },
  { test: /\/modules\/resume\//, name: "Resume Subscription" },
  { test: /\/modules\/reactivate(\/|$)/, name: "Reactivate Subscription" },
  { test: /\/modules\/cancel(\/|$)/, name: "Cancel subscription" },
  { test: /\/modules\/payment-method$/, name: "Payment method" },
  { test: /\/invoices$/, name: "Invoices" },
];

export function NotBuiltYet() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const flow = FLOWS.find((f) => f.test.test(pathname))?.name ?? "This page";

  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-[var(--quiet)]">
        Coming next
      </p>
      <h1 className="mt-2 text-[25px] font-bold text-ink">{flow} isn&apos;t built yet</h1>
      <p className="mt-3 text-base text-[var(--ink-soft)]">
        This part of the subscription flow is being built from its design, one screen at a time.
        Nothing has changed on your account.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="h-12 rounded-xl border border-[#737a87]/30 bg-white px-6 text-base font-semibold text-black hover:bg-gray-50"
        >
          Go back
        </button>
        <a
          href={PORTAL.subscriptions}
          className="flex h-12 items-center rounded-xl bg-[#4fc7c7] px-6 text-base font-semibold text-white hover:opacity-90"
        >
          Manage Subscriptions
        </a>
      </div>
    </main>
  );
}
