"use client";

/**
 * `/entity/<shortid>/<name>/settings/general` - the company's name, country and currency (Figma
 * SET-G, owner 2026-11-10; on Entity & Integration until then). Read by everyone who may see
 * settings (cashier and up), changed by an accountant and up, renamed by an admin. Leaving with
 * changes asks first.
 */

import { createPortal } from "react-dom";

import { LeaveDialog } from "@/components/ui/LeaveDialog";
import { useLeaveGuard } from "@minty/shared/leaveGuard";

import { DetailsForm } from "@/features/company-settings/components/DetailsForm";
import { LoadState, ReadOnlyNotice, SettingsShell } from "@/components/ui/SettingsShell";
import { useDetailsDraft } from "@/features/company-settings/hooks/useDetailsDraft";
import { useIntegrationTab } from "@/features/company-settings/hooks/useIntegrationTab";

export const READ_ONLY =
  "You have view-only access to these settings. Ask an Accountant or Admin to make changes.";

export function GeneralScreen({ company }: { company: { id: string; name: string } }) {
  // The same page model as Integration (`GET /api/me/company/integration`): it carries the
  // company's details, its lists and what this person may change.
  const tab = useIntegrationTab(company.id, null, null);
  const page = tab.page;
  const shown = page ? { id: page.company.id, name: page.company.name } : company;
  // Above the load branch: both hooks are called on every render, whatever the page is doing.
  const draft = useDetailsDraft(page);
  const leave = useLeaveGuard(Boolean(page?.can_edit) && draft.dirty, draft.reset);

  return (
    <SettingsShell company={shown} modules={page?.modules ?? null} tab="general">
      {tab.status !== "ready" || !page ? (
        <LoadState
          status={tab.status === "error" ? "error" : "loading"}
          error={tab.error}
          onRetry={tab.reload}
        />
      ) : (
        <>
          {page.can_edit ? null : <ReadOnlyNotice>{READ_ONLY}</ReadOnlyNotice>}
          {/* The draft follows what the API holds: a save resets the form to it. */}
          <DetailsForm
            page={page}
            draft={draft}
            busy={tab.busy === "save"}
            error={tab.saveError}
            onSave={(changes) => void tab.save(changes)}
          />
        </>
      )}

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
