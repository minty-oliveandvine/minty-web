"use client";

/**
 * `/entity/<shortid>/<name>/settings/petty-cash` - Petty Cash Settings, moved into the hub from
 * minty-petty-cash-web (owner, 2026-11-10) with its behaviour, calls and words unchanged; only
 * the frame (the shared settings page, `SettingsShell`) and the look (the Settings frames, Figma
 * 353:999) are new. Reads `GET /settings` and `GET /settings/xero` from minty-petty-cash-api.
 *
 * - Xero account mapping and Petty Cash Account Code (`XeroCards.tsx`), read once per page load
 *   from `GET /settings/xero` (it asks Xero), each with its own Save; "Xero isn't connected" in
 *   both when the connection is not live.
 * - Electronic and Delivery: add (the catalogue or a new name), rename, Move up / down, Delete -
 *   each the API's at once, its answer drawn and its sentence shown.
 * - No Country & currency card: those are the General tab's.
 *
 * What a person may change is the API's `permissions`; a cashier sees it all read-only. No leave
 * guard: the source has none (each card saves on its own).
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
  SettingsDialog,
  LoadState,
  ReadOnlyNotice,
  SettingsShell,
} from "@/components/ui/SettingsShell";
import { SETTINGS_DANGER_FILL, SETTINGS_OUTLINE } from "@/components/ui/settingsButtons";
import { useToast } from "@/components/ui/Toast";
import { ApiError, type ApiRequest } from "@/lib/apiClient";

import { pettyCashSettingsFetch } from "@/features/petty-cash-settings/api/pettyCashSettings";
import { BusyOverlay } from "@/features/petty-cash-settings/components/parts";
import {
  SalesMethodsCard,
  type MethodActions,
} from "@/features/petty-cash-settings/components/SalesMethodsCard";
import {
  AccountCodesCard,
  XeroMappingCard,
  type Call,
  type XeroLoad,
} from "@/features/petty-cash-settings/components/XeroCards";
import {
  connectXeroPath,
  leaveFor,
  pettyCashDashboardUrl,
} from "@/features/petty-cash-settings/lib/paths";
import {
  KIND,
  METHOD_TYPES,
  movedIds,
  viewOnly,
  type MethodType,
  type SalesMethod,
  type SettingsAnswer,
  type SettingsRead,
} from "@/features/petty-cash-settings/lib/settings";
import type { XeroRead } from "@/features/petty-cash-settings/lib/xeroSettings";

export const UNREACHABLE =
  "We couldn't reach Petty Cash. Check your connection, then reload the page.";
export const READ_ONLY =
  "You have view-only access to these settings. Ask an Accountant or Admin to make changes.";
const SAVING = "Saving changes…";

type Load =
  | { kind: "loading" }
  | { kind: "ready"; read: SettingsRead }
  | { kind: "refused"; message: string }
  | { kind: "failed"; message: string };

/** The sentence for a failed call, or null for a 401 (already on its way back through the hand-off). */
function refusal(err: unknown): string | null {
  if (err instanceof ApiError) return err.status === 401 ? null : err.message;
  return UNREACHABLE;
}

export function PettyCashSettingsScreen({ company }: { company: { id: string; name: string } }) {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    pettyCashSettingsFetch<SettingsRead>(company.id, "/settings").then(
      (read) => {
        if (live) setLoad({ kind: "ready", read });
      },
      (err: unknown) => {
        const message = refusal(err);
        if (!live || message === null) return;
        setLoad(
          err instanceof ApiError && err.status === 403
            ? { kind: "refused", message }
            : { kind: "failed", message },
        );
      },
    );
    return () => {
      live = false;
    };
  }, [company.id, attempt]);

  return (
    <SettingsShell company={company} modules={null} tab="petty-cash">
      {load.kind === "loading" ? <LoadState status="loading" onRetry={() => undefined} /> : null}
      {load.kind === "refused" ? (
        // a 403 is the API's answer for this person: trying again changes nothing
        <p className="mt-6 text-center text-sm text-danger" role="alert">
          {load.message}
        </p>
      ) : null}
      {load.kind === "failed" ? (
        <LoadState
          status="error"
          error={load.message}
          onRetry={() => {
            setLoad({ kind: "loading" });
            setAttempt((n) => n + 1);
          }}
        />
      ) : null}
      {load.kind === "ready" ? <SettingsBody initial={load.read} company={company} /> : null}
    </SettingsShell>
  );
}

function SettingsBody({
  initial,
  company,
}: {
  initial: SettingsRead;
  company: { id: string; name: string };
}) {
  const { showToast } = useToast();
  const entityId = company.id;
  const [read, setRead] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: MethodType;
    method: SalesMethod;
  } | null>(null);
  // a ref, not state: a second click in the same frame must see the first one
  const acting = useRef(false);
  const perms = read.permissions;

  useEffect(() => {
    if (menu === null) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.("[data-row-menu]")) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  /** One call: the busy overlay, and a refusal's sentence as the error toast; null when it did not go through. */
  const call: Call = useCallback(
    async <T,>(
      path: string,
      init: ApiRequest,
      busyText = SAVING,
      onRefused?: (message: string) => void,
    ): Promise<T | null> => {
      if (acting.current) return null;
      acting.current = true;
      setBusy(busyText);
      try {
        return await pettyCashSettingsFetch<T>(entityId, path, init);
      } catch (err) {
        const message = refusal(err);
        if (message !== null) {
          showToast(message, "error");
          onRefused?.(message);
        }
        return null;
      } finally {
        acting.current = false;
        setBusy(null);
      }
    },
    [entityId, showToast],
  );

  /** One write of the cards that need no Xero: the API's answer drawn and its sentence shown; true when it went through. */
  const write = useCallback(
    async (path: string, init: ApiRequest): Promise<boolean> => {
      const answer = await call<SettingsAnswer>(path, init);
      if (!answer) return false;
      const { message, ...next } = answer;
      setRead(next);
      showToast(message, "success");
      return true;
    },
    [call, showToast],
  );

  // The Xero cards' read: once per page load (each read asks Xero), and again only on Try again.
  const [xero, setXero] = useState<XeroLoad>({ kind: "loading" });
  const [xeroAttempt, setXeroAttempt] = useState(0);
  // one request per attempt, even when an effect runs twice (React's dev check): each read asks Xero
  const xeroAsk = useRef<{ attempt: number; answer: Promise<XeroRead> } | null>(null);
  useEffect(() => {
    let live = true;
    if (xeroAsk.current?.attempt !== xeroAttempt)
      xeroAsk.current = {
        attempt: xeroAttempt,
        answer: pettyCashSettingsFetch<XeroRead>(entityId, "/settings/xero"),
      };
    xeroAsk.current.answer.then(
      (next) => {
        if (live) setXero({ kind: "ready", read: next });
      },
      (err: unknown) => {
        const message = refusal(err);
        if (!live || message === null) return;
        setXero({
          kind: "failed",
          message,
          retry: !(err instanceof ApiError && err.status === 403),
        });
      },
    );
    return () => {
      live = false;
    };
  }, [entityId, xeroAttempt]);
  const retryXero = () => {
    setXero({ kind: "loading" });
    setXeroAttempt((n) => n + 1);
  };
  const xeroSaved = ({ message, ...next }: XeroRead & { message: string }) => {
    setXero({ kind: "ready", read: next });
    showToast(message, "success");
  };
  const connectHref = connectXeroPath(entityId, company.name);

  const actions: MethodActions = {
    add: (type, body) => write("/sales-methods", { method: "POST", json: { type, ...body } }),
    rename: (method, name) =>
      write(`/sales-methods/${encodeURIComponent(method.id)}`, { method: "PUT", json: { name } }),
    move: (type, index, step) => {
      const ids = movedIds(
        read.sales_methods[type].map((m) => m.id),
        index,
        step,
      );
      if (ids)
        void write("/sales-methods/order", { method: "PUT", json: { type, method_ids: ids } });
    },
    remove: (type, method) => setConfirmDelete({ type, method }),
    say: (message) => showToast(message, "error"),
  };

  return (
    <>
      {viewOnly(perms) ? <ReadOnlyNotice>{READ_ONLY}</ReadOnlyNotice> : null}

      <div className="flex min-w-0 flex-col gap-4">
        <XeroMappingCard
          load={xero}
          busy={busy !== null}
          call={call}
          connectHref={connectHref}
          onRetry={retryXero}
          onAdded={(message) => showToast(message, "success")}
          onSaved={({ first_save, ...answer }) => {
            if (!first_save) {
              xeroSaved(answer);
              return;
            }
            // The first mapping save goes on to the company's Petty Cash dashboard, as Flask's
            // did. That is another app, so its flash cannot travel: the sentence is said here as
            // the page leaves.
            showToast(answer.message, "success");
            leaveFor(pettyCashDashboardUrl(entityId));
          }}
        />

        {METHOD_TYPES.map((type) => (
          <SalesMethodsCard
            key={type}
            type={type}
            methods={read.sales_methods[type]}
            available={read.available[type]}
            permissions={perms}
            busy={busy !== null}
            menuOpen={menu}
            onMenu={setMenu}
            actions={actions}
          />
        ))}

        <AccountCodesCard
          load={xero}
          busy={busy !== null}
          call={call}
          connectHref={connectHref}
          onRetry={retryXero}
          onSaved={xeroSaved}
        />
      </div>

      {busy ? <BusyOverlay text={busy} /> : null}
      {confirmDelete ? (
        <SettingsDialog
          title={`Delete ${KIND[confirmDelete.type].title} Method`}
          onClose={() => setConfirmDelete(null)}
          actions={
            <>
              <button
                type="button"
                className={SETTINGS_OUTLINE}
                onClick={() => setConfirmDelete(null)}
              >
                Go back
              </button>
              <button
                type="button"
                className={SETTINGS_DANGER_FILL}
                onClick={() => {
                  const { method } = confirmDelete;
                  setConfirmDelete(null);
                  void write(`/sales-methods/${encodeURIComponent(method.id)}`, {
                    method: "DELETE",
                  });
                }}
              >
                Delete
              </button>
            </>
          }
        >
          <p className="[overflow-wrap:anywhere]">
            Are you sure you want to delete &quot;
            <strong className="font-semibold text-set-ink">{confirmDelete.method.name}</strong>
            &quot;? This action cannot be undone.
          </p>
        </SettingsDialog>
      ) : null}
    </>
  );
}
