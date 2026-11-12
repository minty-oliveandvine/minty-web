"use client";

/**
 * Payment Settings' one card: which of the company's account codes the Add Payment dialog offers
 * (`entity_bill_account_xero.is_active`). Moved from minty-payment-request-web's
 * `components/settings/AccountCodeSettings.tsx` (owner, 2026-11-10) with its behaviour, calls and
 * words; only the look is the hub's Settings frames (Figma 353:999).
 *
 * - The codes are the company's Xero chart: without a live connection the card shows only the way
 *   to Integration, and the codes are not read at all (nor the chart re-sync that read starts). A
 *   company keeping its books in Minty (`minty_only`) has codes of its own, read as if live.
 * - Save is off with nothing to save, and off with nothing ticked (the API refuses to untick the
 *   last code - 409); a save sends the rows turning ON first, then OFF, so it never passes through
 *   a moment with nothing ticked. Each row that went through is saved, whatever the others did.
 * - Elevated roles change them (`lib/role.ts`); everyone else sees them read-only, told why.
 * - Ticks not saved yet hold every way out of the page ("Leave without saving?").
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { XeroNotConnected } from "@/components/ui/XeroNotConnected";
import { LeaveDialog } from "@/components/ui/LeaveDialog";
import { SETTINGS_PRIMARY } from "@/components/ui/settingsButtons";
import { SETTINGS_INPUT, SETTINGS_INPUT_OK } from "@/components/ui/settingsFields";
import { ReadOnlyNotice, SettingsCard } from "@/components/ui/SettingsShell";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/apiClient";
import { useLeaveGuard } from "@minty/shared/leaveGuard";

import {
  fetchConnection,
  fetchRights,
  fetchEntityBillAccounts,
  updateEntityBillAccount,
} from "@/features/payment-settings/api/paymentSettings";
import { integrationPath } from "@/features/payment-settings/lib/paths";

export const PAYMENT_SETTINGS_COPY = {
  title: "Payment Account Code",
  lead: "Only the ticked account codes appear when you add a payment request.",
  viewOnly: "Read-only access — you are not a member of this entity.",
  readOnly:
    "You have view-only access to these settings. Ask an Accountant or Admin to make changes.",
  search: "Search account code",
  selectAll: "Select all",
  selectAllLabel: "Select all visible account codes",
  loadFailed: "I couldn't load your account codes. Mind refreshing the page?",
  empty: "No account codes yet. Your company's expense accounts show here once they're added.",
  noMatch: "No codes match your search.",
  save: "Save Changes",
  saving: "Saving…",
  unchanged: "No changes to save yet",
  noneTicked: "Pick at least one account code.",
  saved: "Payment settings updated successfully",
  someFailed: "Some of those changes didn't save. Mind trying again?",
  titleViewOnly: "Hmm, I can't let you in there. You have view-only access.",
  titleReadOnly: "That task is reserved for our Accountants and Admins.",
} as const;

const CHECKBOX =
  "h-5 w-5 shrink-0 cursor-pointer accent-set-tab disabled:cursor-not-allowed disabled:opacity-40";
/** A whole row is the tap target (at least 44px), not only the box. */
const ROW = "flex min-h-11 items-center justify-between gap-3 px-3 py-2.5 sm:px-4";

type AccountCodeRow = { id: string; label: string };

export function AccountCodeSettings({ company }: { company: { id: string; name: string } }) {
  // What the API says this person may do (owner, 2026-11-12) - never a role read from the token.
  // Read-only until it answers.
  const [{ canEdit, viewOnly: isViewOnly }, setRights] = useState({
    canEdit: false,
    viewOnly: false,
  });
  const readOnly = !canEdit;
  const [rows, setRows] = useState<AccountCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Null until the status is known; false shows only the way to connect.
  const [xeroConnected, setXeroConnected] = useState<boolean | null>(null);
  const { showToast } = useToast();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const entityId = company.id;

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchConnection(entityId), fetchRights(entityId)])
      .then(([{ connected: live, mintyOnly }, rights]) => {
        if (cancelled) return;
        setRights(rights);
        // a company keeping its books in Minty (Xero optional, 2026-11-10): its codes are its own
        setXeroConnected(live || mintyOnly);
        // the codes are the stored ones, read with or without Xero (owner, 2026-11-12); only a
        // live connection re-syncs the chart
        return fetchEntityBillAccounts(entityId, { sync: live }).then((accounts) => {
          if (cancelled) return;
          setRows(
            accounts.map((a) => ({ id: a.id, label: `${a.account_code} - ${a.account_name}` })),
          );
          const activeIds = new Set(accounts.filter((a) => a.is_active).map((a) => a.id));
          setSelectedIds(activeIds);
          setSavedIds(activeIds);
        });
      })
      .catch((err: unknown) => {
        // A failed read is not an empty list (nor "not connected"): say so.
        console.error("[payment settings] the account codes did not load", err);
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  const hasChanges = useMemo(() => {
    if (selectedIds.size !== savedIds.size) return true;
    for (const id of selectedIds) if (!savedIds.has(id)) return true;
    return false;
  }, [selectedIds, savedIds]);

  // A save that went through makes `savedIds` the ticks, so `hasChanges` clears and the guard
  // stands down; a failed one leaves `savedIds` alone, so the page still asks.
  const discardTicks = useCallback(() => setSelectedIds(new Set(savedIds)), [savedIds]);
  const leave = useLeaveGuard(hasChanges, discardTicks);

  const changedIds = useMemo(() => {
    const ids: { id: string; is_active: boolean }[] = [];
    for (const row of rows) {
      const wasActive = savedIds.has(row.id);
      const isActive = selectedIds.has(row.id);
      if (wasActive !== isActive) ids.push({ id: row.id, is_active: isActive });
    }
    return ids;
  }, [rows, selectedIds, savedIds]);

  // The server refuses to untick its last ticked code (409), so the page never offers it.
  const noneTicked = rows.length > 0 && selectedIds.size === 0;

  const handleSave = async () => {
    if (!hasChanges || saving || noneTicked) return;
    setSaving(true);
    try {
      // Ticks ON first, then OFF: unticking A while ticking B must never pass through a moment
      // with nothing ticked, or the server's at-least-one rule refuses the untick.
      const turningOn = changedIds.filter((c) => c.is_active);
      const turningOff = changedIds.filter((c) => !c.is_active);
      const send = (batch: typeof changedIds) =>
        Promise.allSettled(
          batch.map(({ id, is_active }) => updateEntityBillAccount(entityId, id, { is_active })),
        );
      const onResults = await send(turningOn);
      const offResults = await send(turningOff);
      const sent = [...turningOn, ...turningOff];
      const results = [...onResults, ...offResults];
      // Each row that went through IS saved: the saved set follows them, so the leave guard and
      // "Discard changes" measure from what the server holds.
      const next = new Set(savedIds);
      results.forEach((result, i) => {
        if (result.status !== "fulfilled") return;
        const { id, is_active } = sent[i];
        if (is_active) next.add(id);
        else next.delete(id);
      });
      setSavedIds(next);
      const failed = results.filter(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      );
      if (failed.length === 0) {
        showToast(PAYMENT_SETTINGS_COPY.saved, "success");
      } else {
        console.error("[payment settings] some account codes did not save", failed);
        // A refusal the server explained (409: "Keep at least one account code ticked.") is
        // shown in its own words; anything else gets the generic retry line.
        const refused = failed.find((f) => f.reason instanceof ApiError && f.reason.status === 409);
        showToast(
          refused ? (refused.reason as ApiError).message : PAYMENT_SETTINGS_COPY.someFailed,
          "error",
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.label.toLowerCase().includes(q));
  }, [rows, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
  const someFilteredSelected = filtered.some((r) => selectedIds.has(r.id)) && !allFilteredSelected;

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = someFilteredSelected;
  }, [someFilteredSelected, expanded, loading]);

  const visibleIds = useMemo(() => new Set(filtered.map((r) => r.id)), [filtered]);

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) {
        if (allFilteredSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const rowBg = readOnly ? "bg-set-pill" : "bg-white";
  const selectAll = (checked: boolean, disabled: boolean, busy = false) => (
    <label className={`${ROW} ${disabled ? "" : "cursor-pointer"}`}>
      <span className="min-w-0 flex-1 text-right text-sm text-set-ink-2">
        {PAYMENT_SETTINGS_COPY.selectAll}
      </span>
      <input
        ref={selectAllRef}
        type="checkbox"
        checked={checked}
        onChange={toggleSelectAllFiltered}
        disabled={disabled}
        className={CHECKBOX}
        aria-label={PAYMENT_SETTINGS_COPY.selectAllLabel}
        aria-busy={busy || undefined}
      />
    </label>
  );

  // without Xero and with no stored code there is nothing to tick: the notice alone
  const nothingWithoutXero = xeroConnected === false && rows.length === 0;
  const showSave = expanded && !nothingWithoutXero;
  const saveTitle = loading
    ? undefined
    : isViewOnly
      ? PAYMENT_SETTINGS_COPY.titleViewOnly
      : readOnly
        ? PAYMENT_SETTINGS_COPY.titleReadOnly
        : undefined;

  return (
    <>
      {/* Two different reasons the controls are dead, with different sentences. Held until
          `loading` clears, as the source did, so nobody sees it flash. */}
      {!loading && readOnly ? (
        <ReadOnlyNotice>
          {isViewOnly ? PAYMENT_SETTINGS_COPY.viewOnly : PAYMENT_SETTINGS_COPY.readOnly}
        </ReadOnlyNotice>
      ) : null}

      <SettingsCard
        title={PAYMENT_SETTINGS_COPY.title}
        lead={PAYMENT_SETTINGS_COPY.lead}
        readOnly={readOnly}
        action={
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-controls="payment-account-codes"
            aria-label={PAYMENT_SETTINGS_COPY.title}
            className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-set-mute hover:bg-set-pill hover:text-set-ink-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-set-tab"
          >
            <span
              className={`material-symbols-outlined leading-none transition-transform duration-200 ease-out ${expanded ? "rotate-0" : "rotate-180"}`}
              aria-hidden
            >
              expand_more
            </span>
          </button>
        }
      >
        {expanded ? (
          <div id="payment-account-codes" className="flex min-w-0 flex-col gap-3">
            {nothingWithoutXero ? (
              <XeroNotConnected href={integrationPath(company.id, company.name)} />
            ) : (
              <>
                <div className="relative">
                  <label htmlFor="settings-account-search" className="sr-only">
                    {PAYMENT_SETTINGS_COPY.search}
                  </label>
                  <input
                    id="settings-account-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={PAYMENT_SETTINGS_COPY.search}
                    autoComplete="off"
                    className={`${SETTINGS_INPUT} ${SETTINGS_INPUT_OK} pr-11 placeholder:text-set-mute`}
                  />
                  <span
                    className="material-symbols-outlined pointer-events-none absolute inset-y-0 right-3 flex items-center text-set-mute"
                    aria-hidden
                  >
                    search
                  </span>
                </div>

                {loading ? (
                  <div className="rounded-[12px] border border-set-line">
                    {selectAll(false, true, true)}
                    <div className="flex flex-col gap-3 py-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex animate-pulse items-center justify-between gap-3 px-3 sm:px-4"
                        >
                          <div className="h-4 flex-1 rounded bg-set-line" />
                          <div className="h-5 w-5 shrink-0 rounded bg-set-line" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : loadFailed ? (
                  <p role="alert" className="py-8 text-center text-sm text-danger">
                    {PAYMENT_SETTINGS_COPY.loadFailed}
                  </p>
                ) : rows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-set-mute">
                    {PAYMENT_SETTINGS_COPY.empty}
                  </p>
                ) : filtered.length === 0 ? (
                  <div className="rounded-[12px] border border-set-line pb-4">
                    {selectAll(allFilteredSelected, true)}
                    <p className="text-center text-sm text-set-mute">
                      {PAYMENT_SETTINGS_COPY.noMatch}
                    </p>
                  </div>
                ) : (
                  // A long chart scrolls in its own box, Select all pinned on top (owner,
                  // 2026-11-12); the page around it scrolls with the document.
                  <ul
                    className="max-h-[min(24rem,50vh)] min-w-0 overflow-y-auto overscroll-contain rounded-[12px] border border-set-line [scrollbar-gutter:stable]"
                    aria-label="Account codes"
                  >
                    <li className={`sticky top-0 z-10 border-b border-set-line ${rowBg}`}>
                      {selectAll(allFilteredSelected, filtered.length === 0 || readOnly)}
                    </li>
                    {filtered.map((row, index) => (
                      <li key={row.id} className={index > 0 ? "border-t border-set-line" : ""}>
                        <label className={`${ROW} ${readOnly ? "" : "cursor-pointer"}`}>
                          <span className="min-w-0 flex-1 text-sm break-words text-set-ink">
                            {row.label}
                          </span>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(row.id)}
                            onChange={() => toggleRow(row.id)}
                            disabled={readOnly}
                            className={CHECKBOX}
                            aria-label={`Include ${row.label} in payment account dropdown`}
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        ) : null}

        {showSave ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || readOnly || noneTicked || !hasChanges}
              aria-describedby={
                noneTicked && !readOnly ? "settings-account-none-ticked" : undefined
              }
              title={saveTitle}
              className={SETTINGS_PRIMARY}
            >
              {saving ? PAYMENT_SETTINGS_COPY.saving : PAYMENT_SETTINGS_COPY.save}
            </button>
            {/* A gated button says why beside it (plain text, never only a `title`). */}
            {noneTicked && !readOnly ? (
              <p id="settings-account-none-ticked" className="text-[13px] text-set-ink-2">
                {PAYMENT_SETTINGS_COPY.noneTicked}
              </p>
            ) : !loading && !readOnly && !loadFailed && rows.length > 0 && !hasChanges ? (
              <span className="text-[13px] text-set-mute">{PAYMENT_SETTINGS_COPY.unchanged}</span>
            ) : null}
          </div>
        ) : null}
      </SettingsCard>

      {/* Over the sidebar drawer (z-200) and any other modal: a link in the drawer asks too.
          `data-leave-dialog` is what the guard reads to leave a link inside the dialog alone. */}
      {leave.open
        ? createPortal(
            <div data-leave-dialog="" className="relative z-[250]">
              <LeaveDialog onDiscard={leave.discard} onStay={leave.stay} />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
