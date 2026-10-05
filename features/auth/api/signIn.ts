/**
 * Sign-in's calls - all Flask's (Minty `blueprints/auth/routes/email_auth.py`, `blueprints/legal`),
 * all made before there is anyone to name, so no bearer and no re-handoff: plain cross-origin
 * `fetch` (Flask allows any origin here and the routes take no session). A refusal rejects with
 * the shell's `ApiError` carrying Flask's own sentence (`{message}` on the auth routes).
 *
 * Signing in ends on Flask's origin: the code's verify answers a one-shot hand-off URL there
 * (`/auth/email/handoff`), which sets Flask's session and goes on - to the hub's list.
 */

import { ApiError, HOUSE_FALLBACK } from "@/lib/apiClient";
import { env } from "@/lib/env";
import type { OwedTerms } from "@/lib/terms";

import type { ConfirmContext } from "@/features/auth/lib/handover";

const UNREACHABLE = "I couldn't reach the server. Mind trying again?";

type FlaskAnswer = { status?: string; message?: string; error?: string; [key: string]: unknown };

async function call(path: string, init: RequestInit = {}): Promise<FlaskAnswer> {
  let res: Response;
  try {
    res = await fetch(`${env.PETTY_CASH_URL}${path}`, {
      ...init,
      credentials: "omit",
      headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
    });
  } catch (err) {
    console.error(`[sign-in] ${path} could not be reached`, err);
    throw new ApiError(0, UNREACHABLE);
  }
  let body: FlaskAnswer = {};
  try {
    body = (await res.json()) as FlaskAnswer;
  } catch {
    // a non-JSON answer: only its status says anything
  }
  if (!res.ok || body.status === "error") {
    const sentence = typeof body.message === "string" ? body.message : typeof body.error === "string" ? body.error : "";
    throw new ApiError(res.status, sentence || HOUSE_FALLBACK, body);
  }
  return body;
}

const post = (path: string, json: unknown) => call(path, { method: "POST", body: JSON.stringify(json) });

/**
 * Email a six-digit code. `login` asks Flask to refuse an address with no account (404 "Please
 * sign up first") before anything is sent; sign-up and an invitation may name a new address.
 * The invite rides along so Flask refuses an address the invitation was not sent to - before a
 * code goes to an inbox that cannot use it.
 */
export async function requestCode(args: { email: string; login: boolean; invite?: string }): Promise<void> {
  await post("/auth/email/request-code", {
    email: args.email,
    ...(args.login ? { mode: "login" } : {}),
    ...(args.invite ? { invite: args.invite } : {}),
  });
}

/**
 * Check the code. A new address's account is made here, from the names and the Terms answer the
 * page sends. Answers where the browser goes next: Flask's hand-off, only when it is on Flask's
 * own origin (anything else is refused, logged, and replaced by Flask's front door).
 */
export async function verifyCode(context: ConfirmContext, code: string): Promise<string> {
  const answer = await post("/auth/email/verify-code", {
    email: context.email,
    code,
    invite: context.invite,
    first_name: context.firstName,
    last_name: context.lastName,
    terms_accepted: context.termsAccepted,
    terms_version: context.termsVersion,
    next: context.next,
  });
  return flaskDestination(answer.redirect_url);
}

export function flaskDestination(redirectUrl: unknown): string {
  const flask = new URL(env.PETTY_CASH_URL);
  if (typeof redirectUrl === "string" && redirectUrl) {
    try {
      const target = new URL(redirectUrl, flask);
      if (target.origin === flask.origin) return target.toString();
    } catch {
      // unparseable: refused below
    }
  }
  console.error("[sign-in] refused a redirect_url that is not Flask's:", redirectUrl);
  return flask.toString();
}

/** Flask's Xero sign-in: a navigation (OAuth), never a fetch. Flask checks `next` itself. */
export function xeroSignInUrl(args: { invite?: string; next?: string }): string {
  const qs = new URLSearchParams();
  if (args.invite) qs.set("invite", args.invite);
  if (args.next) qs.set("next", args.next);
  const query = qs.toString();
  return `${env.PETTY_CASH_URL}/xero_auth${query ? `?${query}` : ""}`;
}

export type SignInNotice = { category: "success" | "error" | "warning" | "info"; message: string };

/** Flask's messages from the way here (`?flash=`); an expired or forged value reads as none. */
export async function readNotices(flash: string): Promise<SignInNotice[]> {
  const answer = await call(`/auth/notices?flash=${encodeURIComponent(flash)}`);
  return Array.isArray(answer.notices) ? (answer.notices as SignInNotice[]) : [];
}

/**
 * Whether the invitee still owes the Terms. Keyed on the invite token (a secret bound to one
 * address), sent in the body - in a query string it landed in every access log. Anything but an
 * explicit `false` keeps the agreement on the page: asking twice is an annoyance, skipping it is
 * a missing consent record.
 */
export async function inviteOwesTerms(invite: string): Promise<boolean> {
  const answer = await post("/legal/invite-terms-status", { invite });
  return answer.terms_required !== false;
}

/** The live Terms, for the sign-up's read-to-agree panel (`components/ui/TermsModal`). */
export async function signUpTerms(): Promise<OwedTerms> {
  const doc = await call("/legal/content/terms");
  if (typeof doc.version !== "string" || typeof doc.html !== "string") {
    throw new ApiError(500, HOUSE_FALLBACK, doc);
  }
  return {
    owed: true,
    document: {
      version: doc.version,
      effective_date: typeof doc.effective_date === "string" ? doc.effective_date : null,
      html: doc.html,
      show_draft_notice: doc.is_pinned === false,
    },
    is_update: false,
    previous_version: null,
    links: { terms: "/legal/terms", privacy: "/legal/privacy", previous: null },
  };
}
