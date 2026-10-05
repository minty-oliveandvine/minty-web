/**
 * The module choice's browser title, "Choose Module Type - <company>" (lib/companyTitle.ts). Kept
 * out of the "use client" route file: a page's metadata is the server's.
 */

import { companyPageMetadata } from "@/lib/companyTitle";

import { MODULE_CHOICE_TITLE } from "@/features/entities/lib/moduleChoice";

export const moduleChoiceMetadata = companyPageMetadata(MODULE_CHOICE_TITLE);
