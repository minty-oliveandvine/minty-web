/**
 * THE public surface of the payment-settings feature: a company's Payment Settings tab - the
 * Payment Request module's account codes (moved in from minty-payment-request-web, owner
 * 2026-11-10; Figma 353:999's language). `app/entity/[ref]/[slug]/settings/payment` re-exports
 * from here and nothing else may import anything deeper (eslint.config.mjs, boundaries/entry-point).
 */

export { CompanyPaymentSettingsPage } from "@/features/payment-settings/routes/PaymentSettingsPages";
export { paymentSettingsMetadata } from "@/features/payment-settings/lib/metadata";
