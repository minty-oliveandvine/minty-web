"use client";

/**
 * The Entity & Integration tab's state: the page from Flask, Save (only what changed is sent),
 * and Disconnect. Each answers with the fresh page, so what is shown is what Flask holds; Flask's
 * sentence is what a person reads (toasts), and a save refused under a field stays on the form.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/apiClient";

import {
  disconnectXero,
  fetchIntegration,
  saveIntegration,
  type IntegrationPage,
} from "@/features/company-settings/api/companySettings";

export type IntegrationTab = {
  status: "loading" | "ready" | "error";
  page: IntegrationPage | null;
  error: string;
  busy: "save" | "disconnect" | null;
  /** Flask's refusal of the last save, shown on the form. */
  saveError: string;
  reload: () => void;
  save: (changes: { name?: string; country_code?: string; currency_id?: string }) => Promise<boolean>;
  disconnect: () => Promise<boolean>;
};

const message = (err: unknown) => (err instanceof ApiError ? err.message : "Something went wrong on my end. Mind trying again?");

export function useIntegrationTab(entityId: string, flash: string | null): IntegrationTab {
  const { showToast } = useToast();
  const [status, setStatus] = useState<IntegrationTab["status"]>("loading");
  const [page, setPage] = useState<IntegrationPage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<IntegrationTab["busy"]>(null);
  const [saveError, setSaveError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const flashLeft = useRef(flash);

  useEffect(() => {
    const controller = new AbortController();
    const handOver = flashLeft.current;
    flashLeft.current = null;
    fetchIntegration(entityId, handOver, controller.signal)
      .then((answer) => {
        setPage(answer);
        setStatus("ready");
        for (const notice of answer.notices) showToast(notice.message, notice.category);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        console.error("[integration] the company's settings could not be read", err);
        setError(message(err));
        setStatus("error");
      });
    return () => controller.abort();
  }, [entityId, attempt, showToast]);

  return {
    status,
    page,
    error,
    busy,
    saveError,
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
  };
}
