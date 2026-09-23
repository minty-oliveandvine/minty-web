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

/** "Send request to take over … paid up until <date> …", the company teal and the date bold. */
export function ResponsibilityNote({ note, entityName }: { note: string; entityName: string }) {
  const parts = note.split(entityName);
  const dated = /paid up until ([^.]+)\./.exec(note);
  const date = dated?.[1] ?? null;
  const tail = parts[1] ?? "";
  const [beforeDate, afterDate] = date ? tail.split(date) : [tail, ""];
  return (
    <p className="text-[15px] text-[#a0a8b2]">
      {parts[0]}
      <span className="text-[#219994]">{entityName}</span>
      {date ? (
        <>
          {beforeDate}
          <span className="text-[#16202e]">{date}</span>
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
      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 ${
        selected ? "border-[#2e9b9b] bg-[#f0faf9]" : "border-[#e6ebed] bg-white hover:bg-[#f7f9fa]"
      } ${current ? "cursor-default" : ""}`}
    >
      <input
        type="radio"
        name="subscriber"
        value={person.id}
        checked={selected}
        disabled={current}
        onChange={onSelect}
        className="size-[18px] shrink-0 accent-[#2e9b9b]"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-[#21262e]">
          {person.name || person.email}
        </span>
        <span className="block truncate text-[13px] text-[#6b7380]">
          {person.email || "No email on file"}
        </span>
      </span>
      {current && (
        <span className="shrink-0 rounded-md bg-[#eff1f4] px-2.5 py-1 text-xs font-semibold text-[#6b7380]">
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
  charge,
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
  charge: string | null;
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
  return (
    <section
      aria-label="Select new subscriber"
      className="flex w-full max-w-[720px] flex-col gap-4 rounded-2xl border border-[#e6ebed] bg-white p-8"
    >
      <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#9aa3ae]">
        {PICK_HEADING}
      </p>

      {blockers.length > 0 && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
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
              className="h-[62px] animate-pulse rounded-lg border border-[#e6ebed] bg-[#f7f9fa]"
            />
          ))
        ) : candidates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[#e6ebed] px-5 py-8 text-center text-sm text-[#6b7380]">
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

      {charge && (
        <p className="text-sm text-[#6b7380]" data-charge>
          {charge}
        </p>
      )}

      <hr className="border-[#eef1f4]" />

      <div className="flex flex-col gap-2">
        <label htmlFor="inviteEmail" className="text-sm font-semibold text-[#374151]">
          {INVITE_HEADING}
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white pr-2 focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/20">
          <input
            id="inviteEmail"
            type="email"
            value={invite}
            onChange={(e) => on.onInviteChange(e.target.value)}
            placeholder={INVITE_PLACEHOLDER}
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[15px] text-[#16202e] placeholder:text-[#9ca3af] focus:outline-none"
          />
          <button
            type="button"
            onClick={on.onSendInvite}
            disabled={inviting || !invite.trim()}
            className="shrink-0 rounded-lg px-3 py-1.5 text-[15px] font-semibold text-[#2e9b9b] hover:opacity-80 disabled:cursor-not-allowed disabled:text-[#b4bac3]"
          >
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </div>
        {inviteError && (
          <p className="text-sm text-[#b42318]" role="alert">
            {inviteError}
          </p>
        )}
        {invited && (
          <p className="text-sm text-[#267347]" role="status">
            {invited}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={on.onCancel}
          className="rounded-lg border border-[#d8dee4] bg-white px-6 py-2.5 text-[15px] font-semibold text-[#292e38] hover:bg-[#f5f7fa]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={on.onRequest}
          disabled={!canRequest}
          className="rounded-lg bg-[#4fc7c7] px-6 py-2.5 text-[15px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Sending…" : REQUEST_TRANSFER}
        </button>
      </div>
      {sendError && (
        <p className="text-right text-sm text-[#b42318]" role="alert">
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
        className="rounded-lg border border-[#f0b25a] bg-[#fff7ec] px-5 py-4 text-[15px] text-[#cc7f03]"
      >
        <p className="font-bold">{REQUEST_WAITING}</p>
        <p className="mt-1">{pendingSentence(recipient)}</p>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border border-[#e6ebed] bg-white px-8 py-5">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-semibold text-[#21262e]">
            {recipient.name || recipient.email}
          </p>
          <p className="truncate text-[15px] text-[#6b7380]">{recipient.email}</p>
        </div>
        <span className="shrink-0 rounded-md bg-[#eff1f4] px-5 py-2 text-sm font-semibold text-[#6b7380]">
          Pending
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-4">
        <button
          type="button"
          onClick={onBack}
          className="h-[52px] w-[150px] rounded-lg border border-[#d8dee4] bg-white text-[17px] font-semibold text-[#292e38] hover:bg-[#f5f7fa]"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onWithdraw}
          disabled={busy}
          className="h-[52px] w-[240px] rounded-lg border border-[#e3a1a1] bg-white text-[17px] font-semibold text-[#dc5a5a] hover:bg-[#fef3f2] disabled:opacity-60"
        >
          {busy ? "Withdrawing…" : WITHDRAW_REQUEST}
        </button>
      </div>
      {sendError && (
        <p className="text-right text-sm text-[#b42318]" role="alert">
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
        <h2 className="text-[40px] font-bold leading-tight text-[#54d3da]">Transfer requested</h2>
        <div className="flex flex-col gap-3 pl-5">
          <p className="text-[15px] text-[#a0a8b2]">
            Request has been sent to <span className="text-[#219994]">{email}</span>.
          </p>
          <ResponsibilityNote
            note={note.replace(/^Send request to take over the subscription\. /, "")}
            entityName={entityName}
          />
        </div>
        <button
          type="button"
          onClick={onBack}
          className="h-[66px] w-[368px] max-w-full rounded-[24px] bg-[#54d3da] text-xl font-bold text-white hover:opacity-90"
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
