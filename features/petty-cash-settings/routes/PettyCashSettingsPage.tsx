"use client";

/**
 * The feature's route, as `app/entity/[ref]/[slug]/settings/petty-cash` mounts it: the company
 * from the address (`components/ui/CompanyFromAddress`), then the tab.
 */

import { CompanyFromAddress } from "@/components/ui/CompanyFromAddress";

import { pettyCashSettingsPath } from "@/features/petty-cash-settings/lib/paths";
import { PettyCashSettingsScreen } from "@/features/petty-cash-settings/routes/PettyCashSettingsScreen";

export function CompanyPettyCashSettingsPage() {
  return (
    <CompanyFromAddress pathOf={pettyCashSettingsPath} label="petty cash settings">
      {(company) => <PettyCashSettingsScreen company={company} />}
    </CompanyFromAddress>
  );
}
