# Payment Settings (`features/payment-settings`)

A company's **Payment Settings** tab: which of its bill account codes the Payment Request module
offers. It moved here from minty-payment-request-web on 2026-11-10 (owner: every company setting
lives in the hub), at `/entity/<shortid>/<name>/settings/payment`, the fifth of the six settings
tabs (Figma 353:999; the chrome is `components/ui/SettingsPage.tsx`,
[company-settings.md](company-settings.md)). Behaviour and copy are the old page's; the host and
the look changed. The tab shows only when Payment Request is on (`billing` in the module claims).

## Getting here

- The tab row, from any settings tab.
- accounts-api's `/entity/<co>/settings/payment-request` hands over here (`hub/redirects.py`
  `settings_payment_request`, `_to_hub_tab(..., "payment")`) - what the payments app's sidebar
  Settings, its old address `/entity/<shortid>/<name>/settings/payment-request` (now a redirect)
  and old links reach.

## The API

minty-payment-request-api, through `lib/apiClient.ts` `paymentRequestFetch` (the module token's
bearer, `X-Entity-Id` naming the company - its door, `core/auth.py`, reads the header and needs a
role there). `PAYMENT_REQUEST_API_URL` (`lib/env.ts`; local `http://localhost:8020`), and the API
must list the hub in its CORS origins (`MINTY_WEB_URL` is in its default since 2026-11-10;
development's `CORS_ALLOWED_ORIGINS` override in minty-infra lists `dev-my`). Calls
(`api/paymentSettings.ts`): `GET /api/v1/auth/xero-status`,
`GET /api/v1/entity-bill-accounts/?include_inactive=true`, `PUT /api/v1/entity-bill-accounts/{id}`
with `{is_active}`.

**Saving writes `entity_bill_account_xero.is_active` only.** Onboarding's step 8 also writes
`account_module` PAYMENT_REQUEST (2026-11-10); unless minty-payment-request-api writes both, the
two tables drift after a save here - an open item for that API, not this page.

## The card (`components/AccountCodeSettings.tsx`)

**Payment Account Code** ("Only selected account code will appear when adding a payment in
Payment." - the old copy, kept), in a `SettingsCard`, folding under a 44px chevron:

- the search ("Search account code"), "Select all" for the rows shown (mixed when some are
  ticked; re-applied on fold and load), each row "<code> - <name>" as a 44px `<label>`, the list
  scrolling inside its own box;
- **Save Changes** inside the card, off with nothing changed ("No changes to save yet" beside it)
  and off with nothing ticked ("Pick at least one account code." beside it, `aria-describedby`).
  A save sends the rows turning ON first, then OFF (each batch `Promise.allSettled`), so it never
  passes through nothing ticked; the API refuses unticking the last one (409 "Keep at least one
  account code ticked.") and that sentence shows. Other refusals say "Some of those changes didn't
  save." A partly saved batch moves the saved set by each row that went through.
- **Without a live Xero connection** the card keeps its heading and shows only "Xero isn't
  connected. Connect it in Integration to set these up." - the link the hub's Integration tab.
  The codes are not read then. A failed status read is a failed read ("I couldn't load your
  account codes…"), never "not connected".
- **A company keeping its books in Minty** (`minty_only` from xero-status, Xero optional
  2026-11-10): its own expense accounts, read and saved as if live.
- **Read-only** (the token's `role` / `is_view_only`; a token without `is_view_only` and with a
  superadmin `system_role` counts as view-only): the shell's view-only notice, the ticks and Save
  off. The old page's `/api/v1/profile/me` fallback is gone - accounts-api's module token always
  carries `is_view_only`.
- **Leaving with ticks not saved asks first** (`@minty/shared/leaveGuard`,
  `components/ui/LeaveDialog.tsx`): the tab row, the header's Back, the sidebar, Logout and the
  browser's Back (its history sentinel); Discard changes puts the saved ticks back and goes.

Dropped in the move: the old pill row (`SettingsPills`), `?tab=` switching and its placeholder -
the hub's tab row replaces them.

## Known rough edges (from the old page, kept)

The empty-list sentence ("No account codes yet - I'll show them here once Xero's connected.")
also shows to connected or Minty-only companies; folding hides unsaved ticks (the guard still
holds them); the card's sentence is ungrammatical. Unchanged on purpose: "copy unchanged" was the
port's rule.

## Tests

`__tests__/screens.test.tsx` (load, ticking and Select all, save and its refusals, the Xero-status
and read-only states, the leave guard), `__tests__/role.test.ts`, `__tests__/reexports.test.ts`;
`e2e/13_payment_settings.spec.ts` (stubbed: the picker, Save's two off states, a 409 with ON sent
before OFF, the guard on the tab row, Back and the browser's Back, no sideways scroll at 360 /
768 / 1440).
