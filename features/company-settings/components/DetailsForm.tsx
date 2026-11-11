"use client";

/**
 * The General tab's form (Figma SET-G, owner 2026-11-10): the "Entity name" card - the name people
 * see for this company - with the country and currency its reports use under it (the frame draws
 * only the name; General = name + country + currency, owner the same day). The name is an admin's
 * to change; the country and currency an accountant's and up. Only what changed is sent; a currency
 * picked explicitly wins, and a country alone brings its own currency (the API's rule). Enter
 * saves. "Save changes" waits for a change and says so beside it. An emptied name is never sent:
 * the field says so once Save is tried or the field is left, and the message goes as soon as a name
 * is typed.
 */

import { useState, type FormEvent } from "react";

import { RequiredMark } from "@/components/ui/RequiredMark";

import type { IntegrationPage } from "@/features/company-settings/api/companySettings";
import { SETTINGS_PRIMARY } from "@/components/ui/settingsButtons";
import {
  SETTINGS_FIELD_ERROR,
  SETTINGS_INPUT,
  SETTINGS_INPUT_BAD,
  SETTINGS_INPUT_OK,
  SETTINGS_LABEL,
} from "@/components/ui/settingsFields";
import { SettingsCard } from "@/components/ui/SettingsShell";
import type {
  DetailsChanges,
  DetailsDraft,
} from "@/features/company-settings/hooks/useDetailsDraft";

export const NAME_MISSING = "The company name is still empty. Add the company name to continue.";

export const GENERAL_COPY = {
  title: "Entity name",
  lead: "The name people see for this company",
  save: "Save changes",
  saving: "Saving…",
  unchanged: "No changes to save yet",
  renameAdminOnly: "Only an admin can rename the company.",
} as const;

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

  const described = [
    "company-name-lead",
    nameError ? "company-name-error" : "",
    !page.can_rename && page.can_edit ? "company-name-admin" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <form onSubmit={submit} noValidate className="min-w-0">
      <SettingsCard
        title={
          <>
            {GENERAL_COPY.title}
            <RequiredMark />
          </>
        }
        titleId="company-name-title"
        readOnly={!page.can_edit}
      >
        <p id="company-name-lead" className="text-[13px] text-set-ink-2">
          {GENERAL_COPY.lead}
        </p>
        <div className="min-w-0">
          <input
            id="company-name"
            type="text"
            maxLength={100}
            className={`${SETTINGS_INPUT} ${nameError ? SETTINGS_INPUT_BAD : SETTINGS_INPUT_OK}`}
            value={name}
            disabled={!page.can_rename || busy}
            aria-labelledby="company-name-title"
            aria-describedby={described}
            aria-required
            aria-invalid={nameError || undefined}
            onChange={(e) => {
              setCheckName(false);
              draft.setName(e.target.value);
            }}
            onBlur={() => setCheckName(true)}
          />
          {nameError ? (
            <p id="company-name-error" className={SETTINGS_FIELD_ERROR}>
              {NAME_MISSING}
            </p>
          ) : null}
          {!page.can_rename && page.can_edit ? (
            <p id="company-name-admin" className="mt-1.5 text-[12.5px] text-set-mute">
              {GENERAL_COPY.renameAdminOnly}
            </p>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="company-country" className={SETTINGS_LABEL}>
              Country
              <RequiredMark />
            </label>
            <select
              id="company-country"
              className={`${SETTINGS_INPUT} ${SETTINGS_INPUT_OK}`}
              value={country}
              disabled={!page.can_edit || busy}
              aria-required
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
            <label htmlFor="company-currency" className={SETTINGS_LABEL}>
              Currency
              <RequiredMark />
            </label>
            <select
              id="company-currency"
              className={`${SETTINGS_INPUT} ${SETTINGS_INPUT_OK}`}
              value={currency}
              disabled={!page.can_edit || busy}
              aria-required
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
        </div>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {page.can_edit ? (
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className={SETTINGS_PRIMARY} disabled={!dirty || busy}>
              {busy ? GENERAL_COPY.saving : GENERAL_COPY.save}
            </button>
            {dirty ? null : (
              <span className="text-[13px] text-set-mute">{GENERAL_COPY.unchanged}</span>
            )}
          </div>
        ) : null}
      </SettingsCard>
    </form>
  );
}
