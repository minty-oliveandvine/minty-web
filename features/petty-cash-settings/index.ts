/**
 * THE public surface of the petty-cash-settings feature: a company's Petty Cash Settings tab,
 * moved into the hub from minty-petty-cash-web (owner, 2026-11-10).
 * `app/entity/[ref]/[slug]/settings/petty-cash` re-exports from here and nothing else may import
 * anything deeper (eslint.config.mjs, boundaries/entry-point).
 */

export { CompanyPettyCashSettingsPage } from "@/features/petty-cash-settings/routes/PettyCashSettingsPage";
export { pettyCashSettingsMetadata } from "@/features/petty-cash-settings/lib/metadata";
