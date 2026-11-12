"use client";

import { type DragEvent, useEffect, useId, useRef, useState } from "react";

import { SETTINGS_OUTLINE, SETTINGS_PRIMARY } from "@/components/ui/settingsButtons";
import { SETTINGS_FIELD_ERROR, SETTINGS_LABEL } from "@/components/ui/settingsFields";

import {
  Combo,
  Icon,
  PettyCashCard,
  inputClass,
  type ComboRow,
} from "@/features/petty-cash-settings/components/parts";
import {
  ADD_NAME_MAX,
  KIND,
  NAME_EMPTY,
  RENAME_NAME_MAX,
  catalogueOptions,
  kindFor,
  methodNameProblem,
  type CatalogueMethod,
  type MethodType,
  type SalesGroups,
  type SalesMethod,
  type SettingsPermissions,
} from "@/features/petty-cash-settings/lib/settings";

const OTHER = "__other__";
/** The picker's note, shown on top as the list opens (owner, 2026-11-12; the contact pickers' way). */
export const METHOD_HINT = "Type a method name to add a new method";

/** What the card asks the page to send; each resolves true once the API said yes. */
export type MethodActions = {
  add: (type: MethodType, body: { sale_info_id: string } | { name: string }) => Promise<boolean>;
  rename: (method: SalesMethod, name: string) => Promise<boolean>;
  move: (type: MethodType, index: number, step: -1 | 1) => void;
  /** A dragged method dropped on the row at `to`. */
  place: (type: MethodType, from: number, to: number) => void;
  remove: (type: MethodType, method: SalesMethod) => void;
  /** The error toast. */
  say: (message: string) => void;
};

/**
 * One of the Electronic / Delivery cards (Flask's `partials/electronic_delivery_section.html`):
 * the methods in order and "Add New Method" - the catalogue picker, or a new name typed into it.
 * A row reads name, then its actions (owner, 2026-11-12): the company's own method has a pencil
 * (an inline rename) and a bin (delete); Minty's has only a bin that takes it off the company's
 * list; both keep the drag handle. Each change is the API's at once; the page shows its answer.
 */
export function SalesMethodsCard({
  type,
  methods,
  available,
  permissions,
  busy,
  actions,
  groups,
}: {
  type: MethodType;
  methods: SalesMethod[];
  available: CatalogueMethod[];
  permissions: SettingsPermissions;
  busy: boolean;
  actions: MethodActions;
  /** The API's `sales_groups`: a Non-cash company's electronic card is titled Non-cash. */
  groups?: SalesGroups;
}) {
  const kind = kindFor(type, groups);
  const editable =
    permissions.add_sales_method ||
    permissions.rename_sales_method ||
    permissions.remove_sales_method ||
    permissions.reorder_sales_methods;
  const canMove = permissions.reorder_sales_methods && methods.length > 1;
  const [renaming, setRenaming] = useState<string | null>(null);
  // the row being dragged and the row it is over
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  let note: string | null = null;
  if (!permissions.view_sales_methods)
    note = "You can't see the sales methods. Ask an Accountant or an Admin.";
  else if (!methods.length) note = `No ${kind.title.toLowerCase()} methods yet.`;

  return (
    <PettyCashCard
      title={kind.title}
      lead={kind.sub}
      readOnly={!editable}
      testId={type}
      // the add button at the card's top right (owner, 2026-11-12)
      headerAction={
        permissions.add_sales_method && !adding ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setAdding(true)}
            className={`${SETTINGS_OUTLINE} -mt-2.5 shrink-0`}
          >
            <Icon name="add" className="text-[20px]" />
            Add New Method
          </button>
        ) : null
      }
    >
      {/* the add form opens inline above the list - no dialog (owner, 2026-11-12) */}
      {permissions.add_sales_method && adding ? (
        <AddForm
          type={type}
          methods={methods}
          available={available}
          busy={busy}
          actions={actions}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {note ? (
        <p className="text-sm text-set-mute" role="status">
          {note}
        </p>
      ) : null}
      <ul
        className={`m-0 list-none p-0 ${methods.length ? "border-t border-set-line" : ""}`}
        aria-label={`${kind.title} methods`}
      >
        {methods.map((method, index) => (
          <li
            key={method.id}
            data-method={method.name}
            onDragOver={(e) => {
              if (dragFrom === null) return;
              e.preventDefault();
              if (dragOver !== index) setDragOver(index);
            }}
            onDragLeave={() => {
              if (dragOver === index) setDragOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragFrom !== null && dragFrom !== index) actions.place(type, dragFrom, index);
              setDragFrom(null);
              setDragOver(null);
            }}
            className={`border-b transition-[border-color,opacity] ${
              dragOver === index && dragFrom !== index ? "border-set-tab-ink" : "border-set-line"
            } ${dragFrom === index ? "opacity-45" : ""}`}
          >
            <div className="flex min-h-12 min-w-0 items-center justify-between gap-3 py-0.5">
              {renaming === method.id ? (
                <RenameBox
                  method={method}
                  listed={methods}
                  onDone={() => setRenaming(null)}
                  onCommit={(name) => actions.rename(method, name)}
                />
              ) : (
                <span className="min-w-0 truncate text-[14.5px] text-set-ink">{method.name}</span>
              )}
              {renaming !== method.id &&
              ((method.own && permissions.rename_sales_method) ||
                permissions.remove_sales_method ||
                canMove) ? (
                <div className="flex shrink-0 items-center gap-1">
                  {method.own && permissions.rename_sales_method ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setRenaming(method.id)}
                      aria-label={`Edit ${method.name}`}
                      title="Edit"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] text-set-mute transition-colors enabled:hover:bg-set-pill enabled:hover:text-set-ink disabled:cursor-not-allowed"
                    >
                      <Icon name="edit" className="text-[22px]" />
                    </button>
                  ) : null}
                  {permissions.remove_sales_method ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => actions.remove(type, method)}
                      aria-label={
                        method.own ? `Delete ${method.name}` : `Remove ${method.name} from my list`
                      }
                      title={method.own ? "Delete" : "Remove from my list"}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] text-set-mute transition-colors enabled:hover:bg-[#fdecec] enabled:hover:text-[#d9534f] disabled:cursor-not-allowed"
                    >
                      <Icon
                        name={method.own ? "delete" : "playlist_remove"}
                        className="text-[22px]"
                      />
                    </button>
                  ) : null}
                  {canMove ? (
                    <DragHandle
                      label={`Move ${method.name}`}
                      disabled={busy}
                      onDragStart={(e) => {
                        setDragFrom(index);
                        e.dataTransfer?.setData("text/plain", method.id);
                        if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragFrom(null);
                        setDragOver(null);
                      }}
                      onStep={(step) => actions.move(type, index, step)}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </PettyCashCard>
  );
}

/** The rename: the name becomes a box; Enter or leaving saves, Escape puts it back. */
function RenameBox({
  method,
  listed,
  onDone,
  onCommit,
}: {
  method: SalesMethod;
  listed: SalesMethod[];
  onDone: () => void;
  onCommit: (name: string) => Promise<boolean>;
}) {
  const [text, setText] = useState(method.name);
  const box = useRef<HTMLInputElement>(null);
  const problemId = useId();
  const problem = methodNameProblem(text, listed, RENAME_NAME_MAX, method.id);
  // a ref: Enter then the blur it causes must send once
  const done = useRef(false);

  useEffect(() => {
    box.current?.focus();
    box.current?.select();
  }, []);

  async function finish(commit: boolean) {
    if (done.current) return;
    const next = text.trim();
    // nothing typed, or the same name: put it back, as Flask did
    if (!commit || !next || next === method.name) {
      done.current = true;
      onDone();
      return;
    }
    if (problem) return; // said under the box; the box stays
    done.current = true;
    await onCommit(next);
    onDone();
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col py-1.5">
      <input
        ref={box}
        type="text"
        value={text}
        aria-label={`Rename ${method.name}`}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? problemId : undefined}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void finish(true);
          } else if (e.key === "Escape") {
            e.preventDefault();
            void finish(false);
          }
        }}
        onBlur={() => void finish(true)}
        className={`${inputClass(Boolean(problem))} max-w-80`}
      />
      {problem ? (
        <p id={problemId} className={SETTINGS_FIELD_ERROR}>
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/** The row's ⋮, then a card of its actions. */
/** The handle (owner, 2026-11-12: no Move up / Move down): drag it to reorder; with the keyboard,
 * the up and down arrows move the method one place. */
function DragHandle({
  label,
  disabled,
  onDragStart,
  onDragEnd,
  onStep,
}: {
  label: string;
  disabled: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onStep: (step: -1 | 1) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-description="Drag to reorder, or use the up and down arrow keys."
      title="Drag to reorder"
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onKeyDown={(e) => {
        if (disabled || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
        e.preventDefault();
        onStep(e.key === "ArrowUp" ? -1 : 1);
      }}
      className="inline-flex h-11 w-11 cursor-grab items-center justify-center rounded-[12px] text-set-mute transition-colors hover:bg-set-pill hover:text-set-ink active:cursor-grabbing"
    >
      <Icon name="drag_handle" className="text-[22px]" />
    </button>
  );
}

type Choice = { id: string; name: string } | "other" | null;

/** "Add New Method": the catalogue picker - or a name typed into it, "+ Add '<name>' as a new
 * method" opening the Name box with it (owner, 2026-11-12: as the contact pickers) - Cancel / Add. */
function AddForm({
  type,
  methods,
  available,
  busy,
  actions,
  onClose,
}: {
  type: MethodType;
  methods: SalesMethod[];
  available: CatalogueMethod[];
  busy: boolean;
  actions: MethodActions;
  onClose: () => void;
}) {
  const kind = KIND[type];
  const catalogId = useId();
  const nameId = useId();
  const nameProblemId = useId();
  const [text, setText] = useState("");
  const [choice, setChoice] = useState<Choice>(null);
  const [name, setName] = useState("");
  const [refusedEmpty, setRefusedEmpty] = useState(false);
  const catalog = useRef<HTMLInputElement | null>(null);
  const nameBox = useRef<HTMLInputElement>(null);
  const nameProblem =
    methodNameProblem(name, methods, ADD_NAME_MAX) ??
    (refusedEmpty && !name.trim() ? NAME_EMPTY : null);

  useEffect(() => {
    catalog.current = document.getElementById(catalogId) as HTMLInputElement | null;
    catalog.current?.focus();
  }, [catalogId]);

  useEffect(() => {
    if (choice === "other") nameBox.current?.focus();
  }, [choice]);

  function rows(query: string): ComboRow[] {
    const typed = query.trim();
    const offered = catalogueOptions(available, query);
    const out: ComboRow[] = [];
    // the note on top as soon as the list opens, as every contact picker has it
    if (!typed) out.push({ key: "hint", label: METHOD_HINT, info: true });
    out.push(...offered.map((m) => ({ key: m.id, label: m.name })));
    const known = (n: string) => n.trim().toLowerCase() === typed.toLowerCase();
    if (typed && !available.some((m) => known(m.name)) && !methods.some((m) => known(m.name)))
      out.push({ key: OTHER, label: `+ Add '${typed}' as a new method` });
    if (typed && !offered.length)
      out.push({ key: "none", label: `No matching ${kind.noun} found`, info: true });
    return out;
  }

  async function commit() {
    if (busy) return;
    if (choice === "other") {
      const wanted = name.trim();
      if (!wanted) {
        setRefusedEmpty(true);
        nameBox.current?.focus();
        return;
      }
      if (nameProblem) {
        nameBox.current?.focus();
        return;
      }
      if (await actions.add(type, { name: wanted })) onClose();
      return;
    }
    if (choice) {
      if (await actions.add(type, { sale_info_id: choice.id })) onClose();
      return;
    }
    actions.say("Pick a method from the list, or type a new name to add it.");
    catalog.current?.focus();
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void commit();
      }}
    >
      <div className="flex min-w-0 flex-col">
        <label className={SETTINGS_LABEL} htmlFor={catalogId}>
          Method
        </label>
        <Combo
          id={catalogId}
          value={text}
          placeholder={kind.pick}
          rows={rows}
          rotateChevron
          onText={(t) => {
            // typing filters the list; nothing is chosen until a row is picked
            setText(t);
            setChoice(null);
          }}
          onPick={(key) => {
            if (key === OTHER) {
              // the typed name goes into the Name box, to check or change before Add
              setChoice("other");
              setName(text.trim());
              setRefusedEmpty(false);
              return;
            }
            const picked = available.find((m) => m.id === key);
            if (!picked) return;
            setChoice({ id: picked.id, name: picked.name });
            setText(picked.name);
          }}
          onBlur={() => setText((t) => (choice && choice !== "other" ? choice.name : t))}
        />
      </div>
      {choice === "other" ? (
        <div className="flex min-w-0 flex-col">
          <label className={SETTINGS_LABEL} htmlFor={nameId}>
            Name
          </label>
          <input
            ref={nameBox}
            id={nameId}
            type="text"
            autoComplete="off"
            placeholder={kind.enter}
            value={name}
            aria-invalid={nameProblem ? true : undefined}
            aria-describedby={nameProblem ? nameProblemId : undefined}
            onChange={(e) => setName(e.target.value)}
            className={`${inputClass(Boolean(nameProblem))} placeholder:text-set-mute`}
          />
          {nameProblem ? (
            <p id={nameProblemId} className={SETTINGS_FIELD_ERROR}>
              {nameProblem}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onClose} className={`${SETTINGS_OUTLINE} flex-1`}>
          Cancel
        </button>
        <button type="submit" disabled={busy} className={`${SETTINGS_PRIMARY} flex-1`}>
          Add
        </button>
      </div>
    </form>
  );
}
