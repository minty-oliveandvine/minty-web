"use client";

/**
 * `/subscription` and `/subscription/subscriptions` - the payer portal's Manage Subscriptions
 * list (billing-frontend's /profile/subscriptions, re-homed and redrawn to Figma section 04).
 * The query string carries `entity` (the company to bring into view - the module page's
 * *Manage Subscription* lands here) and `fixture` (dev only - see the hook).
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ManageSubscriptionsScreen } from "@/features/subscription/routes/ManageSubscriptionsScreen";

function Content() {
  const q = useSearchParams();
  return <ManageSubscriptionsScreen focusEntityId={q.get("entity")} fixture={q.get("fixture")} />;
}

export function ManageSubscriptions() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
