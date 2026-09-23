"use client";

/**
 * `/subscription/subscriptions/subscriber` - the payer's side of a handover (Figma section
 * 07: 07-A/B/C/K). The query string carries `entity` (the company to hand over - the ⋮'s
 * *Request transfer* lands here) and the dev-only `fixture` switch (A / C / BLOCKED, see the
 * hook).
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { TransferSubscriptionScreen } from "@/features/subscription/routes/TransferSubscriptionScreen";

function Content() {
  const q = useSearchParams();
  return <TransferSubscriptionScreen entityId={q.get("entity")} fixture={q.get("fixture")} />;
}

export function TransferSubscription() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
