/**
 * The module choice of one company (phase 2, 2026-10-05 - it was minty-payment-request-web's
 * `/module-selection`): which modules it offers and where each one goes.
 *
 * The modules are the DATABASE's, from the entity list's row (`modules`, fail-closed on Flask's
 * side) - never the token's claims, which can be half an hour stale. Each module is entered
 * through Minty's `/entity/<id>/enter` (`lib/mintyEntry.ts`): Flask rebuilds its session from the
 * token and goes on - to Petty Cash's dashboard, or to `/entity/<id>/payment-request`, which mints
 * the payments app's token and sends the browser there.
 */

import { mintyEntryUrl } from "@/lib/mintyEntry";

export type ModuleChoice = {
  code: "PETTY_CASH" | "PAYMENT_REQUEST";
  label: string;
  href: string;
};

export function moduleChoices(entityId: string, modules: readonly string[]): ModuleChoice[] {
  const id = encodeURIComponent(entityId);
  const choices: ModuleChoice[] = [];
  if (modules.includes("PETTY_CASH")) {
    choices.push({ code: "PETTY_CASH", label: "Petty Cash", href: mintyEntryUrl(`/entity/${id}/petty-cash`, entityId) });
  }
  if (modules.includes("PAYMENT_REQUEST")) {
    choices.push({
      code: "PAYMENT_REQUEST",
      label: "Payment Request",
      href: mintyEntryUrl(`/entity/${id}/payment-request`, entityId),
    });
  }
  return choices;
}
