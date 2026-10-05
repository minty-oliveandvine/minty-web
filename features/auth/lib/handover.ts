/**
 * What `/login` hands `/login/confirm`: the address the code went to, the invitation, the names,
 * the Terms answer and where to go afterwards - in this tab's sessionStorage, never the URL (the
 * invite token is a secret). Cleared once the code is verified. minty-onboarding-web's
 * `lib/authHandover.ts`, moved here with sign-in (phase 2).
 *
 * `/login/confirm?email=` opened without a handover (another tab, an old link) still works for
 * a plain log-in: the code can be entered or sent again for that address.
 */

export type ConfirmContext = {
  email: string;
  /** A plain log-in: a resend asks Flask to refuse an address with no account, as the first did. */
  login: boolean;
  invite: string;
  firstName: string;
  lastName: string;
  termsAccepted: boolean;
  termsVersion: string;
  next: string;
};

const KEY = "minty_signin_confirm";

/** False when the browser refused storage - the caller then has no way to hand over. */
export function saveConfirmContext(context: ConfirmContext): boolean {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(context));
    return true;
  } catch (err) {
    console.error("[sign-in] the browser refused session storage", err);
    return false;
  }
}

const text = (v: unknown) => (typeof v === "string" ? v : "");

export function readConfirmContext(): ConfirmContext | null {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(KEY);
  } catch (err) {
    console.error("[sign-in] the browser refused session storage", err);
    return null;
  }
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<ConfirmContext> | null;
    if (!data || !text(data.email)) return null;
    return {
      email: text(data.email),
      login: data.login === true,
      invite: text(data.invite),
      firstName: text(data.firstName),
      lastName: text(data.lastName),
      termsAccepted: data.termsAccepted === true,
      termsVersion: text(data.termsVersion),
      next: text(data.next),
    };
  } catch (err) {
    console.error("[sign-in] the stored hand-over is not readable", err);
    return null;
  }
}

export function clearConfirmContext(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch (err) {
    console.error("[sign-in] the browser refused session storage", err);
  }
}

/** `j*****@example.com` - the address shown back, not spelled out. */
export function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email || "your email";
  const [local, domain] = email.split("@");
  if (local.length <= 1) return email;
  return `${local[0]}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}
