"use client";

/**
 * `/subscription/billing` - one billing account's page (Figma section 08, 08-B). The query
 * string carries `account` (which one; `entity` instead names "the account this company is on",
 * and with neither it is the payer's oldest), `added` (the card the add-card screen just saved,
 * so the page can say what happened - 08-N / 08-S) and the dev-only `fixture` switch (B / H / I
 * / J / N, see the hook).
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { BillingPageScreen } from "@/features/subscription/routes/BillingPageScreen";

function Content() {
  const q = useSearchParams();
  return (
    <BillingPageScreen
      accountId={q.get("account")}
      entity={q.get("entity")}
      addedId={q.get("added")}
      fixture={q.get("fixture")}
    />
  );
}

export function BillingPage() {
  return (
    <Suspense>
      <Content />
    </Suspense>
  );
}
