# features/petty-cash-settings — the Petty Cash Settings tab

The fourth settings tab, `/entity/<shortid>/<name>/settings/petty-cash`, moved here from
minty-petty-cash-web on 2026-11-10 (owner). The rules and copy: `docs/features/petty-cash-settings.md`.

```
index.ts        THE public surface: CompanyPettyCashSettingsPage, pettyCashSettingsMetadata
api/            pettyCashSettings.ts - every call (pettyCashFetch, /api/petty-cash/v1/companies/<id>/...)
lib/            settings.ts (sales methods' rules), xeroSettings.ts (the Xero cards' rules) - both
                ported unchanged; paths.ts, metadata.ts
components/     parts.tsx (the card with its fold, the searchable picker, the busy overlay),
                SalesMethodsCard (Electronic, Delivery), XeroCards (the mapping, the account codes)
routes/         PettyCashSettingsPage (the company from the address) -> PettyCashSettingsScreen
__tests__/      settings, xeroCards, screens, the re-export guard
e2e/            13_petty_cash_settings.spec.ts, over a stubbed API
```

The rules are the other features' (`features/subscription/README.md`): this folder imports only
itself, `@/lib/**` and `@/components/ui/**`; only `app/entity/[ref]/[slug]/settings/petty-cash`
imports it, and only its index, in a one-line re-export.
