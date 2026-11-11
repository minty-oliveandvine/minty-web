"use client";

/**
 * The feature's route, as `app/entity/[ref]/[slug]/settings/payment` mounts it: the company from
 * the address (`components/ui/CompanyFromAddress`, which hands over for a token of that company
 * first), then the screen.
 */

import { CompanyFromAddress } from "@/components/ui/CompanyFromAddress";

import { paymentSettingsPath } from "@/features/payment-settings/lib/paths";
import { PaymentSettingsScreen } from "@/features/payment-settings/routes/PaymentSettingsScreen";

export function CompanyPaymentSettingsPage() {
  return (
    <CompanyFromAddress pathOf={paymentSettingsPath} label="payment settings">
      {(company) => <PaymentSettingsScreen company={company} />}
    </CompanyFromAddress>
  );
}
