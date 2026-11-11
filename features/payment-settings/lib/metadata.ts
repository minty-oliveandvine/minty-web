/**
 * The tab's browser title, "Payment Settings - <company>" (lib/companyTitle.ts). Kept out of the
 * "use client" route file: a page's metadata is the server's.
 */

import { companyPageMetadata } from "@/lib/companyTitle";
import { SETTINGS_TAB_LABELS } from "@/lib/settingsTabs";

export const paymentSettingsMetadata = companyPageMetadata(SETTINGS_TAB_LABELS.payment);
