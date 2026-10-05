/**
 * What the sign-in page is opened with - Flask's `hub_login_url` (Minty
 * `blueprints/auth/services/hub_login.py`) spells it:
 *
 * - `mode=signup` - make an account (names and the Terms first);
 * - `invite` + `email` (+ `fn`, `ln`) - an invitation: the address is the invited one and
 *   cannot be changed; a new invitee's account is made from the inviter's names;
 * - `next` - the Flask page the person was on its way to (sign-in returns there);
 * - `flash` - Flask's messages from the way here, signed (read back from Flask).
 *
 * Read ONCE, then the page clears its address bar: `invite` is a secret (whoever holds it joins
 * the company) and must not sit in the history.
 */

export type SignInMode = "login" | "signup" | "invite";

export type Arrival = {
  mode: SignInMode;
  invite: string;
  email: string;
  firstName: string;
  lastName: string;
  /** A path on Flask, or "" - Flask checks it again; this only refuses the obviously foreign. */
  next: string;
  flash: string;
};

/** A path on the same site: "/x", never "//host" or "/\host" (Flask's safe_internal_path rule). */
export function sitePath(value: string | null): string {
  const v = (value ?? "").trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\")) return "";
  const control = Array.from(v).some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f);
  return control ? "" : v;
}

export function readArrival(params: URLSearchParams): Arrival {
  const invite = (params.get("invite") ?? "").trim();
  return {
    mode: invite ? "invite" : params.get("mode") === "signup" ? "signup" : "login",
    invite,
    email: (params.get("email") ?? "").trim(),
    firstName: (params.get("fn") ?? "").trim(),
    lastName: (params.get("ln") ?? "").trim(),
    next: sitePath(params.get("next")),
    flash: params.get("flash") ?? "",
  };
}
