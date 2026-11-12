"use client";

/**
 * The company's chart of accounts and its contacts, on General under the company's details (owner,
 * 2026-11-12: its own tab first, merged into General the same day). Added, edited and deleted here,
 * with or without Xero (made, changed and archived in Xero too when the company is live there).
 * Both lists are read at once; each change is the API's, its sentence shown as a toast, then both
 * are read again. General's view-only line covers it: the same roles change both.
 */

import { useCallback, useEffect, useState } from "react";

import { LoadState } from "@/components/ui/SettingsShell";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/apiClient";

import {
  addAccount,
  addContact,
  deleteAccount,
  deleteContact,
  editAccount,
  readAccounts,
  readContacts,
  renameContact,
  type Account,
  type AccountsRead,
  type Contact,
  type ContactsRead,
} from "@/features/company-settings/api/chart";
import {
  AccountForm,
  AccountsCard,
  ContactForm,
  ContactsCard,
  DeleteDialog,
  type Outcome,
} from "@/features/company-settings/components/ChartCards";

const UNREACHABLE = "I couldn't reach your accounts just now. Mind trying again in a moment?";

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; accounts: AccountsRead; contacts: ContactsRead };

type Open =
  | { kind: "account"; editing: Account | null }
  | { kind: "contact"; editing: Contact | null }
  | { kind: "delete-account"; row: Account }
  | { kind: "delete-contact"; row: Contact }
  | null;

function sentence(err: unknown): string {
  return err instanceof ApiError ? err.message : UNREACHABLE;
}

function fieldsOf(err: unknown): Record<string, string> | undefined {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== "object") return undefined;
  const fields = (err.body as { fields?: unknown }).fields;
  return fields && typeof fields === "object" ? (fields as Record<string, string>) : undefined;
}

export function ChartSection({ entityId }: { entityId: string }) {
  const { showToast } = useToast();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([readAccounts(entityId), readContacts(entityId)]).then(
      ([accounts, contacts]) => live && setLoad({ kind: "ready", accounts, contacts }),
      (err: unknown) => live && setLoad({ kind: "error", message: sentence(err) }),
    );
    return () => {
      live = false;
    };
  }, [entityId, attempt]);

  /** One change: busy while it runs, its sentence as a toast, the lists read again after. */
  const change = useCallback(
    async (send: () => Promise<{ message: string }>): Promise<Outcome> => {
      setBusy(true);
      try {
        const { message } = await send();
        showToast(message, "success");
        setOpen(null);
        setAttempt((n) => n + 1);
        return { ok: true };
      } catch (err) {
        const fields = fieldsOf(err);
        if (!fields) showToast(sentence(err), "error");
        return { ok: false, fields };
      } finally {
        setBusy(false);
      }
    },
    [showToast],
  );

  return (
    <>
      {load.kind === "loading" ? (
        <LoadState status="loading" onRetry={() => setAttempt((n) => n + 1)} />
      ) : load.kind === "error" ? (
        <LoadState status="error" error={load.message} onRetry={() => setAttempt((n) => n + 1)} />
      ) : (
        <>
          <AccountsCard
            read={load.accounts}
            busy={busy}
            // the add / edit form inline above the list (owner, 2026-11-12: no dialog)
            form={
              open?.kind === "account" ? (
                <AccountForm
                  key={open.editing?.id ?? "new"}
                  read={load.accounts}
                  editing={open.editing}
                  busy={busy}
                  onClose={() => setOpen(null)}
                  onSubmit={(input) =>
                    change(() =>
                      open.editing && !("template_id" in input)
                        ? editAccount(entityId, open.editing.id, input)
                        : addAccount(entityId, input),
                    )
                  }
                />
              ) : null
            }
            onAdd={() => setOpen({ kind: "account", editing: null })}
            onEdit={(row) => setOpen({ kind: "account", editing: row })}
            onDelete={(row) => setOpen({ kind: "delete-account", row })}
          />
          <ContactsCard
            read={load.contacts}
            busy={busy}
            form={
              open?.kind === "contact" ? (
                <ContactForm
                  key={open.editing?.id ?? "new"}
                  read={load.contacts}
                  editing={open.editing}
                  busy={busy}
                  onClose={() => setOpen(null)}
                  onSubmit={(name) =>
                    change(() =>
                      open.editing
                        ? renameContact(entityId, open.editing.id, name)
                        : addContact(entityId, name),
                    )
                  }
                />
              ) : null
            }
            onAdd={() => setOpen({ kind: "contact", editing: null })}
            onEdit={(row) => setOpen({ kind: "contact", editing: row })}
            onDelete={(row) => setOpen({ kind: "delete-contact", row })}
          />
          {open?.kind === "delete-account" ? (
            <DeleteDialog
              row={open.row}
              busy={busy}
              onClose={() => setOpen(null)}
              onConfirm={() => void change(() => deleteAccount(entityId, open.row.id))}
            />
          ) : null}
          {open?.kind === "delete-contact" ? (
            <DeleteDialog
              row={open.row}
              busy={busy}
              onClose={() => setOpen(null)}
              onConfirm={() => void change(() => deleteContact(entityId, open.row.id))}
            />
          ) : null}
        </>
      )}
    </>
  );
}
