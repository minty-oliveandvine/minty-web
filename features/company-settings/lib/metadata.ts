/**
 * The two tabs' browser titles, "Users - <company>" and "Entity & Integration - <company>"
 * (lib/companyTitle.ts). Kept out of the "use client" route files: a page's metadata is the
 * server's.
 */

import { companyPageMetadata } from "@/lib/companyTitle";
import { SETTINGS_TAB_LABELS } from "@/lib/settingsTabs";

export const usersMetadata = companyPageMetadata(SETTINGS_TAB_LABELS.users);
export const integrationMetadata = companyPageMetadata(SETTINGS_TAB_LABELS.integration);
