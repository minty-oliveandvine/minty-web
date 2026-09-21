"use client";

/**
 * The header of the payer portal's pages: billing-frontend's header (`components/ui/AppHeader`),
 * as every page here must read as one of its pages. The portal is person-scoped - the way back
 * is Minty's entity list, and the drawer's module sections follow the token's claims (the
 * company in the cookie, when the person came from one).
 */

import { useSyncExternalStore } from "react";

import { AppHeader } from "@/components/ui/AppHeader";
import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { getModuleClaims, type ModuleClaims } from "@/lib/moduleClaims";

import { modulesPath, PORTAL } from "@/features/subscription/lib/paths";

// Primitives only: a fresh object per read would make useSyncExternalStore loop.
const noSubscribe = () => () => {};
const readEntityId = () => getAuth()?.entityId ?? "";
const readEntityName = () => getAuth()?.entityName ?? "";
const serverEmpty = () => "";

let claimsCache: { token: string; claims: ModuleClaims } | null = null;
const readClaims = (): ModuleClaims => {
  const token = getAuth()?.token ?? "";
  if (!claimsCache || claimsCache.token !== token) {
    claimsCache = { token, claims: getModuleClaims() };
  }
  return claimsCache.claims;
};
const NONE: ModuleClaims = { pettyCash: false, billing: false };
const serverClaims = () => NONE;

function abbreviate(name: string): string {
  if (!name) return "---";
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
}

export function PortalChrome() {
  const entityId = useSyncExternalStore(noSubscribe, readEntityId, serverEmpty);
  const entityName = useSyncExternalStore(noSubscribe, readEntityName, serverEmpty);
  const claims = useSyncExternalStore(noSubscribe, readClaims, serverClaims);

  return (
    <AppHeader
      title="Subscriptions"
      back={{ href: `${env.MINTY_URL}/entity`, label: "Minty" }}
      companyName={entityName || "My companies"}
      companyAbbreviation={abbreviate(entityName)}
      nav={{
        modules: entityId ? claims : NONE,
        settingsHref: entityId ? modulesPath(entityId) : PORTAL.index,
      }}
    />
  );
}
