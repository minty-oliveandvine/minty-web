/**
 * The company's Xero connection: its state (Connected / Reconnect needed / Not connected), the
 * Xero organisation and when it was connected, and the way to change it. Connect and Reconnect are
 * NAVIGATIONS to Minty's OAuth start (through `/enter`, so Flask's session is the token's person):
 * Xero comes back to Flask, which comes back here with what happened. Disconnect asks first.
 */

import { mintyEntryUrl } from "@/lib/mintyEntry";

import type { IntegrationPage } from "@/features/company-settings/api/companySettings";

const BADGE: Record<"connected" | "reconnect" | "off", { text: string; className: string }> = {
  connected: { text: "Connected", className: "bg-[#eefbfb] text-[#1b9aa0]" },
  reconnect: { text: "Reconnect needed", className: "bg-[#fff5f5] text-danger" },
  off: { text: "Not connected", className: "bg-gray-100 text-gray-600" },
};

const ACTION =
  "inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-strong";

export function xeroConnectUrl(entityId: string): string {
  return mintyEntryUrl(`/xero_reconnect?entity_id=${encodeURIComponent(entityId)}`, entityId);
}

function when(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function XeroCard({
  page,
  busy,
  onDisconnect,
}: {
  page: IntegrationPage;
  busy: boolean;
  onDisconnect: () => void;
}) {
  const { xero } = page;
  const state = xero.needs_reconnect ? "reconnect" : xero.connected ? "connected" : "off";
  const badge = BADGE[state];
  const since = when(xero.last_connected_at);
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}>{badge.text}</span>
        {xero.organisation ? <p className="mt-2 truncate font-medium text-gray-900">{xero.organisation}</p> : null}
        {since && state !== "off" ? <p className="text-sm text-gray-500">Connected {since}</p> : null}
        {state === "reconnect" ? (
          <p className="mt-1 text-sm text-danger">This company has been disconnected from Xero. Reconnect it to keep your data in sync.</p>
        ) : null}
      </div>
      {page.can_edit ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          {state === "connected" ? null : (
            <a href={xeroConnectUrl(page.company.id)} className={`${ACTION} bg-secondary text-white hover:bg-teal-strong`}>
              {state === "reconnect" ? "Reconnect to Xero" : "Connect to Xero"}
            </a>
          )}
          {state === "off" ? null : (
            <button type="button" onClick={onDisconnect} disabled={busy} className={`${ACTION} border border-gray-300 text-red-600 hover:bg-red-50 disabled:opacity-50`}>
              Disconnect
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
