/**
 * The three tabs' browser titles, "Users - <company>", "General - <company>" and
 * "Integration - <company>"
 * (lib/companyTitle.ts). Kept out of the "use client" route files: a page's metadata is the
 * server's.
 */

import { companyPageMetadata } from "@/lib/companyTitle";
import { SETTINGS_TAB_LABELS } from "@/lib/settingsTabs";

export const usersMetadata = companyPageMetadata(SETTINGS_TAB_LABELS.users);
export const generalMetadata = companyPageMetadata(SETTINGS_TAB_LABELS.general);
export const integrationMetadata = companyPageMetadata(SETTINGS_TAB_LABELS.integration);
