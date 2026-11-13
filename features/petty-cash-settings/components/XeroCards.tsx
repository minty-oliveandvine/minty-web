"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import { XeroNotConnected } from "@/components/ui/XeroNotConnected";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { SETTINGS_OUTLINE, SETTINGS_PRIMARY } from "@/components/ui/settingsButtons";
import { SETTINGS_FIELD_ERROR, SETTINGS_LABEL } from "@/components/ui/settingsFields";
import type { ApiRequest } from "@/lib/apiClient";

import {
  Combo,
  Icon,
  PettyCashCard,
  inputClass,
  type ComboRow,
} from "@/features/petty-cash-settings/components/parts";
import {
  CONTACT_EMPTY,
  MAPPING_GROUPS,
  accountOptions,
  codeLabel,
  codesBody,
  codesChanged,
  codesProblem,
  contactOptions,
  fieldsNamed,
  mappingBody,
  mappingChanged,
  mappingProblems,
  optionLabel,
  selectAllState,
  selectionOf,
  shownCodes,
  withContact,
  type AccountCode,
  type CodesAnswer,
  type MappingAnswer,
  type MappingField,
  type MappingKey,
  type Selection,
  type XeroOption,
  type XeroRead,
} from "@/features/petty-cash-settings/lib/xeroSettings";

/**
 * The two Xero cards of Petty Cash Settings (Flask's, Minty `1c25b35^1`, by way of
 * minty-petty-cash-web): "Account mapping" (titled "Xero account mapping" until 2026-11-12) and
 * "Petty Cash Account Code". Each saves on its
 * own: `PUT /settings/xero/mapping` and `PUT /settings/xero/account-codes`. Without a live
 * connection each keeps its heading and says "Xero isn't connected", linking to the Integration
 * tab. A company keeping its books in Minty (`minty`) draws both anyway, with its own accounts.
 */

export type XeroLoad =
  | { kind: "loading" }
  | { kind: "ready"; read: XeroRead }
  | { kind: "failed"; message: string; retry: boolean };

/** One call through the page: its busy overlay and refusal toast; null when it did not go through. */
export type Call = <T>(
  path: string,
  /** ``hub``: the call is accounts-api's (``/api/me/company/*``, the company as ``?entity=``). */
  init: ApiRequest & { hub?: boolean },
  busyText?: string,
  onRefused?: (message: string) => void,
) => Promise<T | null>;

const ADD = "__add__";
/** A contact picker's note, shown as the list opens (onboarding's wording). */
export const CONTACT_HINT = "Type a contact name to add a new contact";

/** Five pulsing rows while Xero is asked. */
function Skeleton() {
  return (
    <div className="flex flex-col gap-3 py-2" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex animate-pulse items-center justify-between gap-3">
          <span className="h-4 flex-1 rounded bg-set-line" />
          <span className="h-4 w-4 shrink-0 rounded bg-set-line" />
        </div>
      ))}
    </div>
  );
}

/** What a card shows before its read is ready: loading, or why it failed (with Try again when it may help). */
function NotReady({
  load,
  onRetry,
}: {
  load: Exclude<XeroLoad, { kind: "ready" }>;
  onRetry: () => void;
}) {
  if (load.kind === "loading") {
    return (
      <>
        <p className="sr-only" role="status">
          Loading…
        </p>
        <Skeleton />
      </>
    );
  }
  return (
    <div className="flex flex-col items-start gap-3" role="alert">
      <p className="text-sm text-set-ink-2">{load.message}</p>
      {load.retry ? (
        <button type="button" className={SETTINGS_OUTLINE} onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

// --- the mapping ---------------------------------------------------------------------------------

/** Tell the page whether this form holds unsaved changes - and that it holds none once it goes. */
function useDirtyReport(dirty: boolean, onDirty: ((dirty: boolean) => void) | undefined) {
  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);
}

export function XeroMappingCard({
  load,
  busy,
  call,
  connectHref,
  onRetry,
  onSaved,
  onAdded,
  onDirty,
  resetKey = 0,
}: {
  load: XeroLoad;
  busy: boolean;
  call: Call;
  connectHref: string;
  onRetry: () => void;
  /** The API's answer to a save that went through. */
  onSaved: (answer: MappingAnswer) => void;
  /** A contact was created: the success toast. */
  onAdded: (message: string) => void;
  /** Unsaved changes on the form, or none (the page's leave guard). */
  onDirty?: (dirty: boolean) => void;
  /** Bumped by the page to put the saved choices back ("Discard changes"). */
  resetKey?: number;
}) {
  const editable = load.kind === "ready" && load.read.permissions.edit_mapping;
  const minty = load.kind === "ready" && !!load.read.minty;
  return (
    <PettyCashCard
      // one title: the card is no longer Xero's alone (owner, 2026-11-12)
      title="Account mapping"
      lead="The accounts and contacts daily closing uses."
      readOnly={load.kind === "ready" && !editable}
      testId="xero-mapping"
    >
      {load.kind !== "ready" ? (
        <NotReady load={load} onRetry={onRetry} />
      ) : !load.read.mapping ? (
        <XeroNotConnected href={connectHref} />
      ) : (
        // a new read (a save) starts the form again from what the API holds
        <MappingForm
          key={`${resetKey}:${JSON.stringify(load.read.mapping)}`}
          fields={load.read.mapping}
          minty={minty}
          offline={!load.read.live}
          editable={editable}
          busy={busy}
          call={call}
          onSaved={onSaved}
          onAdded={onAdded}
          onDirty={onDirty}
        />
      )}
    </PettyCashCard>
  );
}

function MappingForm({
  fields: initial,
  minty = false,
  offline = false,
  editable,
  busy,
  call,
  onSaved,
  onAdded,
  onDirty,
}: {
  fields: MappingField[];
  /** Minty's own accounts: the field lines don't say "from Xero". */
  minty?: boolean;
  /** A Xero company without a live connection: its lines don't say "from Xero" either. */
  offline?: boolean;
  editable: boolean;
  busy: boolean;
  call: Call;
  onSaved: (answer: MappingAnswer) => void;
  onAdded: (message: string) => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const ids = useId();
  const idOf = (key: MappingKey) => `${ids}-${key}`;
  // the lists grow by a contact created here
  const [fields, setFields] = useState(initial);
  const [picked, setPicked] = useState<Selection>(() => selectionOf(initial));
  const labelOf = (key: MappingKey, id: string): string => {
    const option = fields.find((f) => f.key === key)?.options.find((o) => o.id === id);
    return option ? optionLabel(option) : "";
  };
  const [texts, setTexts] = useState<Record<MappingKey, string>>(() => {
    const start = selectionOf(initial);
    return Object.fromEntries(
      initial.map((f) => {
        const option = f.options.find((o) => o.id === start[f.key]);
        return [f.key, option ? optionLabel(option) : ""];
      }),
    ) as Record<MappingKey, string>;
  });
  const [refused, setRefused] = useState(false);
  // fields an API refusal named: the red edge until the field is changed
  const [marked, setMarked] = useState<ReadonlySet<MappingKey>>(new Set());
  const [adding, setAdding] = useState<{
    key: MappingKey;
    name: string;
    refusedEmpty: boolean;
  } | null>(null);
  const [summary, setSummary] = useState<MappingKey[] | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const problems = mappingProblems(fields, picked, refused);
  const changed = mappingChanged(initial, picked);
  const byKey = new Map(fields.map((f) => [f.key, f]));
  useDirtyReport(editable && changed, onDirty);

  useEffect(() => {
    if (summary && summary.length > 1) summaryRef.current?.focus();
  }, [summary]);

  function pick(key: MappingKey, option: XeroOption) {
    setPicked((p) => ({ ...p, [key]: option.id }));
    setTexts((t) => ({ ...t, [key]: optionLabel(option) }));
    setMarked((m) => {
      const next = new Set(m);
      next.delete(key);
      return next;
    });
  }

  function rows(field: MappingField) {
    return (query: string): ComboRow[] => {
      const current = labelOf(field.key, picked[field.key]);
      if (field.kind === "account") {
        const offered = accountOptions(field, query, current, picked);
        const out: ComboRow[] = offered.map((o) => ({
          key: o.id,
          label: o.name,
          sub: o.code || undefined,
          selected: o.id === picked[field.key],
        }));
        if (!offered.length) out.push({ key: "none", label: "No matches", info: true });
        return out;
      }
      const { matches, offerNew } = contactOptions(field, query, current);
      const out: ComboRow[] = [];
      // the note from the moment the list opens (owner, 2026-11-12; onboarding's MintySelect says the same)
      if (editable && !query.trim()) out.push({ key: "hint", label: CONTACT_HINT, info: true });
      out.push(
        ...matches.map((o) => ({ key: o.id, label: o.name, selected: o.id === picked[field.key] })),
      );
      if (!matches.length) out.push({ key: "none", label: "No contact found", info: true });
      if (offerNew !== null && editable) {
        out.push({
          key: ADD,
          label: offerNew ? `+ Add '${offerNew}' as a new contact` : "+ Add as a new contact",
          muted: true,
          divided: matches.length > 0,
        });
      }
      return out;
    };
  }

  async function createContact() {
    if (!adding || busy) return;
    const name = adding.name.trim();
    if (!name) {
      setAdding({ ...adding, refusedEmpty: true });
      document.getElementById(`${idOf(adding.key)}-new`)?.focus();
      return;
    }
    // Settings' contacts are accounts-api's (owner, 2026-11-12): accountant and up, made in Xero
    // too when the company is live, never a duplicate; named in the picker by its Xero id, else
    // its own
    const made = await call<{ contact: { id: string; name: string; xero_id: string | null } }>(
      "/api/me/company/contacts",
      { method: "POST", json: { name }, hub: true },
      "Creating contact…",
    );
    if (!made) return;
    const contact = { id: made.contact.xero_id || made.contact.id, name: made.contact.name };
    setFields((f) => withContact(f, contact));
    pick(adding.key, contact);
    const key = adding.key;
    setAdding(null);
    // back to the box, quietly: its list would open and cover the next box (Combo's QUIET_FOCUS)
    window.setTimeout(() => {
      const box = document.getElementById(idOf(key));
      if (!box) return;
      box.dataset.quietFocus = "1";
      box.focus();
    }, 0);
    onAdded("That contact's added!");
  }

  async function save() {
    if (!editable || busy) return;
    const now = mappingProblems(fields, picked, true);
    const wrong = fields.map((f) => f.key).filter((k) => now[k]);
    if (wrong.length) {
      setRefused(true);
      setSummary(wrong);
      if (wrong.length === 1) document.getElementById(idOf(wrong[0]))?.focus();
      return;
    }
    setSummary(null);
    const answer = await call<MappingAnswer>(
      "/settings/xero/mapping",
      { method: "PUT", json: mappingBody(picked) },
      undefined,
      (message) => setMarked(new Set(fieldsNamed(message, fields))),
    );
    if (answer) onSaved(answer);
  }

  return (
    <form
      noValidate
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {summary && summary.length > 1 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-[12px] border border-set-danger-line bg-set-warn-bg px-4 py-3 text-[13px] text-set-ink outline-none focus-visible:ring-2 focus-visible:ring-set-danger-line"
        >
          <p className="font-semibold">
            Some choices are still missing. Choose each one to save the mapping.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {summary.map((key) => (
              <li key={key}>
                <a
                  href={`#${idOf(key)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(idOf(key))?.focus();
                  }}
                  className="inline-block py-1 text-set-tab-ink underline underline-offset-2"
                >
                  {problems[key] ?? byKey.get(key)?.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {MAPPING_GROUPS.filter((group) => group.fields.some(({ key }) => byKey.has(key))).map(
        (group, gi) => (
          <div
            key={group.title}
            data-mapping-group={group.title}
            className={`flex min-w-0 flex-col gap-3 ${gi ? "border-t border-set-line pt-4" : ""}`}
          >
            <h4 className="text-[14.5px] font-semibold text-set-ink">{group.title}</h4>
            {group.fields.map(({ key, sub: line, placeholder }) => {
              const field = byKey.get(key);
              if (!field) return null;
              const sub = minty || offline ? line.replace(" from Xero", "") : line;
              const id = idOf(key);
              // the saved account archived: said until another is chosen (2026-11-13)
              const archivedName =
                field.archived && field.selected && picked[key] === field.selected
                  ? field.options.find((o) => o.id === field.selected)?.name || field.label
                  : null;
              const problem =
                problems[key] ??
                (archivedName
                  ? minty
                    ? `${archivedName} is archived. Choose another account to continue.`
                    : `${archivedName} is archived in Xero. Choose another account to keep publishing.`
                  : undefined);
              const problemId = `${id}-problem`;
              if (adding?.key === key) {
                const emptyNote = adding.refusedEmpty && !adding.name.trim() ? CONTACT_EMPTY : null;
                return (
                  <div key={key} className="flex min-w-0 flex-col gap-2">
                    <p className="text-[13px] text-set-ink-2">{sub}</p>
                    <div className="flex min-w-0 flex-col gap-3 rounded-[12px] border border-set-edge bg-white p-4">
                      <div className="flex min-w-0 flex-col">
                        <label className={SETTINGS_LABEL} htmlFor={`${id}-new`}>
                          New Contact
                          <RequiredMark />
                          <span className="sr-only"> (required)</span>
                        </label>
                        <input
                          id={`${id}-new`}
                          type="text"
                          autoComplete="off"
                          autoFocus
                          aria-required
                          placeholder="Enter a New Contact"
                          value={adding.name}
                          aria-invalid={emptyNote ? true : undefined}
                          aria-describedby={emptyNote ? `${id}-new-problem` : undefined}
                          onChange={(e) => setAdding({ ...adding, name: e.target.value })}
                          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void createContact();
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              setAdding(null);
                            }
                          }}
                          className={`${inputClass(Boolean(emptyNote))} placeholder:text-set-mute`}
                        />
                        {emptyNote ? (
                          <p id={`${id}-new-problem`} className={SETTINGS_FIELD_ERROR}>
                            {emptyNote}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => setAdding(null)}
                          className={`${SETTINGS_OUTLINE} flex-1`}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void createContact()}
                          className={`${SETTINGS_PRIMARY} flex-1`}
                        >
                          Create
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={key} className="flex min-w-0 flex-col">
                  <label className={SETTINGS_LABEL} htmlFor={id}>
                    {sub}
                    {field.optional ? (
                      <span className="font-normal text-set-mute"> (optional)</span>
                    ) : (
                      <span className="sr-only"> (required)</span>
                    )}
                  </label>
                  <Combo
                    id={id}
                    value={texts[key]}
                    placeholder={placeholder}
                    disabled={!editable}
                    required={!field.optional}
                    rotateChevron
                    invalid={Boolean(problem) || marked.has(key)}
                    describedBy={problem ? problemId : undefined}
                    rows={rows(field)}
                    onText={(t) => setTexts((all) => ({ ...all, [key]: t }))}
                    onPick={(optionId) => {
                      if (optionId === ADD) {
                        const typed = texts[key].trim();
                        const current = labelOf(key, picked[key]);
                        setAdding({
                          key,
                          name: typed === current ? "" : typed,
                          refusedEmpty: false,
                        });
                        setTexts((all) => ({ ...all, [key]: current }));
                        return;
                      }
                      const option = field.options.find((o) => o.id === optionId);
                      if (option) pick(key, option);
                    }}
                    onBlur={() => setTexts((all) => ({ ...all, [key]: labelOf(key, picked[key]) }))}
                  />
                  {problem ? (
                    <p id={problemId} className={SETTINGS_FIELD_ERROR}>
                      {problem}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ),
      )}

      {editable ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-set-line pt-4">
          <button type="submit" disabled={!changed || busy} className={SETTINGS_PRIMARY}>
            Save Changes
          </button>
        </div>
      ) : null}
    </form>
  );
}

// --- the account codes ---------------------------------------------------------------------------

export function AccountCodesCard({
  load,
  busy,
  call,
  connectHref,
  onRetry,
  onSaved,
  onDirty,
  resetKey = 0,
}: {
  load: XeroLoad;
  busy: boolean;
  call: Call;
  connectHref: string;
  onRetry: () => void;
  onSaved: (answer: CodesAnswer) => void;
  /** Unsaved ticks, or none (the page's leave guard). */
  onDirty?: (dirty: boolean) => void;
  /** Bumped by the page to put the saved ticks back ("Discard changes"). */
  resetKey?: number;
}) {
  const editable = load.kind === "ready" && load.read.permissions.edit_account_codes;
  return (
    <PettyCashCard
      title="Petty Cash Account Code"
      lead="Only the ticked account codes appear when you add an expense in Petty Cash."
      readOnly={load.kind === "ready" && !editable}
      testId="account-codes"
    >
      {load.kind !== "ready" ? (
        <NotReady load={load} onRetry={onRetry} />
      ) : // the codes are the stored accounts: shown with or without Xero (owner, 2026-11-12);
      // the notice only when there is nothing to tick
      !load.read.account_codes ||
        (!(load.read.live || load.read.minty) && load.read.account_codes.length === 0) ? (
        <XeroNotConnected href={connectHref} />
      ) : (
        <CodesForm
          key={`${resetKey}:${JSON.stringify(load.read.account_codes)}`}
          codes={load.read.account_codes}
          editable={editable}
          busy={busy}
          call={call}
          onSaved={onSaved}
          onDirty={onDirty}
        />
      )}
    </PettyCashCard>
  );
}

function CodesForm({
  codes,
  editable,
  busy,
  call,
  onSaved,
  onDirty,
}: {
  codes: AccountCode[];
  editable: boolean;
  busy: boolean;
  call: Call;
  onSaved: (answer: CodesAnswer) => void;
  onDirty?: (dirty: boolean) => void;
}) {
  const searchId = useId();
  const hintId = useId();
  const [query, setQuery] = useState("");
  const [ticked, setTicked] = useState<ReadonlySet<string>>(
    () => new Set(codes.filter((r) => r.selected).map((r) => r.code)),
  );
  const rows = shownCodes(codes, query);
  const all = selectAllState(rows, ticked);
  const problem = editable ? codesProblem(codes, ticked) : null;
  const changed = codesChanged(codes, ticked);
  const hasCodes = shownCodes(codes, "").length > 0;
  useDirtyReport(editable && changed, onDirty);

  function set(changes: string[], on: boolean) {
    setTicked((t) => {
      const next = new Set(t);
      for (const code of changes) {
        if (on) next.add(code);
        else next.delete(code);
      }
      return next;
    });
  }

  async function save() {
    if (!editable || busy || problem || !changed) return;
    const answer = await call<CodesAnswer>("/settings/xero/account-codes", {
      method: "PUT",
      json: codesBody(ticked),
    });
    if (answer) onSaved(answer);
  }

  return (
    <form
      noValidate
      className="flex min-w-0 flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="relative min-w-0">
        <label htmlFor={searchId} className="sr-only">
          Search account code
        </label>
        <input
          id={searchId}
          type="search"
          autoComplete="off"
          placeholder="Search account code"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Enter in the search box filters; it never saves
            if (e.key === "Enter") e.preventDefault();
          }}
          className={`${inputClass(false)} pr-11 placeholder:text-set-mute`}
        />
        <Icon
          name="search"
          className="pointer-events-none absolute inset-y-0 right-3 items-center text-[20px] text-set-mute"
        />
      </div>

      {!hasCodes ? (
        <p className="py-8 text-center text-sm text-set-mute">
          No account codes yet - I&apos;ll show them here once Xero&apos;s connected.
        </p>
      ) : (
        <>
          <ul
            aria-label="Account codes"
            // a long chart scrolls in its own box, Select all pinned on top (owner, 2026-11-12); the
            // page around it scrolls with the document, never a second frame
            className="m-0 max-h-[min(24rem,50vh)] list-none overflow-y-auto overscroll-contain rounded-[12px] border border-set-line p-0 [scrollbar-gutter:stable] [scrollbar-width:thin]"
          >
            <li
              className={`sticky top-0 z-10 border-b border-set-line ${editable ? "bg-white" : "bg-set-pill"}`}
            >
              <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3.5 py-3">
                <span className="min-w-0 flex-1 text-right text-sm font-medium text-set-ink-2">
                  Select all
                </span>
                <Tick
                  checked={all === "all"}
                  indeterminate={all === "some"}
                  disabled={!editable || rows.length === 0}
                  label="Select all visible account codes"
                  onChange={(on) =>
                    set(
                      rows.map((r) => r.code),
                      on,
                    )
                  }
                />
              </label>
            </li>
            {rows.map((row, i) => (
              <li
                key={row.code}
                className={i ? "border-t border-set-line" : ""}
                data-code={row.code}
              >
                <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3.5 py-3">
                  <span className="min-w-0 flex-1 text-[14.5px] text-set-ink [overflow-wrap:anywhere]">
                    {codeLabel(row)}
                  </span>
                  <Tick
                    checked={ticked.has(row.code)}
                    disabled={!editable}
                    onChange={(on) => set([row.code], on)}
                  />
                </label>
              </li>
            ))}
          </ul>
          {rows.length === 0 ? (
            <p className="text-center text-sm text-set-mute">No codes match your search.</p>
          ) : null}
        </>
      )}

      {editable ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-set-line pt-4">
          <button
            type="submit"
            disabled={!changed || Boolean(problem) || busy}
            aria-describedby={problem ? hintId : undefined}
            className={SETTINGS_PRIMARY}
          >
            Save Changes
          </button>
          {problem ? (
            <p id={hintId} role="status" className="text-[13px] text-danger">
              {problem}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

/** A tick box: the Minty Action fill with a white tick when on, a white bar when some are on. */
function Tick({
  checked,
  indeterminate = false,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled: boolean;
  label?: string;
  onChange: (on: boolean) => void;
}) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current) box.current.indeterminate = indeterminate;
  }, [indeterminate]);
  const GLYPH =
    "pointer-events-none absolute inset-0 m-auto hidden h-3.5 w-3.5 fill-white peer-disabled:opacity-40";
  return (
    <span className="relative inline-flex h-5 w-5 shrink-0">
      <input
        ref={box}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.checked)}
        className="peer m-0 h-5 w-5 cursor-pointer appearance-none rounded-[6px] border border-set-edge bg-white checked:border-action checked:bg-action indeterminate:border-action indeterminate:bg-action focus:outline-none focus-visible:ring-2 focus-visible:ring-set-tab disabled:cursor-not-allowed disabled:opacity-40"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`${GLYPH} ${indeterminate ? "" : "peer-checked:block"}`}
      >
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`${GLYPH} ${indeterminate ? "block" : ""}`}
      >
        <path d="M6 11h12v2H6z" />
      </svg>
    </span>
  );
}
