"use client";

/**
 * The header of the payer portal's pages: minty-payment-request-web's header (`components/ui/AppHeader`),
 * as every page here must read as one of its pages. Its left is the page's own way back
 * (`PortalBack`), lined up with the teal banner - no "‹ Entity List" and no title since
 * 2026-09-29 (the user); the banner names the page. The side menu works out for itself whether a
 * company is in the cookie (its Petty Cash / Payment Request sections and Settings show only
 * then).
 */

import { useSyncExternalStore } from "react";

import { AppHeader } from "@/components/ui/AppHeader";
import { getAuth } from "@/lib/auth";

import { PortalBackSlot } from "@/features/subscription/components/PortalBack";

// Primitives only: a fresh object per read would make useSyncExternalStore loop.
const noSubscribe = () => () => {};
const readEntityName = () => getAuth()?.entityName ?? "";
const serverEmpty = () => "";

export function PortalChrome() {
  const entityName = useSyncExternalStore(noSubscribe, readEntityName, serverEmpty);

  return (
    <AppHeader lead={<PortalBackSlot />} companyName={entityName || "Subscriptions"} />
  );
}
