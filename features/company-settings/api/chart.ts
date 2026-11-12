/**
 * Every call General's chart of accounts and contacts make: accounts-api's company door
 * (`/api/me/company/accounts|contacts`, the company as `?entity=`), which checks the person and
 * hands the work to onboarding-api - the one implementation of a company's accounts and contacts
 * (owner, 2026-11-12). Each answer is the API's; a refusal rejects with `ApiError` (its sentence,
 * and `fields` when input was refused).
 */

import { mintyFetch } from "@/lib/apiClient";

export type Rights = { add: boolean; edit: boolean; delete: boolean };

export type Account = {
  id: string;
  code: string;
  name: string;
  type: string;
  type_label: string;
  description: string;
  /** The company may edit and delete it - every row but the hidden system ones (owner, 2026-11-12). */
  own: boolean;
  /** Where it came from: `template` is a copy of Minty's ("Comes with Minty"), `user`, `xero`. */
  source: string;
  in_xero: boolean;
  used: boolean;
};

export type AccountType = { value: string; label: string };

/** One of Minty's accounts the company can still add (the starter chart for its country). */
export type MintyAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
  type_label: string;
  description: string;
};

export type AccountsRead = {
  accounts: Account[];
  types: AccountType[];
  next_codes: Record<string, string>;
  xero_live: boolean;
  permissions: Rights;
  minty_accounts: MintyAccount[];
};

export type Contact = {
  id: string;
  name: string;
  own: boolean;
  source: string;
  in_xero: boolean;
  xero_id: string | null;
  used: boolean;
};

export type ContactsRead = { contacts: Contact[]; xero_live: boolean; permissions: Rights };

export type AccountInput = { code: string; name: string; type: string; description: string };
/** One of Minty's accounts, added as it is (owner, 2026-11-12). */
export type FromMinty = { template_id: string };

const on = (entityId: string) => ({ entity: entityId });

export const readAccounts = (entityId: string) =>
  mintyFetch<AccountsRead>("/api/me/company/accounts", { query: on(entityId) });

export const readContacts = (entityId: string) =>
  mintyFetch<ContactsRead>("/api/me/company/contacts", { query: on(entityId) });

export const addAccount = (entityId: string, input: AccountInput | FromMinty) =>
  mintyFetch<{ account: Account; message: string }>("/api/me/company/accounts", {
    method: "POST",
    json: input,
    query: on(entityId),
  });

export const editAccount = (entityId: string, id: string, input: AccountInput) =>
  mintyFetch<{ account: Account; message: string }>(
    `/api/me/company/accounts/${encodeURIComponent(id)}`,
    { method: "PATCH", json: input, query: on(entityId) },
  );

export const deleteAccount = (entityId: string, id: string) =>
  mintyFetch<{ archived: boolean; message: string }>(
    `/api/me/company/accounts/${encodeURIComponent(id)}`,
    { method: "DELETE", query: on(entityId) },
  );

export const addContact = (entityId: string, name: string) =>
  mintyFetch<{ contact: Contact; message: string }>("/api/me/company/contacts", {
    method: "POST",
    json: { name },
    query: on(entityId),
  });

export const renameContact = (entityId: string, id: string, name: string) =>
  mintyFetch<{ contact: Contact; message: string }>(
    `/api/me/company/contacts/${encodeURIComponent(id)}`,
    { method: "PATCH", json: { name }, query: on(entityId) },
  );

export const deleteContact = (entityId: string, id: string) =>
  mintyFetch<{ archived: boolean; message: string }>(
    `/api/me/company/contacts/${encodeURIComponent(id)}`,
    { method: "DELETE", query: on(entityId) },
  );
