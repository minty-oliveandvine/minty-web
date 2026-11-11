# features/payment-settings — the Payment Settings tab

The fifth settings tab, `/entity/<shortid>/<name>/settings/payment`, moved here from
minty-payment-request-web on 2026-11-10 (owner). The rules and copy: `docs/features/payment-settings.md`.

```
index.ts        THE public surface: CompanyPaymentSettingsPage, paymentSettingsMetadata
api/            paymentSettings.ts - every call (paymentRequestFetch with X-Entity-Id)
lib/            role.ts (view-only from the token), paths.ts, metadata.ts
components/     AccountCodeSettings (the Payment Account Code card, with its leave guard)
routes/         PaymentSettingsPages (the company from the address) -> PaymentSettingsScreen
__tests__/      screens, role, the re-export guard
e2e/            13_payment_settings.spec.ts, over a stubbed API
```

The rules are the other features' (`features/subscription/README.md`): this folder imports only
itself, `@/lib/**` and `@/components/ui/**`; only `app/entity/[ref]/[slug]/settings/payment`
imports it, and only its index, in a one-line re-export.
