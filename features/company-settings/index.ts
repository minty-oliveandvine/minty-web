/**
 * THE public surface of the company-settings feature (phase 2, 2026-10-05): a company's Users and
 * Entity & Integration tabs. `app/entities/[ref]/[slug]/settings/{users,integration}` re-export from
 * here and nothing else may import anything deeper (eslint.config.mjs, boundaries/entry-point).
 */

export { CompanyIntegrationPage, CompanyUsersPage } from "@/features/company-settings/routes/CompanySettingsPages";
