"use client";

/**
 * The payer's side of a handover, drawn (Figma 07-A/B/C): the picker card - "SELECT NEW
 * SUBSCRIBER FOR THIS ENTITY (Admin Role Only)", a row per admin with the current payer tagged,
 * "Invite someone new", Cancel / Request transfer - beside Minty handing the papers to Lemon;
 * the pending state - the amber notice, the person with a Pending tag, Back / Withdraw request
 * - beside Minty with a clock; and "Transfer requested", Lemon stamping the papers. Everything
 * shown is the hook's (`useTransferSubscription`).
 */

import Image from "next/image";

import type { SubscriberCandidate } from "@/features/subscription/api/payerPortal";
import {
  INVITE_HEADING,
  INVITE_PLACEHOLDER,
  NO_ADMINS,
  PICK_HEADING,
  REQUEST_TRANSFER,
  REQUEST_WAITING,
  WITHDRAW_REQUEST,
  pendingSentence,
} from "@/features/subscription/lib/transfer";
import { EMAIL_ASCII_HINT, useEmailInput } from "@/lib/emailInput";

/** "Send request to take over … paid up until <date> …", the company teal and the date bold. */
export function ResponsibilityNote({ note, entityName }: { note: string; entityName: string }) {
  const parts = note.split(entityName);
  const dated = /paid up until ([^.]+)\./.exec(note);
  const date = dated?.[1] ?? null;
  const tail = parts[1] ?? "";
  const [beforeDate, afterDate] = date ? tail.split(date) : [tail, ""];
  return (
    <p className="text-body-l text-ink-muted">
      {parts[0]}
      <span className="text-link">{entityName}</span>
      {date ? (
        <>
          {beforeDate}
          <span className="text-ink">{date}</span>
          {afterDate}
        </>
      ) : (
        tail
      )}
    </p>
  );
}

function CandidateRow({
  person,
  selected,
  onSelect,
}: {
  person: SubscriberCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const current = person.is_current;
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${
        selected ? "border-line-selected bg-selected" : "border-line bg-card hover:bg-hover"
      } ${current ? "cursor-default" : ""}`}
    >
      <input
        type="radio"
        name="subscriber"
        value={person.id}
        checked={selected}
        disabled={current}
        onChange={onSelect}
        className="size-[18px] shrink-0 accent-[var(--mv2-border-selected)]"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-m font-semibold text-ink">
          {person.name || person.email}
        </span>
        <span className="block truncate text-body-s text-ink-2">
          {person.email || "No email on file"}
        </span>
      </span>
      {current && (
        <span className="shrink-0 rounded-lg bg-sunk px-2.5 py-1 text-label font-semibold text-ink-2">
          Current
        </span>
      )}
    </label>
  );
}

export type PickerHandlers = {
  onSelect: (id: string) => void;
  onInviteChange: (value: string) => void;
  onSendInvite: () => void;
  onCancel: () => void;
  onRequest: () => void;
};

export function SubscriberPicker({
  candidates,
  selected,
  blockers,
  invite,
  inviting,
  inviteError,
  invited,
  busy,
  canRequest,
  sendError,
  loading,
  on,
}: {
  candidates: SubscriberCandidate[];
  selected: string | null;
  blockers: string[];
  invite: string;
  inviting: boolean;
  inviteError: string | null;
  invited: string | null;
  busy: boolean;
  canRequest: boolean;
  sendError: string | null;
  loading: boolean;
  on: PickerHandlers;
}) {
  const inviteEmail = useEmailInput(on.onInviteChange);
  return (
    <section
      aria-label="Select new subscriber"
      className="flex w-full max-w-[720px] flex-col gap-4 rounded-xl border border-line bg-card p-8"
    >
      <p className="text-body-s font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {PICK_HEADING}
      </p>

      {blockers.length > 0 && (
        <div
          role="status"
          className="rounded-xl border border-line bg-warning-bg px-4 py-3 text-sm text-warning"
        >
          {blockers.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[62px] animate-pulse rounded-xl border border-line bg-sunk"
            />
          ))
        ) : candidates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-5 py-8 text-center text-sm text-ink-2">
            {NO_ADMINS}
          </p>
        ) : (
          candidates.map((person) => (
            <CandidateRow
              key={person.id}
              person={person}
              selected={selected === person.id}
              onSelect={() => on.onSelect(person.id)}
            />
          ))
        )}
      </div>

      <hr className="border-line-subtle" />

      <div className="flex flex-col gap-2">
        <label htmlFor="inviteEmail" className="text-sm font-semibold text-ink-2">
          {INVITE_HEADING}
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-line-input bg-card pr-2 focus-within:border-line-selected focus-within:ring-2 focus-within:ring-line-selected/25">
          <input
            id="inviteEmail"
            {...inviteEmail.props}
            value={invite}
            placeholder={INVITE_PLACEHOLDER}
            aria-describedby={inviteEmail.rejected ? "inviteEmail-hint" : undefined}
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-body-m text-ink placeholder:text-ink-muted focus:outline-none"
          />
          <button
            type="button"
            onClick={on.onSendInvite}
            disabled={inviting || !invite.trim()}
            className="min-h-11 shrink-0 rounded-xl px-3 py-1.5 text-body-m font-semibold text-link hover:opacity-80 disabled:cursor-not-allowed disabled:text-ink-disabled"
          >
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </div>
        {inviteEmail.rejected && (
          <p id="inviteEmail-hint" className="text-sm text-danger" role="status">
            {EMAIL_ASCII_HINT}
          </p>
        )}
        {inviteError && (
          <p className="text-sm text-danger" role="alert">
            {inviteError}
          </p>
        )}
        {invited && (
          <p className="text-sm text-success" role="status">
            {invited}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={on.onCancel}
          className="min-h-11 rounded-xl border border-line bg-card px-6 py-2.5 text-body-m font-semibold text-ink hover:bg-hover"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={on.onRequest}
          disabled={!canRequest}
          className="min-h-11 rounded-xl bg-action px-6 py-2.5 text-body-m font-semibold text-white hover:bg-action-hover active:bg-action-pressed disabled:cursor-not-allowed disabled:bg-action-disabled disabled:text-ink-disabled"
        >
          {busy ? "Sending…" : REQUEST_TRANSFER}
        </button>
      </div>
      {sendError && (
        <p className="text-right text-sm text-danger" role="alert">
          {sendError}
        </p>
      )}
    </section>
  );
}

export function PendingRequestPanel({
  recipient,
  busy,
  sendError,
  onBack,
  onWithdraw,
}: {
  recipient: { name: string; email: string; since: Date | null };
  busy: boolean;
  sendError: string | null;
  onBack: () => void;
  onWithdraw: () => void;
}) {
  return (
    <section aria-label="Request pending" className="flex w-full max-w-[760px] flex-col gap-6">
      <div
        role="status"
        className="rounded-xl border border-line bg-warning-bg px-5 py-4 text-body-l text-warning"
      >
        <p className="font-bold">{REQUEST_WAITING}</p>
        <p className="mt-1">{pendingSentence(recipient)}</p>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-xl border border-line bg-card px-8 py-5">
        <div className="min-w-0">
          <p className="truncate text-title-m font-semibold text-ink">
            {recipient.name || recipient.email}
          </p>
          <p className="truncate text-body-m text-ink-2">{recipient.email}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-sunk px-5 py-2 text-sm font-semibold text-ink-2">
          Pending
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-4">
        <button
          type="button"
          onClick={onBack}
          className="h-[52px] w-[150px] rounded-xl border border-line bg-card text-title-m font-semibold text-ink hover:bg-hover"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onWithdraw}
          disabled={busy}
          className="h-[52px] w-[240px] rounded-xl border border-danger bg-card text-title-m font-semibold text-danger hover:bg-danger-bg disabled:opacity-60"
        >
          {busy ? "Withdrawing…" : WITHDRAW_REQUEST}
        </button>
      </div>
      {sendError && (
        <p className="text-right text-sm text-danger" role="alert">
          {sendError}
        </p>
      )}
    </section>
  );
}

export function TransferRequested({
  email,
  note,
  entityName,
  onBack,
}: {
  email: string;
  note: string;
  entityName: string;
  onBack: () => void;
}) {
  return (
    <section
      aria-label="Transfer requested"
      className="grid grid-cols-1 items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:px-6"
    >
      <div className="flex flex-col gap-6">
        <h2 className="text-[40px] font-bold leading-tight text-link">Transfer requested</h2>
        <div className="flex flex-col gap-3 pl-5">
          <p className="text-body-l text-ink-muted">
            Request has been sent to <span className="text-link">{email}</span>.
          </p>
          <ResponsibilityNote
            note={note.replace(/^Send request to take over the subscription\. /, "")}
            entityName={entityName}
          />
        </div>
        <button
          type="button"
          onClick={onBack}
          className="h-[66px] w-[368px] max-w-full rounded-xl bg-action text-xl font-bold text-white hover:bg-action-hover active:bg-action-pressed"
        >
          Back to Manage Subscription
        </button>
      </div>
      <Image
        src="/portal/lemon-approved.png"
        alt=""
        width={400}
        height={455}
        unoptimized
        className="justify-self-center"
      />
    </section>
  );
}
