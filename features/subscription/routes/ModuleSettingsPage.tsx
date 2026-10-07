"use client";

/**
 * `/entity/[ref]/[slug]/settings/modules` - Flask's settings/modules, re-homed, addressed by the
 * company's short id and name (`lib/companyRef.ts`; under `/entities` since phase 2, 2026-10-05 -
 * the old `/subscription/entities/…/modules` addresses move here in proxy.ts). The company comes
 * from the address (`components/ui/CompanyFromAddress.tsx`). The query string carries only
 * `fixture` (dev only - see the hook); the way back is the page the person came from
 * (components/ui/BackLink.tsx). Nothing returns here from Stripe.
 *
 * `useSearchParams` needs a Suspense boundary or `next build` refuses the page.
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { CompanyFromAddress } from "@/components/ui/CompanyFromAddress";

import { modulesPath } from "@/features/subscription/lib/paths";
import { ModuleSettingsScreen } from "@/features/subscription/routes/ModuleSettingsScreen";

function ModuleSettingsContent() {
  const q = useSearchParams();
  return (
    <CompanyFromAddress pathOf={modulesPath} label="module settings">
      {(company) => <ModuleSettingsScreen entityId={company.id} fixture={q.get("fixture")} />}
    </CompanyFromAddress>
  );
}

export function ModuleSettingsPage() {
  return (
    <Suspense>
      <ModuleSettingsContent />
    </Suspense>
  );
}
