/**
 * The Module tab's browser title, "Modules - <company>" (lib/companyTitle.ts). Kept out of the
 * "use client" route file: a page's metadata is the server's.
 */

import { companyPageMetadata } from "@/lib/companyTitle";
import { SETTINGS_TAB_LABELS } from "@/lib/settingsTabs";

export const moduleSettingsMetadata = companyPageMetadata(SETTINGS_TAB_LABELS.modules);
