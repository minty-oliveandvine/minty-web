import type { ReactNode } from "react";

import { PortalChrome } from "@/features/subscription/routes/PortalChrome";

/**
 * The frame around every portal page: billing-frontend's header over the design's 1298px
 * column. `app/subscription/(portal)/layout.tsx` re-exports it.
 *
 * NO TABS (removed 2026-09-29, the user: "remove this navigation header"). The Overview /
 * Manage Subscriptions / Billing row that used to sit above every page is gone; the pages reach
 * each other the way the design's own hotspots do - 08-A's _Manage Subscription_ and its account
 * card, every result's _Back to Manage Subscriptions_, the header's _Entity List_ - so there is
 * no second navigation to keep in step with them.
 */
export function SubscriptionLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PortalChrome />
      <div className="mx-auto max-w-[1346px] px-4 py-6 sm:px-6">
        <main>{children}</main>
      </div>
    </>
  );
}
