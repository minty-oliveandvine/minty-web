# features/company-settings — a company's Users and Entity & Integration tabs

Since phase 2 (2026-10-05) these two tabs are this app's, at
`/entity/<shortid>/<name>/settings/{users,integration}` beside the Module tab (the subscription
feature's). They were Flask's Jinja pages; Flask keeps their old addresses as hand-overs here and
stays the backend: `/api/me/company/*` (Minty `blueprints/entity/routes/hub_settings.py`). Petty
Cash Settings and Payment Request Settings stay in their own apps.

```
index.ts        THE public surface: CompanyUsersPage, CompanyIntegrationPage
api/            companySettings.ts - every call, ?entity= on each (mintyFetch); the page shapes
hooks/          useUsersTab (the page, invite / resend with Flask's cooldown / cancel / role / remove),
                useIntegrationTab (the page, save only what changed, disconnect)
lib/            paths.ts (usersPath, integrationPath - the shell's companySettingsPath)
components/     SettingsShell (the Module tab's chrome: AppHeader, the pill row, Payment Request Settings' card,
                the read-only line, loading / failed), MemberRow, InviteDialog, PendingInvitations,
                DetailsForm, XeroCard
routes/         CompanySettingsPages (the company from the address, ?flash= read once) ->
                UsersScreen, IntegrationScreen
__tests__/      the re-export guard, both screens
e2e/            12_company_settings.spec.ts, over a stubbed Flask
```

The rules are the other features' (`features/subscription/README.md`): this folder imports only
itself, `@/lib/**` and `@/components/ui/**`; only `app/entity/[ref]/[slug]/settings/{users,integration}`
import it, and only its index; those two files are one-line re-exports.

Shared pieces: `components/ui/{AppHeader, SettingsTabs, ConfirmDialog, ModalFrame, sheetClasses,
CompanyFromAddress, Toast}`, `lib/{settingsTabs, emailInput, mintyEntry, moduleClaims}`.

**Extraction:** `git mv features/company-settings app/` in the accounts app, point `@/lib` and
`@/components/ui` at `@minty/shared`.
