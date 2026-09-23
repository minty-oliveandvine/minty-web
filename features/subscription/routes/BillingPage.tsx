"use client";

/**
 * `/subscription/billing` - the billing page (Figma section 08). The query string carries
 * `added` (the card the add-card screen just saved, so the page can say what happened - 08-N /
 * 08-S) and the dev-only `fixture` switch (B / H / I / J / N, see the hook).
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { BillingPageScreen } from "@/features/subscription/routes/BillingPageScreen";

function Content() {
  const q = useSearchParams();
  return <BillingPageScreen addedId={q.get("added")} fixture={q.get("fixture")} />;
}

export function BillingPage() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
