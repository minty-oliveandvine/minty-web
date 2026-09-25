"use client";

/**
 * `/subscription` - where Minty's "Subscriptions" link lands, and the design's own landing
 * (Figma 08-A): one billing account at a glance, with *Manage Subscription* leading to the list
 * (04-A). The query string carries `account` (which billing account the card shows; none = the
 * oldest) and the dev-only `fixture` switch (A / B / F, the list's frames).
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SubscriptionOverviewScreen } from "@/features/subscription/routes/SubscriptionOverviewScreen";

function Content() {
  const q = useSearchParams();
  return (
    <SubscriptionOverviewScreen accountId={q.get("account")} fixture={q.get("fixture")} />
  );
}

export function SubscriptionOverview() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
