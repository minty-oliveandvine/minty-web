/**
 * The company's Xero connection (Figma SET-1 / SET-2, owner 2026-11-10): the Xero mark, what the
 * connection means for the company and its state pill; under a hairline, when it was last
 * connected and the organisation; then the one thing to do about it.
 *
 * Four states. Two are drawn in the frames; the other two fill gaps the frames leave:
 * - **Not connected** (SET-1): never connected, or connected once with no organisation kept.
 *   Connect to Xero, and the service team's offer under it.
 * - **Connected** (SET-2): where it publishes; Disconnect from Xero (asks first: SET-2b).
 * - **Disconnected** (filled in): disconnected here, so the organisation, its chart and contacts
 *   are KEPT (accounts-api `xero/services/disconnect.py`, Xero optional 2026-11-10). Reconnect;
 *   nothing left to disconnect.
 * - **Reconnect needed** (filled in): still connected, but Xero no longer accepts Minty's sign-in.
 *   Reconnect, and Disconnect stays possible.
 * - **Matching not finished** (Settings Phase 2, 2026-11-11): a company that kept its books in Minty
 *   signed in to Xero, and its accounts (or, after Finish, some suppliers) aren't matched yet.
 *   Continue matching. Its Connect first asks (SET-1b, `onConnect`): its accounts need matching.
 *   Phase 3 (2026-11-12): the line names why - a new organisation, accounts added while
 *   disconnected - and a change of the matches is "Changing your matches" (publishing goes on).
 *   A connected company's card offers **Change matches** (`onChangeMatches`).
 *
 * Connect and Reconnect are NAVIGATIONS to the accounts API's OAuth start (through `/enter`, so
 * its session is the token's person): Xero comes back to it, and it comes back here with what
 * happened.
 */

import { formatInstantDay } from "@minty/shared/dates";

import { mintyEntryUrl } from "@/lib/mintyEntry";

import type { IntegrationPage } from "@/features/company-settings/api/companySettings";
import { SETTINGS_DANGER, SETTINGS_PRIMARY } from "@/components/ui/settingsButtons";

type State = "off" | "connected" | "disconnected" | "reconnect" | "matching";

const PILL: Record<State, { text: string; className: string }> = {
  off: { text: "Not connected", className: "bg-set-pill text-set-ink-2" },
  connected: { text: "Connected", className: "bg-set-ok-bg text-set-ok-ink" },
  disconnected: { text: "Disconnected", className: "bg-set-pill text-set-ink-2" },
  reconnect: { text: "Reconnect needed", className: "bg-set-warn-bg text-danger" },
  matching: { text: "Matching", className: "bg-[#fff8ee] text-[#9a5b00]" },
};

export const XERO_COPY = {
  offTitle: "Not connected to Xero",
  offLine: "Reports stay in Minty until you connect.",
  connectedTitle: "Connected to Xero",
  connectedLine: (org: string) => `Reports and petty cash publish to ${org} in Xero.`,
  disconnectedTitle: "Disconnected from Xero",
  reconnectTitle: "Xero needs you to sign in again",
  waitingLine: (org: string) => `Nothing is published to ${org} until you reconnect.`,
  lastConnected: "Last connected",
  never: "Never",
  organisation: "Xero organisation",
  noneYet: "None yet",
  connect: "Connect to Xero",
  reconnect: "Reconnect to Xero",
  disconnect: "Disconnect from Xero",
  matchingTitle: "Matching isn't finished",
  matchingLine: "Your accounts stay in Minty until you finish matching them to Xero.",
  newOrgLine: "Your new Xero organisation needs your accounts matched.",
  newAccountsLine:
    "Some accounts were added while Xero was disconnected. Match them to finish reconnecting.",
  changeTitle: "Changing your matches",
  changeLine: "Publishing goes on meanwhile; the new matches apply once you finish.",
  continueMatching: "Continue matching",
  continueChanging: "Continue changing",
  changeMatches: "Change matches",
  help: "Prefer some help first? Our service team can set up the Xero connection with you.",
} as const;

export function xeroConnectUrl(entityId: string): string {
  return mintyEntryUrl(`/xero_reconnect?entity_id=${encodeURIComponent(entityId)}`, entityId);
}

function xeroState(page: IntegrationPage): State {
  const { xero } = page;
  if (page.matching?.accounts || page.matching?.contacts) return "matching";
  if (xero.connected) return "connected";
  if (xero.needs_reconnect && xero.organisation) {
    return xero.status === "disconnected" ? "disconnected" : "reconnect";
  }
  return "off";
}

function day(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : formatInstantDay(d) || null;
}

/** A company that keeps its books in Minty, with its own accounts: its connect matches them first. */
export function connectNeedsMatching(page: IntegrationPage): boolean {
  return page.setup_mode === "minty" && (page.own_accounts ?? 0) > 0;
}

export function XeroCard({
  page,
  busy,
  onDisconnect,
  onConnect,
  matchingHref,
  onChangeMatches,
}: {
  page: IntegrationPage;
  busy: boolean;
  onDisconnect: () => void;
  /** SET-1b: asked instead of going straight to Xero, when the accounts need matching. */
  onConnect?: () => void;
  /** Where Continue matching goes. */
  matchingHref?: string;
  /** Phase 3: start changing the matches (a connected company). */
  onChangeMatches?: () => void;
}) {
  const { xero } = page;
  const state = xeroState(page);
  const pill = PILL[state];
  const org = xero.organisation ?? "";
  const reason = page.matching?.reason ?? null;
  const [title, line] =
    state === "matching"
      ? reason === "change"
        ? [XERO_COPY.changeTitle, XERO_COPY.changeLine]
        : [
            XERO_COPY.matchingTitle,
            reason === "new_org"
              ? XERO_COPY.newOrgLine
              : reason === "new_accounts"
                ? XERO_COPY.newAccountsLine
                : XERO_COPY.matchingLine,
          ]
      : state === "connected"
        ? [XERO_COPY.connectedTitle, XERO_COPY.connectedLine(org)]
        : state === "disconnected"
          ? [XERO_COPY.disconnectedTitle, XERO_COPY.waitingLine(org)]
          : state === "reconnect"
            ? [XERO_COPY.reconnectTitle, XERO_COPY.waitingLine(org)]
            : [XERO_COPY.offTitle, XERO_COPY.offLine];
  const canConnect = page.can_edit && state !== "connected" && state !== "matching";
  const asksFirst = onConnect !== undefined && connectNeedsMatching(page);
  const canDisconnect = page.can_edit && (state === "connected" || state === "reconnect");
  const canChange = page.can_edit && state === "connected" && onChangeMatches !== undefined;

  return (
    <section
      className={`flex min-w-0 flex-col gap-4 rounded-[14px] border border-set-edge p-5 sm:p-6 ${page.can_edit ? "bg-white" : "bg-set-pill"}`}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3.5 gap-y-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- a 40px static mark, as drawn */}
        <img src="/settings/xero-mark.svg" alt="" width={40} height={40} className="shrink-0" />
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
          <h3 className="text-lg font-bold text-set-ink">{title}</h3>
          <p className="text-[13.5px] text-set-ink-2">{line}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${pill.className}`}
        >
          {pill.text}
        </span>
      </div>
      <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-set-line pt-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[12.5px] font-medium text-set-mute">{XERO_COPY.lastConnected}</dt>
          <dd className="text-[14.5px] font-semibold text-set-ink">
            {day(xero.last_connected_at) ?? XERO_COPY.never}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[12.5px] font-medium text-set-mute">{XERO_COPY.organisation}</dt>
          <dd className="break-words text-[14.5px] font-semibold text-set-ink">
            {xero.organisation ?? XERO_COPY.noneYet}
          </dd>
        </div>
      </dl>
      {canConnect || canDisconnect || (state === "matching" && page.can_edit) ? (
        <div className="flex flex-wrap items-center gap-3">
          {state === "matching" && page.can_edit && matchingHref ? (
            <a href={matchingHref} className={SETTINGS_PRIMARY}>
              {reason === "change" ? XERO_COPY.continueChanging : XERO_COPY.continueMatching}
            </a>
          ) : null}
          {canChange ? (
            <button
              type="button"
              onClick={onChangeMatches}
              disabled={busy}
              className={SETTINGS_PRIMARY}
            >
              {XERO_COPY.changeMatches}
            </button>
          ) : null}
          {canConnect && asksFirst ? (
            <button type="button" onClick={onConnect} className={SETTINGS_PRIMARY}>
              {state === "off" && !xero.last_connected_at ? XERO_COPY.connect : XERO_COPY.reconnect}
            </button>
          ) : canConnect ? (
            <a href={xeroConnectUrl(page.company.id)} className={SETTINGS_PRIMARY}>
              {state === "off" && !xero.last_connected_at ? XERO_COPY.connect : XERO_COPY.reconnect}
            </a>
          ) : null}
          {canDisconnect ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={busy}
              className={SETTINGS_DANGER}
            >
              {XERO_COPY.disconnect}
            </button>
          ) : null}
        </div>
      ) : null}
      {state === "connected" ? null : <p className="text-[13px] text-set-mute">{XERO_COPY.help}</p>}
    </section>
  );
}
