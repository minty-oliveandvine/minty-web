"use client";

/**
 * `/subscription/entities/[entityId]/modules` - Flask's `/entity/settings/module/<org_id>`,
 * re-homed. `app/subscription/entities/[entityId]/modules/page.tsx` re-exports this, so the
 * route parameters are read here, on the client (a page taking `params` could not be a one-line
 * re-export). The query string carries how the page was entered: `from=bills` (the payments
 * app sent the person, and gets them back) and `fixture` (dev only - see the hook). Nothing
 * returns here from Stripe: no page in the app hands the browser to a Stripe-hosted page.
 *
 * `useSearchParams` needs a Suspense boundary or `next build` refuses the page.
 */

import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ModuleSettingsScreen } from "@/features/subscription/routes/ModuleSettingsScreen";

function ModuleSettingsContent() {
  const { entityId } = useParams<{ entityId: string }>();
  const q = useSearchParams();

  return (
    <ModuleSettingsScreen
      entityId={entityId}
      from={q.get("from") === "bills" ? "bills" : null}
      fixture={q.get("fixture")}
    />
  );
}

export function ModuleSettingsPage() {
  return (
    <Suspense>
      <ModuleSettingsContent />
    </Suspense>
  );
}
