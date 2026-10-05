"use client";

/**
 * The Users tab's state: the page from Flask, and each action - invite, resend, cancel, change a
 * role, remove - as a call followed by a fresh read, so what is shown is always what Flask holds.
 * Flask's sentence is what a person reads, success or refusal (toasts); a resend still cooling
 * down answers 429 with `retry_after`, which the row counts down.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/apiClient";

import {
  cancelInvitation,
  changeRole,
  fetchUsers,
  inviteMember,
  removeMember,
  resendInvitation,
  type UsersPage,
} from "@/features/company-settings/api/companySettings";

export type UsersTab = {
  status: "loading" | "ready" | "error";
  page: UsersPage | null;
  error: string;
  /** Which row or form is waiting on Flask (an id, "invite"), or null. */
  busy: string | null;
  /** Seconds left before an invitation may be sent again, by id (counted down here). */
  cooldowns: Record<string, number>;
  reload: () => void;
  invite: (invite: { email: string; role: string; first_name: string; last_name: string }) => Promise<boolean>;
  resend: (invitationId: string) => Promise<void>;
  cancel: (invitationId: string) => Promise<boolean>;
  setRole: (memberId: string, role: string) => Promise<void>;
  remove: (memberId: string) => Promise<boolean>;
};

const message = (err: unknown) => (err instanceof ApiError ? err.message : "Something went wrong on my end. Mind trying again?");

export function useUsersTab(entityId: string, flash: string | null): UsersTab {
  const { showToast } = useToast();
  const [status, setStatus] = useState<UsersTab["status"]>("loading");
  const [page, setPage] = useState<UsersPage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [attempt, setAttempt] = useState(0);
  // The hand-over is read once: a reload must not show Flask's messages again.
  const flashLeft = useRef(flash);

  useEffect(() => {
    const controller = new AbortController();
    const handOver = flashLeft.current;
    flashLeft.current = null;
    fetchUsers(entityId, handOver, controller.signal)
      .then((answer) => {
        setPage(answer);
        setCooldowns(Object.fromEntries(answer.invitations.map((i) => [i.id, i.resend_cooldown])));
        setStatus("ready");
        for (const notice of answer.notices) showToast(notice.message, notice.category);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("[users] the company's users could not be read", err);
        setError(message(err));
        setStatus("error");
      });
    return () => controller.abort();
  }, [entityId, attempt, showToast]);

  // One clock for every row's countdown.
  const counting = Object.values(cooldowns).some((s) => s > 0);
  useEffect(() => {
    if (!counting) return;
    const id = window.setInterval(
      () => setCooldowns((c) => Object.fromEntries(Object.entries(c).map(([k, s]) => [k, Math.max(0, s - 1)]))),
      1000,
    );
    return () => window.clearInterval(id);
  }, [counting]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  async function act<T>(key: string, call: () => Promise<T>, said: (answer: T) => string): Promise<T | null> {
    setBusy(key);
    try {
      const answer = await call();
      showToast(said(answer), "success");
      reload();
      return answer;
    } catch (err) {
      showToast(message(err), "error");
      return null;
    } finally {
      setBusy(null);
    }
  }

  return {
    status,
    page,
    error,
    busy,
    cooldowns,
    reload,
    invite: async (invite) => {
      setBusy("invite");
      try {
        const answer = await inviteMember(entityId, invite);
        showToast(answer.message, answer.email_sent ? "success" : "warning");
        reload();
        return true;
      } catch (err) {
        showToast(message(err), "error");
        return false;
      } finally {
        setBusy(null);
      }
    },
    resend: async (invitationId) => {
      setBusy(invitationId);
      try {
        const answer = await resendInvitation(entityId, invitationId);
        showToast(answer.message, "success");
        setCooldowns((c) => ({ ...c, [invitationId]: answer.resend_cooldown }));
      } catch (err) {
        const wait = err instanceof ApiError ? Number((err.body as { retry_after?: number } | null)?.retry_after ?? 0) : 0;
        if (wait > 0) setCooldowns((c) => ({ ...c, [invitationId]: wait }));
        showToast(message(err), "error");
      } finally {
        setBusy(null);
      }
    },
    cancel: async (invitationId) => (await act(invitationId, () => cancelInvitation(entityId, invitationId), (a) => a.message)) !== null,
    setRole: async (memberId, role) => {
      await act(memberId, () => changeRole(entityId, memberId, role), (a) => a.message);
    },
    remove: async (memberId) => (await act(memberId, () => removeMember(entityId, memberId), (a) => a.message)) !== null,
  };
}
