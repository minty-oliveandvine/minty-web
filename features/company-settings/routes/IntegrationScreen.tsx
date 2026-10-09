"use client";

/**
 * `/entity/<shortid>/<name>/settings/integration` - the company's details and its Xero
 * connection (Flask's Entity & Integration tab until phase 2, 2026-10-05). Read by everyone who
 * may see settings (cashier and up), changed by an accountant and up, renamed by an admin.
 * Disconnecting asks first - it was one click on the Jinja page, and it wipes the company's
 * cached Xero data.
 */

import { useState } from "react";
import { createPortal } from "react-dom";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LeaveDialog } from "@/components/ui/LeaveDialog";
import { useLeaveGuard } from "@/lib/leaveGuard";

import { DetailsForm } from "@/features/company-settings/components/DetailsForm";
import { LoadState, ReadOnlyNotice, SettingsCard, SettingsShell } from "@/features/company-settings/components/SettingsShell";
import { XeroCard } from "@/features/company-settings/components/XeroCard";
import { useDetailsDraft } from "@/features/company-settings/hooks/useDetailsDraft";
import { useIntegrationTab } from "@/features/company-settings/hooks/useIntegrationTab";

export const INTEGRATION_COPY = {
  title: "Entity & Integration",
  lead: "The company's details, and its connection to Xero.",
  details: "Company details",
  detailsLead: "Its name, and the country and currency its reports use.",
  xero: "Xero",
  xeroLead: "Where the company's petty cash and payments are published.",
  readOnly: "You have view-only access to these settings. Ask an Accountant or Admin to make changes.",
} as const;

export function IntegrationScreen({ company, flash }: { company: { id: string; name: string }; flash: string | null }) {
  const tab = useIntegrationTab(company.id, flash);
  const [confirming, setConfirming] = useState(false);
  const page = tab.page;
  const shown = page ? { id: page.company.id, name: page.company.name } : company;
  // Above the load branch: both hooks are called on every render, whatever the page is doing.
  const draft = useDetailsDraft(page);
  const leave = useLeaveGuard(Boolean(page?.can_edit) && draft.dirty, draft.reset);

  return (
    <SettingsShell company={shown} modules={page?.modules ?? null} tab="integration" title={INTEGRATION_COPY.title} lead={INTEGRATION_COPY.lead}>
      {tab.status !== "ready" || !page ? (
        <LoadState status={tab.status === "error" ? "error" : "loading"} error={tab.error} onRetry={tab.reload} />
      ) : (
        <>
          {page.can_edit ? null : <ReadOnlyNotice>{INTEGRATION_COPY.readOnly}</ReadOnlyNotice>}
          <SettingsCard title={INTEGRATION_COPY.details} lead={INTEGRATION_COPY.detailsLead} readOnly={!page.can_edit}>
            {/* The draft follows what Flask holds: a save or a disconnect resets the form to it. */}
            <DetailsForm
              page={page}
              draft={draft}
              busy={tab.busy === "save"}
              error={tab.saveError}
              onSave={(changes) => void tab.save(changes)}
            />
          </SettingsCard>
          <SettingsCard title={INTEGRATION_COPY.xero} lead={INTEGRATION_COPY.xeroLead} readOnly={!page.can_edit}>
            <XeroCard page={page} busy={tab.busy === "disconnect"} onDisconnect={() => setConfirming(true)} />
          </SettingsCard>
        </>
      )}

      {confirming && page ? (
        <ConfirmDialog
          title="Disconnect from Xero?"
          image="dont"
          entityName={page.company.name}
          busy={tab.busy === "disconnect"}
          confirmLabel="Disconnect"
          confirmTone="red"
          onConfirm={() => void tab.disconnect().then((done) => done && setConfirming(false))}
          onBack={() => setConfirming(false)}
        >
          <p className="mt-6 text-[15px] leading-snug">
            Nothing more is published to Xero until you connect again, and the Xero accounts and contacts kept for this company
            are cleared.
          </p>
        </ConfirmDialog>
      ) : null}

      {/* Over the sidebar drawer (z-200) and any other modal (z-150): a link in the drawer asks
          too, and the answer must not be painted under what raised it. `data-leave-dialog` is
          what the guard reads to leave a link inside the dialog alone. */}
      {leave.open
        ? createPortal(
            <div data-leave-dialog="" className="relative z-[250]">
              <LeaveDialog onDiscard={leave.discard} onStay={leave.stay} />
            </div>,
            document.body,
          )
        : null}
    </SettingsShell>
  );
}
