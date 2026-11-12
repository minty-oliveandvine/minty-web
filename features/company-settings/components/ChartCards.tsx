"use client";

/**
 * General's chart of accounts and contacts cards (owner, 2026-11-12; their own tab first): the company's chart of accounts and
 * its contacts, every row with **Edit** and **Delete** - each is the company's own copy, those from
 * Minty's starter chart marked "Comes with Minty" (owner, 2026-11-12). Add (the
 * card's top-right button) and Edit open a form inline at the top of the card, above the list - no
 * dialog, as Petty Cash Settings' Add New Method (owner, 2026-11-12) - checked as typed
 * (`lib/rules.ts`); Delete asks first, saying what happens to records and to Xero. Every change is
 * the API's at once.
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  SETTINGS_DANGER_FILL,
  SETTINGS_OUTLINE,
  SETTINGS_PRIMARY,
} from "@/components/ui/settingsButtons";
import {
  SETTINGS_FIELD_ERROR,
  SETTINGS_INPUT,
  SETTINGS_INPUT_BAD,
  SETTINGS_INPUT_OK,
  SETTINGS_LABEL,
} from "@/components/ui/settingsFields";
import { Combo, type ComboRow } from "@/components/ui/Combo";
import { SettingsCard, SettingsDialog } from "@/components/ui/SettingsShell";

import type {
  Account,
  AccountInput,
  AccountsRead,
  Contact,
  ContactsRead,
  FromMinty,
  MintyAccount,
} from "@/features/company-settings/api/chart";
import {
  accountProblems,
  contactProblem,
  deleteNote,
  type AccountProblems,
} from "@/features/company-settings/lib/chartRules";

/** What a submit answers: done, or the API's per-field sentences to show under the fields. */
export type Outcome = { ok: true } | { ok: false; fields?: Record<string, string> };

/** A Material Symbols glyph at its box's size (petty-cash-settings' helper; features stay apart). */
function Icon({ name }: { name: string }) {
  return (
    <span className="inline-flex shrink-0 text-[20px]" aria-hidden="true">
      <span className="material-symbols-outlined" style={{ fontSize: "inherit" }}>
        {name}
      </span>
    </span>
  );
}

const ROW_BUTTON =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] text-set-mute transition-colors disabled:cursor-not-allowed";

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-set-pill px-2 py-0.5 text-[12px] font-medium text-set-ink-2">
      {children}
    </span>
  );
}

/** A list row: the name and its line, then Edit and Delete where the company owns it. */
function Row({
  title,
  detail,
  badges,
  canEdit,
  canDelete,
  busy,
  onEdit,
  onDelete,
}: {
  title: string;
  detail?: string;
  badges: ReactNode;
  canEdit: boolean;
  canDelete: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex min-h-14 min-w-0 items-center gap-2 border-b border-set-line px-3 py-2 last:border-b-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="min-w-0 text-[14.5px] [overflow-wrap:anywhere] text-set-ink">{title}</span>
        {detail || badges ? (
          <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12.5px] text-set-mute">
            {detail ? <span>{detail}</span> : null}
            {badges}
          </span>
        ) : null}
      </div>
      {canEdit ? (
        <button
          type="button"
          disabled={busy}
          onClick={onEdit}
          aria-label={`Edit ${title}`}
          title="Edit"
          className={`${ROW_BUTTON} enabled:hover:bg-set-pill enabled:hover:text-set-ink`}
        >
          <Icon name="edit" />
        </button>
      ) : null}
      {canDelete ? (
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          aria-label={`Delete ${title}`}
          title="Delete"
          className={`${ROW_BUTTON} enabled:hover:bg-[#fdecec] enabled:hover:text-[#d9534f]`}
        >
          <Icon name="delete" />
        </button>
      ) : null}
    </li>
  );
}

/**
 * The add / edit form, inline at the top of its card (owner, 2026-11-12: no dialog). Its first
 * field takes focus; Escape cancels unless a picker's list is open (the picker closes that first).
 */
function InlineForm({
  title,
  busy,
  onClose,
  actions,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  actions: ReactNode;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
  }, []);
  return (
    <div
      ref={panel}
      role="group"
      aria-label={title}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Escape" && !e.defaultPrevented && !busy) {
          e.preventDefault();
          onClose();
        }
      }}
      className="flex min-w-0 flex-col gap-4 rounded-[12px] border border-set-line p-4"
    >
      <h4 className="text-[14.5px] font-semibold [overflow-wrap:anywhere] text-set-ink">{title}</h4>
      {children}
      <div className="flex flex-wrap gap-3">{actions}</div>
    </div>
  );
}

/** A long list scrolls in its own box (owner, 2026-11-12), the page around it with the document. */
const LIST =
  "m-0 max-h-[min(28rem,60vh)] list-none overflow-y-auto overscroll-contain rounded-[12px] border border-set-line p-0 [scrollbar-gutter:stable]";

function AddButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className={`${SETTINGS_OUTLINE} w-full sm:w-auto`}
    >
      <Icon name="add" />
      {label}
    </button>
  );
}

function Search({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="search"
        placeholder={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${SETTINGS_INPUT} ${SETTINGS_INPUT_OK} placeholder:text-set-mute`}
      />
    </div>
  );
}

// ---- accounts ------------------------------------------------------------------------------------

export function AccountsCard({
  read,
  busy,
  form,
  onAdd,
  onEdit,
  onDelete,
}: {
  read: AccountsRead;
  busy: boolean;
  /** The add / edit form when one is open, drawn above the list. */
  form?: ReactNode;
  onAdd: () => void;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
}) {
  const [query, setQuery] = useState("");
  const { permissions: may } = read;
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = read.accounts.filter(
      (a) => !q || a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q),
    );
    return read.types
      .map((t) => ({ label: t.label, rows: shown.filter((a) => a.type === t.value) }))
      .filter((g) => g.rows.length);
  }, [read, query]);
  return (
    <SettingsCard
      title="Chart of accounts"
      lead="The accounts your reports and payment requests post to."
      readOnly={!may.add && !may.edit && !may.delete}
      action={
        may.add && !form ? <AddButton label="Add an account" busy={busy} onClick={onAdd} /> : null
      }
    >
      {form}
      <Search label="Search accounts by name or code" value={query} onChange={setQuery} />
      {groups.length === 0 ? (
        <p className="text-sm text-set-mute" role="status">
          {read.accounts.length ? "No accounts match your search." : "No accounts yet."}
        </p>
      ) : (
        <div className={LIST} aria-label="Accounts" role="region">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h4 className="sticky top-0 z-10 border-b border-set-line bg-set-pill px-3 py-2 text-[12.5px] font-semibold text-set-ink-2">
                {group.label}
              </h4>
              <ul className="m-0 list-none p-0">
                {group.rows.map((a) => (
                  <Row
                    key={a.id}
                    title={a.code ? `${a.code} - ${a.name}` : a.name}
                    detail={a.description || undefined}
                    badges={
                      <>
                        {a.in_xero ? <Badge>In Xero</Badge> : null}
                        {a.source === "template" ? <Badge>Comes with Minty</Badge> : null}
                      </>
                    }
                    canEdit={a.own && may.edit}
                    canDelete={a.own && may.delete}
                    busy={busy}
                    onEdit={() => onEdit(a)}
                    onDelete={() => onDelete(a)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </SettingsCard>
  );
}

const EMPTY: AccountInput = { code: "", name: "", type: "", description: "" };
const ADD = "__add__";
/** The picker's note, on top as the list opens (owner, 2026-11-12: Petty Cash Settings' way). */
export const ACCOUNT_HINT = "Type an account name to add a new account";
const PICK_ONE = "Pick one of Minty's accounts, or type a name to add your own.";

type Pick = { kind: "minty"; row: MintyAccount } | { kind: "new" } | null;

/**
 * Add or edit one account. Adding works as Petty Cash Settings' Add New Method (owner,
 * 2026-11-12): an **Account** dropdown of Minty's accounts - one picked is added as it is - and a
 * name typed into it that isn't there offers "+ Add '<name>' as a new account", which opens the
 * fields for the company's own: Type, then Code (the next free one filled in), Name, Description.
 * Editing is those fields alone.
 */
export function AccountForm({
  read,
  editing,
  busy,
  onClose,
  onSubmit,
}: {
  read: AccountsRead;
  /** The account being edited; null to add one. */
  editing: Account | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: AccountInput | FromMinty) => Promise<Outcome>;
}) {
  const ids = { type: useId(), code: useId(), name: useId(), description: useId() };
  const pickerId = useId();
  const [pick, setPick] = useState<Pick>(editing ? { kind: "new" } : null);
  const [text, setText] = useState("");
  const [pickProblem, setPickProblem] = useState<string | null>(null);
  const [input, setInput] = useState<AccountInput>(
    editing
      ? {
          code: editing.code,
          name: editing.name,
          type: editing.type,
          description: editing.description,
        }
      : EMPTY,
  );
  // a code the person typed stays; one we filled in follows the type
  const [codeTouched, setCodeTouched] = useState(!!editing);
  const [submitted, setSubmitted] = useState(false);
  const [server, setServer] = useState<Record<string, string>>({});
  const others = read.accounts.filter((a) => a.id !== editing?.id);
  const problems: AccountProblems = { ...accountProblems(input, others, submitted), ...server };
  const typeLabel = read.types.find((t) => t.value === input.type)?.label ?? "";
  const nextCode = input.type ? read.next_codes[input.type] : undefined;

  function set(field: keyof AccountInput, value: string) {
    // a field typed into drops the API's sentence about it
    setServer((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== field)));
    setInput((current) => {
      const next = { ...current, [field]: value };
      if (field === "type" && !codeTouched) next.code = read.next_codes[value] ?? "";
      return next;
    });
    if (field === "code") setCodeTouched(true);
  }

  const known = (name: string) => name.trim().toLowerCase() === text.trim().toLowerCase();

  function rows(query: string): ComboRow[] {
    const typed = query.trim().toLowerCase();
    const offered = read.minty_accounts.filter(
      (m) => !typed || m.name.toLowerCase().includes(typed) || m.code.toLowerCase().includes(typed),
    );
    const out: ComboRow[] = [];
    if (!typed) out.push({ key: "hint", label: ACCOUNT_HINT, info: true });
    out.push(
      ...offered.map((m) => ({
        key: m.id,
        label: m.name,
        sub: [m.code, m.type_label].filter(Boolean).join(" · "),
        selected: pick?.kind === "minty" && pick.row.id === m.id,
      })),
    );
    if (
      typed &&
      !read.minty_accounts.some((m) => known(m.name)) &&
      !others.some((a) => known(a.name))
    )
      out.push({
        key: ADD,
        label: `+ Add '${query.trim()}' as a new account`,
        divided: offered.length > 0,
      });
    if (typed && !offered.length)
      out.push({ key: "none", label: "No matching account found", info: true });
    return out;
  }

  function choose(key: string) {
    setPickProblem(null);
    if (key === ADD) {
      // the typed name goes into the Name field, the rest to fill in
      setPick({ kind: "new" });
      set("name", text.trim());
      return;
    }
    const row = read.minty_accounts.find((m) => m.id === key);
    if (!row) return;
    setPick({ kind: "minty", row });
    setText(row.name);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pick === null) {
      setPickProblem(PICK_ONE);
      document.getElementById(pickerId)?.focus();
      return;
    }
    if (pick.kind === "minty") {
      const outcome = await onSubmit({ template_id: pick.row.id });
      if (!outcome.ok && outcome.fields) setPickProblem(Object.values(outcome.fields)[0] ?? null);
      return;
    }
    setSubmitted(true);
    const now = accountProblems(input, others, true);
    const wrong = (Object.keys(now) as (keyof AccountInput)[]).filter((k) => now[k]);
    if (wrong.length) {
      document.getElementById(ids[wrong[0]])?.focus();
      return;
    }
    const outcome = await onSubmit({
      ...input,
      code: input.code.trim(),
      name: input.name.replace(/\s+/g, " ").trim(),
      description: input.description.trim(),
    });
    if (!outcome.ok && outcome.fields) setServer(outcome.fields);
  }

  const field = (name: keyof AccountInput) => ({
    id: ids[name],
    "aria-invalid": problems[name] ? true : undefined,
    "aria-describedby": problems[name] ? `${ids[name]}-problem` : undefined,
    className: `${SETTINGS_INPUT} ${problems[name] ? SETTINGS_INPUT_BAD : SETTINGS_INPUT_OK}`,
  });
  const problem = (name: keyof AccountInput) =>
    problems[name] ? (
      <p id={`${ids[name]}-problem`} className={SETTINGS_FIELD_ERROR}>
        {problems[name]}
      </p>
    ) : null;
  const required = (label: string) => (
    <>
      {label}{" "}
      <span className="text-danger" aria-hidden="true">
        *
      </span>
      <span className="sr-only"> (required)</span>
    </>
  );

  return (
    <InlineForm
      title={editing ? `Edit ${editing.name}` : "Add an account"}
      busy={busy}
      onClose={onClose}
      actions={
        <>
          <button
            type="button"
            className={`${SETTINGS_OUTLINE} flex-1`}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="account-form"
            className={`${SETTINGS_PRIMARY} flex-1`}
            disabled={busy}
          >
            {editing ? "Save" : "Add"}
          </button>
        </>
      }
    >
      <form id="account-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
        {editing?.in_xero ? (
          <p className="text-[13px] text-set-ink-2">Your change is made in Xero too.</p>
        ) : null}
        {!editing ? (
          <div className="min-w-0">
            <label htmlFor={pickerId} className={SETTINGS_LABEL}>
              {required("Account")}
            </label>
            <Combo
              id={pickerId}
              value={text}
              placeholder="Select an account"
              rows={rows}
              rotateChevron
              required
              invalid={!!pickProblem}
              describedBy={pickProblem ? `${pickerId}-problem` : undefined}
              onText={(typed) => {
                // typing searches; nothing is chosen until a row is picked
                setText(typed);
                setPick(null);
                setPickProblem(null);
              }}
              onPick={choose}
              onBlur={() => setText((typed) => (pick?.kind === "minty" ? pick.row.name : typed))}
            />
            {pickProblem ? (
              <p id={`${pickerId}-problem`} className={SETTINGS_FIELD_ERROR}>
                {pickProblem}
              </p>
            ) : null}
          </div>
        ) : null}
        {pick?.kind === "minty" ? (
          <div className="flex min-w-0 flex-col gap-1 rounded-[12px] border border-set-line bg-set-pill px-3.5 py-3 text-[13px] text-set-ink-2">
            <span className="text-[14.5px] font-semibold [overflow-wrap:anywhere] text-set-ink">
              {pick.row.code ? `${pick.row.code} - ${pick.row.name}` : pick.row.name}
            </span>
            <span>{pick.row.type_label}</span>
            {pick.row.description ? <span>{pick.row.description}</span> : null}
          </div>
        ) : null}
        {pick?.kind === "new" ? (
          <>
            <div className="min-w-0">
              <label htmlFor={ids.type} className={SETTINGS_LABEL}>
                {required("Type")}
              </label>
              <select
                {...field("type")}
                aria-required
                value={input.type}
                onChange={(e) => set("type", e.target.value)}
              >
                <option value="">Choose a type</option>
                {read.types.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              {problem("type")}
            </div>
            <div className="min-w-0">
              <label htmlFor={ids.code} className={SETTINGS_LABEL}>
                {input.type === "bank" ? "Code" : required("Code")}
              </label>
              <input
                {...field("code")}
                type="text"
                autoComplete="off"
                aria-required={input.type !== "bank" || undefined}
                value={input.code}
                onChange={(e) => set("code", e.target.value)}
              />
              {problem("code") ??
                (!editing && nextCode && input.code === nextCode ? (
                  <p className="mt-1.5 text-[12.5px] text-set-mute">
                    {nextCode} is the next free code for {typeLabel}. You can change it.
                  </p>
                ) : null)}
            </div>
            <div className="min-w-0">
              <label htmlFor={ids.name} className={SETTINGS_LABEL}>
                {required("Name")}
              </label>
              <input
                {...field("name")}
                type="text"
                autoComplete="off"
                aria-required
                value={input.name}
                onChange={(e) => set("name", e.target.value)}
              />
              {problem("name")}
            </div>
            <div className="min-w-0">
              <label htmlFor={ids.description} className={SETTINGS_LABEL}>
                Description
              </label>
              <textarea
                {...field("description")}
                rows={2}
                value={input.description}
                onChange={(e) => set("description", e.target.value)}
              />
              {problem("description")}
            </div>
          </>
        ) : null}
      </form>
    </InlineForm>
  );
}

// ---- contacts ------------------------------------------------------------------------------------

export function ContactsCard({
  read,
  busy,
  form,
  onAdd,
  onEdit,
  onDelete,
}: {
  read: ContactsRead;
  busy: boolean;
  /** The add / rename form when one is open, drawn above the list. */
  form?: ReactNode;
  onAdd: () => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}) {
  const [query, setQuery] = useState("");
  const { permissions: may } = read;
  const q = query.trim().toLowerCase();
  const shown = read.contacts.filter((c) => !q || c.name.toLowerCase().includes(q));
  return (
    <SettingsCard
      title="Contacts"
      lead="The people and businesses on your expenses and payment requests. A contact you add here goes to Xero too when Xero is connected."
      readOnly={!may.add && !may.edit && !may.delete}
      action={
        may.add && !form ? <AddButton label="Add a contact" busy={busy} onClick={onAdd} /> : null
      }
    >
      {form}
      <Search label="Search contacts" value={query} onChange={setQuery} />
      {shown.length === 0 ? (
        <p className="text-sm text-set-mute" role="status">
          {read.contacts.length ? "No contacts match your search." : "No contacts yet."}
        </p>
      ) : (
        <ul className={LIST} aria-label="Contacts">
          {shown.map((c) => (
            <Row
              key={c.id}
              title={c.name}
              badges={
                <>
                  {c.in_xero ? <Badge>In Xero</Badge> : null}
                  {c.source === "template" ? <Badge>Comes with Minty</Badge> : null}
                </>
              }
              canEdit={c.own && may.edit}
              canDelete={c.own && may.delete}
              busy={busy}
              onEdit={() => onEdit(c)}
              onDelete={() => onDelete(c)}
            />
          ))}
        </ul>
      )}
    </SettingsCard>
  );
}

/** Add a contact, or rename one. */
export function ContactForm({
  read,
  editing,
  busy,
  onClose,
  onSubmit,
}: {
  read: ContactsRead;
  editing: Contact | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<Outcome>;
}) {
  const id = useId();
  const [name, setName] = useState(editing?.name ?? "");
  const [submitted, setSubmitted] = useState(false);
  const [server, setServer] = useState<string | null>(null);
  const others = read.contacts.filter((c) => c.id !== editing?.id);
  const problem = server ?? contactProblem(name, others, submitted);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (contactProblem(name, others, true)) {
      document.getElementById(id)?.focus();
      return;
    }
    const outcome = await onSubmit(name.replace(/\s+/g, " ").trim());
    if (!outcome.ok && outcome.fields?.name) setServer(outcome.fields.name);
  }

  return (
    <InlineForm
      title={editing ? `Rename ${editing.name}` : "Add a contact"}
      busy={busy}
      onClose={onClose}
      actions={
        <>
          <button
            type="button"
            className={`${SETTINGS_OUTLINE} flex-1`}
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="contact-form"
            className={`${SETTINGS_PRIMARY} flex-1`}
            disabled={busy}
          >
            {editing ? "Save" : "Add"}
          </button>
        </>
      }
    >
      <form id="contact-form" noValidate onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor={id} className={SETTINGS_LABEL}>
          Name{" "}
          <span className="text-danger" aria-hidden="true">
            *
          </span>
          <span className="sr-only"> (required)</span>
        </label>
        <input
          id={id}
          type="text"
          autoComplete="off"
          aria-required
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${id}-problem` : undefined}
          value={name}
          onChange={(e) => {
            setServer(null);
            setName(e.target.value);
          }}
          className={`${SETTINGS_INPUT} ${problem ? SETTINGS_INPUT_BAD : SETTINGS_INPUT_OK}`}
        />
        {problem ? (
          <p id={`${id}-problem`} className={SETTINGS_FIELD_ERROR}>
            {problem}
          </p>
        ) : editing?.in_xero ? (
          <p className="text-[12.5px] text-set-mute">The new name is used in Xero too.</p>
        ) : null}
      </form>
    </InlineForm>
  );
}

/** Delete asks first, saying what happens to the records and to Xero. */
export function DeleteDialog({
  row,
  busy,
  onClose,
  onConfirm,
}: {
  row: { name: string; used: boolean; in_xero: boolean };
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <SettingsDialog
      title={`Delete ${row.name}?`}
      busy={busy}
      onClose={onClose}
      actions={
        <>
          <button type="button" className={SETTINGS_OUTLINE} disabled={busy} onClick={onClose}>
            Go back
          </button>
          <button
            type="button"
            className={SETTINGS_DANGER_FILL}
            disabled={busy}
            onClick={onConfirm}
          >
            Delete
          </button>
        </>
      }
    >
      <p className="[overflow-wrap:anywhere]">{deleteNote(row)}</p>
    </SettingsDialog>
  );
}
