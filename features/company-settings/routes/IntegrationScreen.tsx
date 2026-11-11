"use client";

/**
 * `/entity/<shortid>/<name>/settings/integration` - the company's Xero connection (Figma SET-1,
 * SET-2, SET-2b; owner 2026-11-10). The name, country and currency moved to General the same day.
 * Read by everyone who may see settings (cashier and up), changed by an accountant and up.
 * Disconnecting asks first (SET-2b): Minty carries on, only publishing stops, and the organisation
 * and its matches are kept.
 */

import { useState } from "react";

import { SETTINGS_DANGER_FILL, SETTINGS_OUTLINE } from "@/components/ui/settingsButtons";
import {
  LoadState,
  ReadOnlyNotice,
  SettingsDialog,
  SettingsShell,
} from "@/components/ui/SettingsShell";
import { XeroCard, xeroConnectUrl } from "@/features/company-settings/components/XeroCard";
import { XeroConflictDialog } from "@/features/company-settings/components/XeroConflictDialog";
import { useIntegrationTab } from "@/features/company-settings/hooks/useIntegrationTab";
import { READ_ONLY } from "@/features/company-settings/routes/GeneralScreen";

export const DISCONNECT_COPY = {
  title: "Disconnect from Xero?",
  body: "Minty carries on as normal — reports, petty cash, all of it. They just stop publishing to Xero. Your account matches are kept, so reconnecting later is quicker.",
  cancel: "Cancel",
  confirm: "Disconnect",
  busy: "Disconnecting…",
} as const;

export function IntegrationScreen({
  company,
  flash,
  xeroConflict,
}: {
  company: { id: string; name: string };
  flash: string | null;
  /** The accounts API's hand-over for a Connect it refused: another company holds the organisation. */
  xeroConflict: string | null;
}) {
  const tab = useIntegrationTab(company.id, flash, xeroConflict);
  const [confirming, setConfirming] = useState(false);
  const page = tab.page;
  const shown = page ? { id: page.company.id, name: page.company.name } : company;
  const disconnecting = tab.busy === "disconnect";

  return (
    <SettingsShell company={shown} modules={page?.modules ?? null} tab="integration">
      {tab.status !== "ready" || !page ? (
        <LoadState
          status={tab.status === "error" ? "error" : "loading"}
          error={tab.error}
          onRetry={tab.reload}
        />
      ) : (
        <>
          {page.can_edit ? null : <ReadOnlyNotice>{READ_ONLY}</ReadOnlyNotice>}
          <XeroCard page={page} busy={disconnecting} onDisconnect={() => setConfirming(true)} />
        </>
      )}

      {/* A refused Connect: the organisation is in use, and this is where it can be moved.
          On a successful release the browser leaves for Xero's consent screen, so the dialog
          stays as it is - replacing it with a "done" state nobody would see. */}
      {tab.conflict ? (
        <XeroConflictDialog
          conflict={tab.conflict}
          companyName={shown.name}
          busy={tab.busy === "move"}
          error={tab.moveError}
          onMove={() =>
            void tab.move(tab.conflict!.entity_id).then((freed) => {
              if (freed) window.location.href = xeroConnectUrl(shown.id);
            })
          }
          onClose={tab.dismissConflict}
        />
      ) : null}

      {confirming && page ? (
        <SettingsDialog
          title={DISCONNECT_COPY.title}
          busy={disconnecting}
          onClose={() => setConfirming(false)}
          actions={
            <>
              <button
                type="button"
                className={SETTINGS_OUTLINE}
                disabled={disconnecting}
                onClick={() => setConfirming(false)}
              >
                {DISCONNECT_COPY.cancel}
              </button>
              <button
                type="button"
                className={SETTINGS_DANGER_FILL}
                disabled={disconnecting}
                onClick={() => void tab.disconnect().then((done) => done && setConfirming(false))}
              >
                {disconnecting ? DISCONNECT_COPY.busy : DISCONNECT_COPY.confirm}
              </button>
            </>
          }
        >
          <p>{DISCONNECT_COPY.body}</p>
        </SettingsDialog>
      ) : null}
    </SettingsShell>
  );
}
