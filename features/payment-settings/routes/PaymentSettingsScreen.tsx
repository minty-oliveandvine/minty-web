"use client";

/**
 * `/entity/<shortid>/<name>/settings/payment` - the Payment Request module's settings, the
 * account-code card (moved in from minty-payment-request-web, owner 2026-11-10). The hub's
 * settings page draws the company, "Settings" and the tab row; the tabs shown follow the token's
 * module claims (this tab's API holds no module list).
 */

import { SettingsShell } from "@/components/ui/SettingsShell";

import { AccountCodeSettings } from "@/features/payment-settings/components/AccountCodeSettings";

export function PaymentSettingsScreen({ company }: { company: { id: string; name: string } }) {
  return (
    <SettingsShell company={company} modules={null} tab="payment">
      <AccountCodeSettings company={company} />
    </SettingsShell>
  );
}
