"use client";

/**
 * The company's name, country and currency (Flask's Entity & Integration form). The name is an
 * admin's to change; the country and currency an accountant's and up. Only what changed is sent;
 * a currency picked explicitly wins, and a country alone brings its own currency (Flask's rule).
 * Enter saves.
 */

import { useState, type FormEvent } from "react";

import { SHEET_INPUT, SHEET_INPUT_OK, SHEET_LABEL, SHEET_PRIMARY } from "@/components/ui/sheetClasses";

import type { IntegrationPage } from "@/features/company-settings/api/companySettings";

export function DetailsForm({
  page,
  busy,
  error,
  onSave,
}: {
  page: IntegrationPage;
  busy: boolean;
  error: string;
  onSave: (changes: { name?: string; country_code?: string; currency_id?: string }) => void;
}) {
  const [name, setName] = useState(page.company.name);
  const [country, setCountry] = useState(page.company.country_code ?? "");
  const [currency, setCurrency] = useState(page.company.currency_id ?? "");

  const changes: { name?: string; country_code?: string; currency_id?: string } = {};
  if (page.can_rename && name.trim() !== page.company.name) changes.name = name.trim();
  if (country && country !== (page.company.country_code ?? "")) changes.country_code = country;
  if (currency && currency !== (page.company.currency_id ?? "")) changes.currency_id = currency;
  const dirty = Object.keys(changes).length > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (dirty && !busy && page.can_edit) onSave(changes);
  };

  return (
    <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={submit} noValidate>
      <div className="md:col-span-2">
        <label htmlFor="company-name" className={SHEET_LABEL}>
          Company name
        </label>
        <input
          id="company-name"
          type="text"
          maxLength={100}
          className={`${SHEET_INPUT} ${SHEET_INPUT_OK}`}
          value={name}
          disabled={!page.can_rename || busy}
          onChange={(e) => setName(e.target.value)}
        />
        {!page.can_rename && page.can_edit ? <p className="mt-1.5 text-[12.5px] text-gray-500">Only an admin can rename the company.</p> : null}
      </div>
      <div className="min-w-0">
        <label htmlFor="company-country" className={SHEET_LABEL}>
          Country
        </label>
        <select
          id="company-country"
          className={`${SHEET_INPUT} ${SHEET_INPUT_OK}`}
          value={country}
          disabled={!page.can_edit || busy}
          onChange={(e) => setCountry(e.target.value)}
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
        </label>
        <select
          id="company-currency"
          className={`${SHEET_INPUT} ${SHEET_INPUT_OK}`}
          value={currency}
          disabled={!page.can_edit || busy}
          onChange={(e) => setCurrency(e.target.value)}
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
          <button type="submit" className={`${SHEET_PRIMARY} w-full sm:w-auto`} disabled={!dirty || busy}>
            {busy ? "Saving…" : "Save Changes"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
