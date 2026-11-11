/**
 * THE public surface of the company-settings feature (phase 2, 2026-10-05): a company's Users,
 * General and Integration tabs (Figma 353:999, 2026-11-10). `app/entity/[ref]/[slug]/settings/
 * {users,general,integration}` re-export from
 * here and nothing else may import anything deeper (eslint.config.mjs, boundaries/entry-point).
 */

export {
  CompanyGeneralPage,
  CompanyIntegrationPage,
  CompanyMatchingPage,
  CompanyUsersPage,
} from "@/features/company-settings/routes/CompanySettingsPages";
export {
  generalMetadata,
  integrationMetadata,
  matchingMetadata,
  usersMetadata,
} from "@/features/company-settings/lib/metadata";
