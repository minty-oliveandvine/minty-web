import type { ReactNode } from "react";

import { Header } from "@/components/ui/Header";
import { PortalTabs } from "@/features/subscription/routes/PortalTabs";

/**
 * The frame around every subscription page: the shell header and the portal's tabs.
 * `app/subscription/layout.tsx` re-exports it. Skeletal - the design pass restyles.
 */
export function SubscriptionLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header title="Minty · Subscriptions" />
      <div className="mx-auto max-w-5xl px-4 py-6">
        <PortalTabs />
        <main className="mt-6">{children}</main>
      </div>
    </>
  );
}
