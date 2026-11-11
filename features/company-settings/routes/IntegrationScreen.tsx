"use client";

/**
 * `/entity/<shortid>/<name>/settings/integration` - the company's Xero connection (Figma SET-1,
 * SET-2, SET-2b; owner 2026-11-10). The name, country and currency moved to General the same day.
 * Read by everyone who may see settings (cashier and up), changed by an accountant and up.
 * Disconnecting asks first (SET-2b): Minty carries on, only publishing stops, and the organisation
 * and its matches are kept.
 */

import { useState } from "react";

import {
  SETTINGS_DANGER_FILL,
  SETTINGS_OUTLINE,
  SETTINGS_PRIMARY,
} from "@/components/ui/settingsButtons";
import {
  LoadState,
  ReadOnlyNotice,
  SettingsDialog,
  SettingsShell,
} from "@/components/ui/SettingsShell";
import { XeroCard, xeroConnectUrl } from "@/features/company-settings/components/XeroCard";
import { XeroConflictDialog } from "@/features/company-settings/components/XeroConflictDialog";
import { useIntegrationTab } from "@/features/company-settings/hooks/useIntegrationTab";
import { matchingPath } from "@/features/company-settings/lib/paths";
import { READ_ONLY } from "@/features/company-settings/routes/GeneralScreen";

export const DISCONNECT_COPY = {
  title: "Disconnect from Xero?",
  body: "Minty carries on as normal — reports, petty cash, all of it. They just stop publishing to Xero. Your account matches are kept, so reconnecting later is quicker.",
  cancel: "Cancel",
  confirm: "Disconnect",
  busy: "Disconnecting…",
} as const;

/** SET-1b (Settings Phase 2, 2026-11-11): before a Minty company's connect, its accounts need matching. */
export const MATCH_FIRST_COPY = {
  title: "One step before we connect",
  body: (n: number) =>
    `Your accounts live in Minty, so we don't know where each one belongs in Xero yet. After you sign in we'll ask you to match them up - ${n} ${n === 1 ? "row" : "rows"}, a couple of minutes.`,
  notNow: "Not now",
  signIn: "Sign in to Xero",
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
  const [matchFirst, setMatchFirst] = useState(false);
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
          <XeroCard
            page={page}
            busy={disconnecting}
            onDisconnect={() => setConfirming(true)}
            onConnect={() => setMatchFirst(true)}
            matchingHref={matchingPath(shown.id, shown.name)}
          />
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

      {matchFirst && page ? (
        <SettingsDialog
          title={MATCH_FIRST_COPY.title}
          onClose={() => setMatchFirst(false)}
          actions={
            <>
              <button
                type="button"
                className={SETTINGS_OUTLINE}
                onClick={() => setMatchFirst(false)}
              >
                {MATCH_FIRST_COPY.notNow}
              </button>
              <a href={xeroConnectUrl(shown.id)} className={SETTINGS_PRIMARY}>
                {MATCH_FIRST_COPY.signIn}
              </a>
            </>
          }
        >
          <p>{MATCH_FIRST_COPY.body(page.own_accounts ?? 0)}</p>
        </SettingsDialog>
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
