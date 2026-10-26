"use client";

/**
 * The company's name, country and currency (Flask's Entity & Integration form). The name is an
 * admin's to change; the country and currency an accountant's and up. Only what changed is sent;
 * a currency picked explicitly wins, and a country alone brings its own currency (Flask's rule).
 * Enter saves. An emptied name is never sent: the field says so once Save is tried or the field is
 * left, and the message goes as soon as a name is typed.
 */

import { RequiredMark } from "@/components/ui/RequiredMark";
import { useState, type FormEvent } from "react";

import {
  SHEET_FIELD_ERROR,
  SHEET_INPUT,
  SHEET_INPUT_BAD,
  SHEET_INPUT_OK,
  SHEET_LABEL,
  SHEET_PRIMARY,
} from "@/components/ui/sheetClasses";

import type { IntegrationPage } from "@/features/company-settings/api/companySettings";
import type {
  DetailsChanges,
  DetailsDraft,
} from "@/features/company-settings/hooks/useDetailsDraft";

export const NAME_MISSING = "The company name is still empty. Add the company name to continue.";

export function DetailsForm({
  page,
  draft,
  busy,
  error,
  onSave,
}: {
  page: IntegrationPage;
  /** The values as typed - `useDetailsDraft`, held by the screen so the leave guard can see it. */
  draft: DetailsDraft;
  busy: boolean;
  error: string;
  onSave: (changes: DetailsChanges) => void;
}) {
  const { name, country, currency, dirty } = draft;
  // Set when Save is tried or the name field is left, unset by typing: the message shows while the
  // name is blank, and goes the moment the user types.
  const [checkName, setCheckName] = useState(false);
  const nameError = checkName && draft.nameMissing;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (draft.nameMissing) {
      setCheckName(true);
      return;
    }
    if (dirty && !busy && page.can_edit) onSave(draft.changes);
  };

  return (
    <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={submit} noValidate>
      <div className="md:col-span-2">
        <label htmlFor="company-name" className={SHEET_LABEL}>
          Company name
          <RequiredMark />
        </label>
        <input
          id="company-name"
          type="text"
          maxLength={100}
          className={`${SHEET_INPUT} ${nameError ? SHEET_INPUT_BAD : SHEET_INPUT_OK}`}
          value={name}
          disabled={!page.can_rename || busy}
          aria-required
          aria-invalid={nameError || undefined}
          aria-describedby={nameError ? "company-name-error" : undefined}
          onChange={(e) => {
            setCheckName(false);
            draft.setName(e.target.value);
          }}
          onBlur={() => setCheckName(true)}
        />
        {nameError ? (
          <p id="company-name-error" className={SHEET_FIELD_ERROR}>
            {NAME_MISSING}
          </p>
        ) : null}
        {!page.can_rename && page.can_edit ? (
          <p className="mt-1.5 text-[12.5px] text-gray-500">
            Only an admin can rename the company.
          </p>
        ) : null}
      </div>
      <div className="min-w-0">
        <label htmlFor="company-country" className={SHEET_LABEL}>
          Country
          <RequiredMark />
        </label>
        <select
          id="company-country"
          className={`${SHEET_INPUT} ${SHEET_INPUT_OK}`}
          value={country}
          disabled={!page.can_edit || busy}
          onChange={(e) => draft.setCountry(e.target.value)}
        >
          {country ? null : <option value="">Choose a country</option>}
          {page.countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0">
        <label htmlFor="company-currency" className={SHEET_LABEL}>
          Currency
          <RequiredMark />
        </label>
        <select
          id="company-currency"
          className={`${SHEET_INPUT} ${SHEET_INPUT_OK}`}
          value={currency}
          disabled={!page.can_edit || busy}
          onChange={(e) => draft.setCurrency(e.target.value)}
        >
          {currency ? null : <option value="">Choose a currency</option>}
          {page.currencies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="text-sm text-danger md:col-span-2" role="alert">
          {error}
        </p>
      ) : null}
      {page.can_edit ? (
        <div className="flex justify-end md:col-span-2">
          <button
            type="submit"
            className={`${SHEET_PRIMARY} w-full sm:w-auto`}
            disabled={!dirty || busy}
          >
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
