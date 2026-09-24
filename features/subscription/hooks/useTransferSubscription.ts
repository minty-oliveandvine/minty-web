"use client";

/**
 * The payer's side of a handover (Figma 07-A/B/C/K): pick the new subscriber, or withdraw the
 * request already out. The screen calls this and renders what it returns.
 *
 * It OFFERS the handover; it does not perform one. Picking someone sends them a request, and
 * nothing about the company changes until they accept - at which point Minty charges THEM for
 * the days the current payer's money does not cover, and the subscription moves. Two things
 * arrive from the server rather than being decided here: `blockers` (why it cannot go ahead,
 * in Minty's words, shown BEFORE the click) and each candidate's `quote` (priced by the same
 * function that takes the money). After every write the screen is READ AGAIN rather than
 * patched: sending creates the pending offer, withdrawing removes it, and the server also
 * recomputes the blockers and quotes.
 *
 * Landings: *Request transfer* → 07-B ("Transfer requested"); *Withdraw request* → 07-K's
 * modal, whose Done reads the screen again (07-A). *Cancel* / *Back* → the list with this
 * company's row open (the design's M-frame). `fixture`: dev-only, `?fixture=A|C|BLOCKED`.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ApiError } from "@/lib/apiClient";

import {
  cancelTransfer,
  fetchSubscriberOptions,
  initiateTransfer,
  inviteAdminToEntity,
  type SubscriberCandidate,
  type SubscriberOptions,
} from "@/features/subscription/api/payerPortal";
import { PORTAL, moduleRoutes } from "@/features/subscription/lib/paths";
import {
  NO_COMPANY,
  paidThrough,
  pendingRecipient,
  responsibilityNote,
} from "@/features/subscription/lib/transfer";

export type TransferStatus = "loading" | "ready" | "error";

export const TRANSFER_LOAD_FAILED = "That didn’t come through. Mind trying again?";
export const TRANSFER_SEND_FAILED = "That request didn’t send. Mind trying again?";
export const INVITE_FAILED = "That invitation didn’t send. Mind trying again?";

export type UseTransferSubscriptionArgs = {
  entityId: string | null;
  fixture?: string | null;
};

export type UseTransferSubscriptionResult = {
  status: TransferStatus;
  error: string | null;
  options: SubscriberOptions | null;
  entityName: string;
  /** The candidates to pick from (the current payer first, unpickable). */
  candidates: SubscriberCandidate[];
  selected: string | null;
  select: (id: string) => void;
  /** Why the handover cannot go ahead, in the API's words. */
  blockers: string[];
  /** The footer sentence: who is responsible, until when. */
  note: string;
  /** An offer already out: the person, and since when. */
  pending: ReturnType<typeof pendingRecipient>;
  /** The invitation line. */
  invite: string;
  setInvite: (value: string) => void;
  inviting: boolean;
  inviteError: string | null;
  invited: string | null;
  sendInvite: () => Promise<void>;
  /** Request transfer / Withdraw request. */
  busy: boolean;
  sendError: string | null;
  request: () => Promise<void>;
  canRequest: boolean;
  /** 07-B: the request went out to this address. */
  requested: { email: string } | null;
  withdraw: () => Promise<void>;
  /** 07-K: the request was withdrawn; Done reads the screen again. */
  withdrawn: boolean;
  dismissWithdrawn: () => void;
  reload: () => void;
  /** Cancel / Back: the list with this company's row open. */
  backToRow: () => void;
};

function sentence(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

async function load(
  entityId: string,
  fixture: string | null | undefined,
  signal: AbortSignal,
): Promise<SubscriberOptions> {
  if (process.env.NODE_ENV !== "production" && fixture) {
    const f = await import("@/features/subscription/__fixtures__/transfers");
    if (f.isTransferFixture(fixture)) return f.TRANSFER_FIXTURES[fixture];
  }
  return fetchSubscriberOptions(entityId, signal);
}

export function useTransferSubscription({
  entityId,
  fixture,
}: UseTransferSubscriptionArgs): UseTransferSubscriptionResult {
  const router = useRouter();
  const [status, setStatus] = useState<TransferStatus>(entityId ? "loading" : "error");
  const [error, setError] = useState<string | null>(entityId ? null : NO_COMPANY);
  const [options, setOptions] = useState<SubscriberOptions | null>(null);
  const [generation, setGeneration] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [invite, setInvite] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [invited, setInvited] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [requested, setRequested] = useState<{ email: string } | null>(null);
  const [withdrawn, setWithdrawn] = useState(false);

  useEffect(() => {
    if (!entityId) return;
    const controller = new AbortController();
    (async () => {
      try {
        const loaded = await load(entityId, fixture, controller.signal);
        if (controller.signal.aborted) return;
        setOptions(loaded);
        // Nothing pre-selected: the current payer is a row like any other, and starting with
        // them ticked would make "no change" look like a choice made.
        setSelected(null);
        setError(null);
        setStatus("ready");
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(sentence(err, TRANSFER_LOAD_FAILED));
        setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [entityId, fixture, generation]);

  const reload = useCallback(() => {
    setStatus("loading");
    setGeneration((g) => g + 1);
  }, []);

  const candidates = options?.candidates ?? [];
  const chosen = candidates.find((c) => c.id === selected) ?? null;
  const blockers = options?.blockers ?? [];
  const pending = options ? pendingRecipient(options) : null;
  const entityName = options?.entity.entity_name ?? "";
  const note = responsibilityNote(
    entityName || "this company",
    options ? paidThrough(options) : null,
  );
  const canRequest = !busy && !!chosen && !chosen.is_current && blockers.length === 0 && !pending;

  const select = useCallback((id: string) => setSelected(id), []);

  const sendInvite = useCallback(async () => {
    if (!entityId || !invite.trim() || inviting) return;
    setInviting(true);
    setInviteError(null);
    setInvited(null);
    try {
      setInvited(await inviteAdminToEntity(entityId, invite.trim()));
      // Cleared only on success, so a rejected address stays in the box to be corrected.
      setInvite("");
    } catch (err) {
      setInviteError(sentence(err, INVITE_FAILED));
    } finally {
      setInviting(false);
    }
  }, [entityId, invite, inviting]);

  const request = useCallback(async () => {
    if (!entityId || !chosen || !canRequest) return;
    setBusy(true);
    setSendError(null);
    try {
      await initiateTransfer(entityId, chosen.id);
      setRequested({ email: chosen.email || chosen.name });
    } catch (err) {
      // A 422 is a stated reason - "that person needs a saved payment method" - already
      // worded for the person who clicked.
      setSendError(sentence(err, TRANSFER_SEND_FAILED));
    } finally {
      setBusy(false);
    }
  }, [entityId, chosen, canRequest]);

  const withdraw = useCallback(async () => {
    const id = options?.pending_transfer?.id;
    if (!id || busy) return;
    setBusy(true);
    setSendError(null);
    try {
      await cancelTransfer(id);
      setWithdrawn(true);
    } catch (err) {
      setSendError(sentence(err, TRANSFER_SEND_FAILED));
    } finally {
      setBusy(false);
    }
  }, [options, busy]);

  const dismissWithdrawn = useCallback(() => {
    setWithdrawn(false);
    reload();
  }, [reload]);

  const backToRow = useCallback(() => {
    router.push(entityId ? moduleRoutes(entityId).manage : PORTAL.subscriptions);
  }, [router, entityId]);

  return {
    status,
    error,
    options,
    entityName,
    candidates,
    selected,
    select,
    blockers,
    note,
    pending,
    invite,
    setInvite,
    inviting,
    inviteError,
    invited,
    sendInvite,
    busy,
    sendError,
    request,
    canRequest,
    requested,
    withdraw,
    withdrawn,
    dismissWithdrawn,
    reload,
    backToRow,
  };
}
