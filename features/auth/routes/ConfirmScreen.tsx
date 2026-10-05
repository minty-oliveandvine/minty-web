"use client";

/**
 * `/login/confirm` - the emailed code (minty-onboarding-web's `/auth/confirm`, moved with sign-in
 * in phase 2). The address, invitation, names, Terms answer and where to go afterwards come from
 * `/login` in this tab's storage (lib/handover.ts); `?email=` alone (an old link, another tab)
 * still serves a plain log-in. Without either, back to `/login`.
 *
 * Flask owns every rule: the code lives 60 s, a new one can be asked for after 60 s, and five
 * wrong tries lock the address for 15 minutes (429). The counters here only say so; Verify is
 * NOT disabled when the local clock runs out - Flask's answer decides, in Flask's words.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { ApiError } from "@/lib/apiClient";
import { isEmail } from "@/lib/emailInput";
import { leaveTo } from "@/lib/handoff";

import { requestCode, verifyCode } from "@/features/auth/api/signIn";
import {
  AUTH_ERROR,
  AUTH_LINK,
  AUTH_PRIMARY,
  AuthHeading,
  AuthShell,
} from "@/features/auth/components/AuthShell";
import { CODE_LENGTH, CodeInput } from "@/features/auth/components/CodeInput";
import {
  clearConfirmContext,
  maskEmail,
  readConfirmContext,
  type ConfirmContext,
} from "@/features/auth/lib/handover";
import { AUTH_PATHS } from "@/features/auth/lib/paths";

const RESEND_COOLDOWN_SECONDS = 60;
const CODE_TTL_SECONDS = 60;
/** Display only - Flask counts the real tries and locks after five. */
const MAX_ATTEMPTS = 5;

export const CONFIRM_COPY = {
  title: "Check your email",
  verify: "Verify",
  verifying: "Verifying…",
  resend: "Resend Code",
  resending: "Sending…",
  locked: "Too many tries! I’ve locked this account for a bit—check back soon?",
  noAttempts: "No attempts left — please resend the code.",
  expired: "This code has expired. Please request a new one.",
} as const;

const emptyCode = () => Array.from({ length: CODE_LENGTH }, () => "");

/** The handover from /login, or a plain log-in for `?email=`; null = nothing to confirm. */
function contextOnArrival(): ConfirmContext | null {
  const handed = readConfirmContext();
  if (handed) return handed;
  const email = (new URLSearchParams(window.location.search).get("email") ?? "").trim();
  if (!isEmail(email)) return null;
  return { email, login: true, invite: "", firstName: "", lastName: "", termsAccepted: false, termsVersion: "", next: "" };
}

export function ConfirmScreen() {
  const router = useRouter();
  const [context, setContext] = useState<ConfirmContext | null>(null);
  useEffect(() => {
    const found = contextOnArrival();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser storage, post-hydration only
    if (found) setContext(found);
    else router.replace(AUTH_PATHS.login);
  }, [router]);

  const [digits, setDigits] = useState<string[]>(emptyCode);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [locked, setLocked] = useState(false);
  const [resendIn, setResendIn] = useState(RESEND_COOLDOWN_SECONDS);
  const [secondsLeft, setSecondsLeft] = useState(CODE_TTL_SECONDS);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendIn]);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft]);

  if (!context) {
    return (
      <AuthShell>
        <p className="text-center text-sm text-muted" role="status">
          Loading…
        </p>
      </AuthShell>
    );
  }

  const code = digits.join("");
  const canVerify = code.length === CODE_LENGTH && !verifying && attemptsLeft > 0 && !locked;
  const canResend = !resending && resendIn === 0 && !locked;
  // Flask's sentence always wins; the local lines speak only while nothing has been said.
  const status = error
    ? ""
    : locked
      ? CONFIRM_COPY.locked
      : attemptsLeft === 0
        ? CONFIRM_COPY.noAttempts
        : secondsLeft <= 0
          ? CONFIRM_COPY.expired
          : "";

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!canVerify) return;
    setError("");
    setVerifying(true);
    try {
      const destination = await verifyCode(context, code);
      clearConfirmContext();
      leaveTo(destination);
    } catch (err) {
      setVerifying(false);
      if (err instanceof ApiError && err.status === 429) setLocked(true);
      // a code Flask looked at and refused counts; an unreachable server does not
      else if (err instanceof ApiError && err.status >= 400) setAttemptsLeft((a) => Math.max(0, a - 1));
      setError(err instanceof ApiError ? err.message : String(err));
    }
  };

  const resend = async () => {
    if (!canResend) return;
    setError("");
    setResending(true);
    try {
      await requestCode({ email: context.email, login: context.login, invite: context.invite });
      setDigits(emptyCode());
      setAttemptsLeft(MAX_ATTEMPTS);
      setSecondsLeft(CODE_TTL_SECONDS);
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setLocked(true);
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell>
      <AuthHeading
        title={CONFIRM_COPY.title}
        lead={`Enter the 6-digit code I sent to ${maskEmail(context.email)}.`}
      />
      <form className="flex flex-col gap-4" onSubmit={(e) => void verify(e)} noValidate>
        <CodeInput digits={digits} onChange={setDigits} disabled={verifying || locked} />
        {attemptsLeft < MAX_ATTEMPTS && attemptsLeft > 0 && !locked ? (
          <p className="text-center text-[13px] text-ink-soft">
            {attemptsLeft} {attemptsLeft === 1 ? "attempt" : "attempts"} remaining
          </p>
        ) : null}
        <button type="submit" className={AUTH_PRIMARY} disabled={!canVerify}>
          {verifying ? CONFIRM_COPY.verifying : CONFIRM_COPY.verify}
        </button>
        {error || status ? (
          <p className={AUTH_ERROR} role="alert">
            {error || status}
          </p>
        ) : null}
      </form>
      <p className="text-center text-sm text-ink-soft">
        Didn&apos;t get it?{" "}
        {canResend ? (
          <button type="button" className={`${AUTH_LINK} min-h-11`} onClick={() => void resend()}>
            {CONFIRM_COPY.resend}
          </button>
        ) : (
          <span className="text-quiet">
            {resending ? CONFIRM_COPY.resending : locked ? CONFIRM_COPY.resend : `${CONFIRM_COPY.resend} in ${resendIn}s`}
          </span>
        )}
      </p>
      {/* An invitation is bound to its address: no other email can take it. */}
      {context.invite ? null : (
        <p className="text-center text-sm">
          <a className={AUTH_LINK} href={AUTH_PATHS.login}>
            Use a different email
          </a>
        </p>
      )}
    </AuthShell>
  );
}
