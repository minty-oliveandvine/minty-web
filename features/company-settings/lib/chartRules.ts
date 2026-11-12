/**
 * The checks the chart of accounts and contacts forms run as the person types - the API's own
 * (`minty_shared.accounts`, onboarding-api's contacts), in the same Part 11 words, so a refusal on
 * Save never says anything new. The API still checks everything; this is a convenience.
 *
 * As typed: a value that breaks a rule (too long, a bad character, a name already taken). Empty
 * only on a refused Save: an empty field is "not finished yet", never red while typing.
 */

import type { Account, AccountInput, Contact } from "@/features/company-settings/api/chart";

export const CODE_MAX = 10;
export const NAME_MAX = 80;
export const DESCRIPTION_MAX = 255;
export const CONTACT_MAX = 150;
const CODE_SHAPE = /^[A-Za-z0-9.-]+$/;

export type AccountProblems = Partial<Record<keyof AccountInput, string>>;

const squash = (text: string) => text.replace(/\s+/g, " ").trim();
const key = (text: string) => squash(text).toLowerCase();

/**
 * One account's problems. ``submitted``: a refused Save, so an empty field says so too.
 * ``others``: the company's other accounts, for a code or name already taken.
 */
export function accountProblems(
  input: AccountInput,
  others: Account[],
  submitted: boolean,
): AccountProblems {
  const out: AccountProblems = {};
  const code = input.code.trim();
  const name = squash(input.name);
  if (!input.type) {
    if (submitted) out.type = "Choose the account type to continue.";
  }
  if (!code) {
    if (submitted && input.type !== "bank")
      out.code = "The code is still empty. Add a code to continue.";
  } else if (code.length > CODE_MAX) {
    out.code = `The code can be up to ${CODE_MAX} characters. Shorten it to continue.`;
  } else if (!CODE_SHAPE.test(code)) {
    out.code = "The code can use letters, numbers, dots and dashes. Remove the other characters.";
  } else {
    const holder = others.find((a) => a.code === code);
    if (holder)
      out.code = `The code ${code} is already used by ${holder.name}. Choose another code.`;
  }
  if (!name) {
    if (submitted) out.name = "The name is still empty. Add a name to continue.";
  } else if (name.length > NAME_MAX) {
    out.name = `The name can be up to ${NAME_MAX} characters. Shorten it to continue.`;
  } else {
    const holder = others.find((a) => key(a.name) === key(name));
    if (holder) out.name = `Another account is already called ${holder.name}. Choose another name.`;
  }
  if (input.description.trim().length > DESCRIPTION_MAX)
    out.description = `The description can be up to ${DESCRIPTION_MAX} characters. Shorten it to continue.`;
  return out;
}

/** A contact name's problem, if any (the same words as the API). */
export function contactProblem(name: string, others: Contact[], submitted: boolean): string | null {
  const clean = squash(name);
  if (!clean)
    return submitted ? "The contact's name is still empty. Add a name to continue." : null;
  if (clean.length > CONTACT_MAX)
    return `The name can be up to ${CONTACT_MAX} characters. Shorten it to continue.`;
  const holder = others.find((c) => key(c.name) === key(clean));
  return holder
    ? `${holder.name} is already in your contacts. Use that one, or choose another name.`
    : null;
}

/** The sentence a delete's confirm adds: kept for its records, and archived in Xero too. */
export function deleteNote(row: { used: boolean; in_xero: boolean }): string {
  const parts = ["This can't be undone."];
  if (row.used) parts.push("Records that already use it keep it, but it leaves every list.");
  if (row.in_xero) parts.push("It's archived in Xero too.");
  return parts.join(" ");
}
