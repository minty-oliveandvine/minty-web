import type { ReactNode } from "react";

import { PortalChrome } from "@/features/subscription/routes/PortalChrome";
import { PortalTabs } from "@/features/subscription/routes/PortalTabs";

/**
 * The frame around every portal page: billing-frontend's header and the portal's tabs, over
 * the design's 1298px column. `app/subscription/(portal)/layout.tsx` re-exports it.
 */
export function SubscriptionLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PortalChrome />
      <div className="mx-auto max-w-[1346px] px-4 py-6 sm:px-6">
        <PortalTabs />
        <main className="mt-6">{children}</main>
      </div>
    </>
  );
}
