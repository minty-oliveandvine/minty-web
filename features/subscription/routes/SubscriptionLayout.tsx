import type { ReactNode } from "react";

import { PortalBackProvider } from "@/features/subscription/components/PortalBack";
import { PortalChrome } from "@/features/subscription/routes/PortalChrome";

/**
 * The frame around every portal page: minty-payment-request-web's header over a padded column;
 * each page centres itself at its Part 15.G width (`data-portal-col`). `app/subscription/(portal)/layout.tsx` re-exports it.
 *
 * NO TABS (removed 2026-09-29, the user: "remove this navigation header"). The Overview /
 * Manage Subscriptions / Billing row that used to sit above every page is gone; the pages reach
 * each other the way the design's own hotspots do - 08-A's _Manage Subscription_ and its account
 * card, every result's _Back to Manage Subscriptions_, each page's back line (in the header since
 * 2026-09-29, `PortalBack`) - so there is no second navigation to keep in step with them.
 *
 * The column's width and padding are also the header slot's arithmetic (`PortalBackSlot`).
 */
export function SubscriptionLayout({ children }: { children: ReactNode }) {
  return (
    <PortalBackProvider>
      <PortalChrome />
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <main>{children}</main>
      </div>
    </PortalBackProvider>
  );
}
