"use client";

/**
 * `/subscription/billing/add?account=` and `/subscription/billing/edit?card=<pm>&account=` - the
 * billing account's card screens (Figma 08-Y and 08-D). Both read the URL here and hand the
 * parameters to the screens; `fixture` is the dev-only switch. (A NEW account is not a page: it
 * opens in onboarding's sheet over 08-A or 08-B - `BillingAccountDialogs`.)
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AddCardScreen, EditCardScreen } from "@/features/subscription/routes/CardScreens";

function AddContent() {
  const q = useSearchParams();
  return <AddCardScreen accountId={q.get("account")} fixture={q.get("fixture")} />;
}

export function AddCard() {
  return (
    <Suspense>
      <AddContent />
    </Suspense>
  );
}

function EditContent() {
  const q = useSearchParams();
  return (
    <EditCardScreen
      cardId={q.get("card")}
      accountId={q.get("account")}
      fixture={q.get("fixture")}
    />
  );
}

export function EditCard() {
  return (
    <Suspense>
      <EditContent />
    </Suspense>
  );
}
