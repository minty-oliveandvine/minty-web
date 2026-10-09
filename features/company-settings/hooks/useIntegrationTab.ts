"use client";

/**
 * The Entity & Integration tab's state: the page from Flask, Save (only what changed is sent),
 * and Disconnect. Each answers with the fresh page, so what is shown is what Flask holds; Flask's
 * sentence is what a person reads (toasts), and a save refused under a field stays on the form.
 */

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/apiClient";

import {
  disconnectXero,
  fetchIntegration,
  releaseXero,
  saveIntegration,
  type IntegrationPage,
  type XeroConflict,
} from "@/features/company-settings/api/companySettings";

export type IntegrationTab = {
  status: "loading" | "ready" | "error";
  page: IntegrationPage | null;
  error: string;
  busy: "save" | "disconnect" | "move" | null;
  /** Flask's refusal of the last save, shown on the form. */
  saveError: string;
  /**
   * The company holding the Xero organisation a connect from here was refused for, while its
   * dialog is open. Dismissing it clears it; it does not come back on a reload, because the
   * hand-over in the address is read once.
   */
  conflict: XeroConflict | null;
  /** Flask's refusal of the move, shown inside the dialog rather than as a toast. */
  moveError: string;
  dismissConflict: () => void;
  reload: () => void;
  save: (changes: { name?: string; country_code?: string; currency_id?: string }) => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  /** Free the organisation on `holderId`. True when it is free and Xero may be entered. */
  move: (holderId: string) => Promise<boolean>;
};

const message = (err: unknown) => (err instanceof ApiError ? err.message : "Something went wrong on my end. Mind trying again?");

export function useIntegrationTab(entityId: string, flash: string | null, conflictToken: string | null): IntegrationTab {
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<IntegrationTab["status"]>("loading");
  const [page, setPage] = useState<IntegrationPage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<IntegrationTab["busy"]>(null);
  const [saveError, setSaveError] = useState("");
  const [conflict, setConflict] = useState<XeroConflict | null>(null);
  const [moveError, setMoveError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const flashLeft = useRef(flash);
  // Both hand-overs are spent on the first read, like the flash: a reload, or the reload a
  // retry asks for, must not raise the dialog a second time.
  const conflictLeft = useRef(conflictToken);

  useEffect(() => {
    const controller = new AbortController();
    const handOver = flashLeft.current;
    const refused = conflictLeft.current;
    fetchIntegration(entityId, handOver, refused, controller.signal)
      .then((answer) => {
        // SPENT ON THE ANSWER, not on asking. Clearing them above instead loses the toast and
        // the dialog whenever the first run of this effect is thrown away - which React does on
        // every mount in development (StrictMode), so the hand-over was consumed by a request
        // whose answer is discarded and the second one carries nothing.
        flashLeft.current = null;
        conflictLeft.current = null;
        setPage(answer);
        setStatus("ready");
        for (const notice of answer.notices) showToast(notice.message, notice.category);
        if (answer.xero_conflict) {
          setConflict(answer.xero_conflict);
          // Take the spent hand-over OUT of the address (the entity list does the same with
          // `?flash=`). A dialog left in the URL re-opens itself on every reload, and this one
          // offers to disconnect another company - not something to raise unasked twice.
          router.replace(pathname);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("[integration] the company's settings could not be read", err);
        setError(message(err));
        setStatus("error");
      });
    return () => controller.abort();
  }, [entityId, attempt, showToast, router, pathname]);

  return {
    status,
    page,
    error,
    busy,
    saveError,
    conflict,
    moveError,
    dismissConflict: useCallback(() => {
      setConflict(null);
      setMoveError("");
    }, []),
    reload: useCallback(() => setAttempt((n) => n + 1), []),
    save: async (changes) => {
      setBusy("save");
      setSaveError("");
      try {
        const answer = await saveIntegration(entityId, changes);
        setPage(answer);
        showToast(answer.message ?? "Settings saved!", "success");
        return true;
      } catch (err) {
        setSaveError(message(err));
        return false;
      } finally {
        setBusy(null);
      }
    },
    disconnect: async () => {
      setBusy("disconnect");
      try {
        const answer = await disconnectXero(entityId);
        setPage(answer);
        showToast(answer.message ?? "You're disconnected from Xero.", "success");
        return true;
      } catch (err) {
        showToast(message(err), "error");
        return false;
      } finally {
        setBusy(null);
      }
    },
    // The refusal is shown IN the dialog and the dialog stays open: the next step is a
    // navigation to Xero, so a toast would be gone before the person could read it, and
    // closing on a failure would leave them with nothing to retry.
    move: async (holderId) => {
      setBusy("move");
      setMoveError("");
      try {
        await releaseXero(entityId, holderId);
        return true;
      } catch (err) {
        setMoveError(message(err));
        return false;
      } finally {
        setBusy(null);
      }
    },
  };
}
