"use client";

/**
 * The feature's two routes, as `app/entity/[ref]/[slug]/settings/{users,integration}` mount
 * them: the company from the address (`components/ui/CompanyFromAddress`), and `?flash=` - what
 * Flask flashed on the way here (a Xero reconnect's outcome, a refusal) - read once.
 * `useSearchParams` needs a Suspense boundary or `next build` refuses the page.
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { CompanyFromAddress } from "@/components/ui/CompanyFromAddress";

import { integrationPath, usersPath } from "@/features/company-settings/lib/paths";
import { IntegrationScreen } from "@/features/company-settings/routes/IntegrationScreen";
import { UsersScreen } from "@/features/company-settings/routes/UsersScreen";

function UsersContent() {
  const flash = useSearchParams().get("flash");
  return (
    <CompanyFromAddress pathOf={usersPath} label="users">
      {(company) => <UsersScreen company={company} flash={flash} />}
    </CompanyFromAddress>
  );
}

function IntegrationContent() {
  const params = useSearchParams();
  const flash = params.get("flash");
  // The other half of a refused Xero connect: the notice says what happened, this says which
  // company holds the organisation, so the tab can offer to move it.
  const xeroConflict = params.get("xero_conflict");
  return (
    <CompanyFromAddress pathOf={integrationPath} label="entity & integration">
      {(company) => <IntegrationScreen company={company} flash={flash} xeroConflict={xeroConflict} />}
    </CompanyFromAddress>
  );
}

export function CompanyUsersPage() {
  return (
    <Suspense>
      <UsersContent />
    </Suspense>
  );
}

export function CompanyIntegrationPage() {
  return (
    <Suspense>
      <IntegrationContent />
    </Suspense>
  );
}
