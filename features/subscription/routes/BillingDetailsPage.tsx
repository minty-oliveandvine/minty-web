"use client";

/**
 * `/subscription/billing/details?account=` - one billing account's name, email and address
 * (Figma 08-C "Update Billing Information"). Reads the URL here and hands the parameters to the
 * screen; `fixture` is the dev-only switch.
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { BillingDetailsScreen } from "@/features/subscription/routes/BillingDetailsScreen";

function Content() {
  const q = useSearchParams();
  return <BillingDetailsScreen accountId={q.get("account")} fixture={q.get("fixture")} />;
}

export function BillingDetails() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
