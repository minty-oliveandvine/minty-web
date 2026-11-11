# features/company-settings — a company's Users, General and Integration tabs

Three of the six settings tabs (Figma 353:999, 2026-11-10), at
`/entity/<shortid>/<name>/settings/{users,general,integration}`; Petty Cash Settings and Payment
Settings are `features/petty-cash-settings` and `features/payment-settings`, the Module tab the
subscription feature's. The page, the card, the dialog, the buttons and fields are shared chrome in
`components/ui/` (`SettingsPage`, `SettingsShell`, `SettingsTabs`, `settingsButtons`,
`settingsFields`). accounts-api is the backend (`/api/me/company/*`, `hub/company.py`) and keeps the
old addresses as hand-overs here.

```
index.ts        THE public surface: CompanyUsersPage, CompanyGeneralPage, CompanyIntegrationPage (+ metadata)
api/            companySettings.ts - every call, ?entity= on each (mintyFetch); the page shapes
hooks/          useUsersTab (the page, invite / resend with the API's cooldown / cancel / role / remove),
                useIntegrationTab (General's and Integration's page model: save only what changed,
                disconnect, and the move a refused Xero connect offers),
                useDetailsDraft (General's draft, what changed, and the reset the leave guard
                discards with - held by the screen, not the form)
lib/            paths.ts (usersPath, generalPath, integrationPath - the shell's companySettingsPath),
                metadata.ts (the browser tab titles)
components/     MemberRow, InviteDialog, PendingInvitations, DetailsForm (SET-G), XeroCard (SET-1/SET-2
                and the two filled-in states), XeroConflictDialog (the organisation is in use elsewhere)
routes/         CompanySettingsPages (the company from the address, ?flash= and ?xero_conflict=
                read once) -> UsersScreen, GeneralScreen, IntegrationScreen (SET-2b's dialog)
__tests__/      the re-export guard, the three screens and the chrome
e2e/            12_company_settings.spec.ts, over a stubbed accounts API
```

The rules are the other features' (`features/subscription/README.md`): this folder imports only
itself, `@/lib/**` and `@/components/ui/**`; only `app/entity/[ref]/[slug]/settings/{users,general,integration}`
import it, and only its index; those three files are one-line re-exports.

Shared pieces: `components/ui/{SettingsPage, SettingsShell (SettingsCard, ReadOnlyNotice,
LoadState, SettingsDialog), SettingsTabs, settingsButtons, settingsFields, LeaveDialog,
CompanyFromAddress, Toast}`, `lib/{settingsTabs, emailInput, mintyEntry, moduleClaims}` and
`@minty/shared/leaveGuard`, which asks before General is left with changes not saved;
`docs/features/company-settings.md` has which exits it holds.

**Extraction:** `git mv features/company-settings app/` in the accounts app, point `@/lib` and
`@/components/ui` at `@minty/shared`.
