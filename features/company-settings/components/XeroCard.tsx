/**
 * The company's Xero connection: its state (Connected / Reconnect needed / Not connected), the
 * Xero organisation and when it was last connected (kept through a disconnect, "N/A" if never), and
 * the way to change it - Reconnect once it has ever been connected. Connect and Reconnect are
 * NAVIGATIONS to Minty's OAuth start (through `/enter`, so Flask's session is the token's person):
 * Xero comes back to Flask, which comes back here with what happened. Disconnect asks first.
 */

import { mintyEntryUrl } from "@/lib/mintyEntry";

import type { IntegrationPage } from "@/features/company-settings/api/companySettings";
import {
  SETTINGS_DANGER,
  SETTINGS_PRIMARY,
} from "@/features/company-settings/components/buttonClasses";

const BADGE: Record<"connected" | "reconnect" | "off", { text: string; className: string }> = {
  connected: { text: "Connected", className: "bg-[#eefbfb] text-[#1b9aa0]" },
  reconnect: { text: "Reconnect needed", className: "bg-[#fff5f5] text-danger" },
  off: { text: "Not connected", className: "bg-gray-100 text-gray-600" },
};

export function xeroConnectUrl(entityId: string): string {
  return mintyEntryUrl(`/xero_reconnect?entity_id=${encodeURIComponent(entityId)}`, entityId);
}

function when(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.className}`}
        >
          {badge.text}
        </span>
        {xero.organisation ? (
          <p className="mt-2 truncate font-medium text-gray-900">{xero.organisation}</p>
        ) : null}
        <p className="text-sm text-gray-500">Last connected: {since ?? "N/A"}</p>
        {state === "reconnect" ? (
          <p className="mt-1 text-sm text-danger">
            This company has been disconnected from Xero. Reconnect it to keep your data in sync.
          </p>
        ) : null}
      </div>
      {page.can_edit ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          {state === "connected" ? null : (
            <a href={xeroConnectUrl(page.company.id)} className={SETTINGS_PRIMARY}>
              {state === "reconnect" || xero.last_connected_at
                ? "Reconnect to Xero"
                : "Connect to Xero"}
            </a>
          )}
          {state === "off" ? null : (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={busy}
              className={`${SETTINGS_DANGER} border border-gray-300`}
            >
              Disconnect
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
