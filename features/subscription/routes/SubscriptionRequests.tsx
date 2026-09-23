"use client";

/**
 * `/subscription/subscriptions/incoming` - the recipient's side of a handover (Figma section
 * 07: 07-D/E/F). The query string carries `transfer` (the request to review - the list's
 * *Review and accept* lands here) and the dev-only `fixture` switch (D / TRIAL / F, see the
 * hook).
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SubscriptionRequestsScreen } from "@/features/subscription/routes/SubscriptionRequestsScreen";

function Content() {
  const q = useSearchParams();
  return <SubscriptionRequestsScreen transferId={q.get("transfer")} fixture={q.get("fixture")} />;
}

export function SubscriptionRequests() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
