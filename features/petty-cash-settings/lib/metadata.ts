/**
 * The tab's browser title, "Petty Cash Settings - <company>" (lib/companyTitle.ts). Kept out of
 * the "use client" route files: a page's metadata is the server's.
 */

import { companyPageMetadata } from "@/lib/companyTitle";
import { SETTINGS_TAB_LABELS } from "@/lib/settingsTabs";

export const pettyCashSettingsMetadata = companyPageMetadata(SETTINGS_TAB_LABELS["petty-cash"]);
