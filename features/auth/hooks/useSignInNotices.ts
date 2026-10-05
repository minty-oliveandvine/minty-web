"use client";

/**
 * Flask's messages from the way to the sign-in page ("Please log in to access this page.", an
 * invitation that no longer works, a Xero sign-in that failed) - signed into `?flash=` because
 * a flash cannot cross origins, read back once and shown as the hub's toasts.
 */

import { useEffect, useRef } from "react";

import { useToast } from "@/components/ui/Toast";

import { readNotices } from "@/features/auth/api/signIn";

export function useSignInNotices(flash: string): void {
  const { showToast } = useToast();
  const asked = useRef(false);

  useEffect(() => {
    if (!flash || asked.current) return;
    asked.current = true;
    readNotices(flash)
      .then((notices) => {
        for (const n of notices) showToast(n.message, n.category);
      })
      .catch((err) => console.error("[sign-in] Flask's messages could not be read", err));
  }, [flash, showToast]);
}
