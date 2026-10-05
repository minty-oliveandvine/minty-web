"use client";

/**
 * `/login` - THE sign-in page since phase 2 (2026-10-05): log in, sign up (`?mode=signup`) and an
 * invitation (`?invite=&email=`), which were Flask's `/` + `/register` and minty-onboarding-web's
 * `/auth` until then. Flask stays the identity behind it (features/auth/api/signIn.ts).
 *
 * - Email: a code is emailed (`requestCode`) and `/login/confirm` takes it. Log-in mode asks
 *   Flask to refuse an address with no account before anything is sent.
 * - Xero: a navigation to Flask's OAuth start; Flask's callback signs the person in.
 * - Making an account (sign-up, or an invitee new to Minty) needs the Terms agreed first: the
 *   box opens the read-to-agree panel and is ticked only by agreeing at its end. An invitee who
 *   already agreed is not asked again (`inviteOwesTerms`); any doubt keeps the box.
 */

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { TermsModal } from "@/components/ui/TermsModal";
import { ApiError } from "@/lib/apiClient";
import { EMAIL_ASCII_HINT, isEmail, useEmailInput } from "@/lib/emailInput";
import { env } from "@/lib/env";
import type { OwedTerms } from "@/lib/terms";

import { requestCode, inviteOwesTerms, signUpTerms, xeroSignInUrl } from "@/features/auth/api/signIn";
import {
  AUTH_ERROR,
  AUTH_GHOST,
  AUTH_INPUT,
  AUTH_LABEL,
  AUTH_LINK,
  AUTH_PRIMARY,
  AuthHeading,
  AuthShell,
} from "@/features/auth/components/AuthShell";
import { useSignInNotices } from "@/features/auth/hooks/useSignInNotices";
import type { Arrival } from "@/features/auth/lib/arrival";
import { saveConfirmContext } from "@/features/auth/lib/handover";
import { AUTH_PATHS } from "@/features/auth/lib/paths";

export const LOGIN_COPY = {
  loginTitle: "Welcome",
  loginLead: "Start your journey with us today.",
  signupTitle: "Create your account",
  signupLead: "Sign up with your email to get started.",
  sendLogin: "Log in with OTP",
  sendSignup: "Continue with Email",
  sending: "Sending code…",
  xero: "Log in with Xero",
  noStorage:
    "Your browser is blocking site storage, so I can't take you to the next step. Mind allowing it and trying again?",
  termsUnavailable: "I couldn't load the Terms of Use just now. Mind trying again?",
} as const;

const noop = () => {};

export function LoginScreen({ arrival }: { arrival: Arrival }) {
  const router = useRouter();
  useSignInNotices(arrival.flash);

  // `invite` is a secret: once read, it leaves the address bar (and the history).
  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, []);

  const signup = arrival.mode === "signup";
  const invited = arrival.mode === "invite";
  const [email, setEmail] = useState(arrival.email);
  const emailInput = useEmailInput(setEmail);
  const [firstName, setFirstName] = useState(arrival.firstName);
  const [lastName, setLastName] = useState(arrival.lastName);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [needsSignUp, setNeedsSignUp] = useState(false);

  // The Terms: owed on sign-up always; on an invitation unless Flask says this invitee agreed.
  const [termsOwed, setTermsOwed] = useState(signup || invited);
  const [terms, setTerms] = useState<OwedTerms | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [agreedVersion, setAgreedVersion] = useState("");
  useEffect(() => {
    if (!invited) return;
    inviteOwesTerms(arrival.invite)
      .then(setTermsOwed)
      .catch((err) => console.error("[sign-in] whether the invitee owes the Terms is unknown; asking", err));
  }, [invited, arrival.invite]);

  const emailLocked = invited && Boolean(arrival.email);
  const namesValid = !signup || (firstName.trim() !== "" && lastName.trim() !== "");
  const termsValid = !termsOwed || Boolean(agreedVersion);
  const canSend = isEmail(email) && namesValid && termsValid && !sending;

  const openTerms = async () => {
    setError("");
    if (!terms) {
      try {
        setTerms(await signUpTerms());
      } catch (err) {
        console.error("[sign-in] the Terms could not be loaded", err);
        setError(LOGIN_COPY.termsUnavailable);
        return;
      }
    }
    setTermsOpen(true);
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setError("");
    setNeedsSignUp(false);
    setSending(true);
    const login = !signup && !invited;
    try {
      await requestCode({ email, login, invite: arrival.invite });
    } catch (err) {
      setSending(false);
      setNeedsSignUp(login && err instanceof ApiError && err.status === 404);
      setError(err instanceof ApiError ? err.message : String(err));
      return;
    }
    const handedOver = saveConfirmContext({
      email,
      login,
      invite: arrival.invite,
      firstName,
      lastName,
      termsAccepted: termsOwed && Boolean(agreedVersion),
      termsVersion: termsOwed ? agreedVersion : "",
      next: arrival.next,
    });
    if (!handedOver) {
      setSending(false);
      setError(LOGIN_COPY.noStorage);
      return;
    }
    router.push(AUTH_PATHS.confirm);
  };

  return (
    <AuthShell>
      <AuthHeading
        title={signup ? LOGIN_COPY.signupTitle : LOGIN_COPY.loginTitle}
        lead={signup ? LOGIN_COPY.signupLead : LOGIN_COPY.loginLead}
      />

      {invited && arrival.email ? (
        <div className="rounded-lg border border-secondary/40 bg-[#f5ffff] px-3.5 py-3 text-[13.5px] leading-normal text-ink" role="status">
          This invitation was sent to <strong className="font-semibold">{arrival.email}</strong>. Please
          sign in with that account to accept it.
        </div>
      ) : null}

      <form className="flex flex-col gap-3.5" onSubmit={(e) => void send(e)} noValidate>
        {signup ? (
          <>
            <div>
              <label htmlFor="signin-first-name" className={AUTH_LABEL}>
                First name
              </label>
              <input
                id="signin-first-name"
                type="text"
                autoComplete="given-name"
                placeholder="Jane"
                className={AUTH_INPUT}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="signin-last-name" className={AUTH_LABEL}>
                Last name
              </label>
              <input
                id="signin-last-name"
                type="text"
                autoComplete="family-name"
                placeholder="Doe"
                className={AUTH_INPUT}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </>
        ) : null}

        <div>
          <label htmlFor="signin-email" className={AUTH_LABEL}>
            Email
          </label>
          <input
            id="signin-email"
            {...emailInput.props}
            placeholder="jane@example.com"
            className={AUTH_INPUT}
            value={email}
            readOnly={emailLocked}
            aria-readonly={emailLocked}
            title={emailLocked ? "This invite was sent to this address" : undefined}
          />
          {emailInput.rejected ? (
            <p className="mt-1.5 text-[12.5px] text-danger" role="status">
              {EMAIL_ASCII_HINT}
            </p>
          ) : null}
        </div>

        {termsOwed ? (
          <label className="flex cursor-pointer items-start gap-2 text-[13.5px] leading-normal text-ink">
            {/* Never ticked directly - a box ticked without reading is not agreement. Clicking
                opens the document; agreeing at its end ticks it. Unticking is always allowed. */}
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--teal-strong)]"
              checked={Boolean(agreedVersion)}
              onChange={() => {
                if (agreedVersion) setAgreedVersion("");
                else void openTerms();
              }}
            />
            <span>
              I agree to the{" "}
              <a className={AUTH_LINK} href={`${env.PETTY_CASH_URL}/legal/terms`} target="_blank" rel="noopener noreferrer">
                Terms of Use
              </a>{" "}
              and{" "}
              <a className={AUTH_LINK} href={`${env.PETTY_CASH_URL}/legal/privacy`} target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              .
            </span>
          </label>
        ) : null}

        <button type="submit" className={AUTH_PRIMARY} disabled={!canSend}>
          {sending ? LOGIN_COPY.sending : signup ? LOGIN_COPY.sendSignup : LOGIN_COPY.sendLogin}
        </button>
        {error ? (
          <p className={AUTH_ERROR} role="alert">
            {error}
            {needsSignUp ? (
              <>
                {" "}
                <a className={AUTH_LINK} href={AUTH_PATHS.signup}>
                  Sign up
                </a>
              </>
            ) : null}
          </p>
        ) : null}
      </form>

      <div className="flex items-center gap-3 text-[13px] text-muted" role="separator">
        <span className="h-px flex-1 bg-gray-200" />
        or
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <a className={AUTH_GHOST} href={xeroSignInUrl({ invite: arrival.invite, next: arrival.next })}>
        {LOGIN_COPY.xero}
        <Image src="/auth/xero-logo.webp" alt="" width={20} height={20} unoptimized className="h-5 w-5 rounded-full object-cover" />
      </a>

      <p className="text-center text-sm text-ink-soft">
        {signup ? (
          <>
            Already have an account?{" "}
            <a className={AUTH_LINK} href={AUTH_PATHS.login}>
              Log in
            </a>
          </>
        ) : (
          <>
            Don&apos;t have an account?{" "}
            <a className={AUTH_LINK} href={AUTH_PATHS.signup}>
              Sign up
            </a>
          </>
        )}
      </p>

      {termsOpen && terms ? (
        <TermsModal
          terms={terms}
          agree={async (version) => setAgreedVersion(version)}
          onAccepted={() => setTermsOpen(false)}
          onChanged={noop}
          onCancel={() => setTermsOpen(false)}
        />
      ) : null}
    </AuthShell>
  );
}
