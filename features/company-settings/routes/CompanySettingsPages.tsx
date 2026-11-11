"use client";

/**
 * The feature's three routes, as `app/entity/[ref]/[slug]/settings/{users,general,integration}` mount
 * them: the company from the address (`components/ui/CompanyFromAddress`), and `?flash=` - what
 * Flask flashed on the way here (a Xero reconnect's outcome, a refusal) - read once.
 * `useSearchParams` needs a Suspense boundary or `next build` refuses the page.
 */

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { CompanyFromAddress } from "@/components/ui/CompanyFromAddress";

import {
  generalPath,
  integrationPath,
  matchingPath,
  usersPath,
} from "@/features/company-settings/lib/paths";
import { GeneralScreen } from "@/features/company-settings/routes/GeneralScreen";
import { IntegrationScreen } from "@/features/company-settings/routes/IntegrationScreen";
import { MatchingScreen } from "@/features/company-settings/routes/MatchingScreen";
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
    <CompanyFromAddress pathOf={integrationPath} label="integration">
      {(company) => (
        <IntegrationScreen company={company} flash={flash} xeroConflict={xeroConflict} />
      )}
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

// No `?flash=` here: everything the accounts API flashes on the way back (a Xero connect's outcome)
// lands on Integration.
export function CompanyGeneralPage() {
  return (
    <CompanyFromAddress pathOf={generalPath} label="general">
      {(company) => <GeneralScreen company={company} />}
    </CompanyFromAddress>
  );
}

/** Match your accounts to Xero (Settings Phase 2, 2026-11-11). */
export function CompanyMatchingPage() {
  return (
    <CompanyFromAddress pathOf={matchingPath} label="matching">
      {(company) => <MatchingScreen company={company} />}
    </CompanyFromAddress>
  );
}

export function CompanyIntegrationPage() {
  return (
    <Suspense>
      <IntegrationContent />
    </Suspense>
  );
}
