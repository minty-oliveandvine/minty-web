"use client";

/**
 * `/entity/[ref]/[slug]` - a company's module choice, addressed by its short id and name
 * (`@minty/shared/companyRef`); the company comes from the address (`components/ui/CompanyFromAddress`).
 */

import { companyPath } from "@minty/shared/companyRef";

import { CompanyFromAddress } from "@/components/ui/CompanyFromAddress";

import { ModuleChoiceScreen } from "@/features/entities/routes/ModuleChoiceScreen";

const choicePath = (entityId: string, entityName: string) => companyPath(entityId, entityName);

export function ModuleChoice() {
  return (
    <CompanyFromAddress pathOf={choicePath} label="module choice">
      {(company) => <ModuleChoiceScreen entityId={company.id} entityName={company.name} />}
    </CompanyFromAddress>
  );
}
