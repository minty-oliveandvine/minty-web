"use client";

/**
 * `/subscription/billing/add` and `/subscription/billing/edit?card=<pm>` - the billing page's
 * two card screens (Figma 08-Y and 08-D). Both read the URL here and hand the parameters to
 * the screens; `fixture` is the dev-only switch.
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { AddCardScreen, EditCardScreen } from "@/features/subscription/routes/CardScreens";

function AddContent() {
  const q = useSearchParams();
  return <AddCardScreen fixture={q.get("fixture")} />;
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
  return <EditCardScreen cardId={q.get("card")} fixture={q.get("fixture")} />;
}

export function EditCard() {
  return (
    <Suspense>
      <EditContent />
    </Suspense>
  );
}
