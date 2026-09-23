"use client";

/**
 * `/subscription` - where Minty's "Subscriptions" link lands, and the design's own landing
 * (Figma 08-A): the account at a glance, with *Manage Subscription* leading to the list (04-A).
 * The query string carries only the dev-only `fixture` switch (A / B / F, the list's frames).
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SubscriptionOverviewScreen } from "@/features/subscription/routes/SubscriptionOverviewScreen";

function Content() {
  const q = useSearchParams();
  return <SubscriptionOverviewScreen fixture={q.get("fixture")} />;
}

export function SubscriptionOverview() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
