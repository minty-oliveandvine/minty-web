"use client";

// COPIED on 2026-09-30 into minty-payment-request-web (same path, behind its components/ui/sidebarHost.ts)
// and ported to Flask (Minty docs/features/sidebar.md) - change all three until @minty/shared.

/**
 * The side menu's contents - Figma 02 / 10-C (`43YI3MYtTfX5Xzz6dRoRuT`, frames 1410:2899,
 * 1867:3304, 1871:3057) - drawn in the sidebar's menu view (`components/ui/Sidebar.tsx`).
 *
 * Top to bottom: the Minty mark; THE PERSON (avatar + name), which switches the sidebar to My
 * Profile (the header's initials open it there directly); Select Entity; Manage subscriptions;
 * then, INSIDE A COMPANY only (02-D), its Petty
 * Cash and Payment Request sections; the cat, above the last group (the user's rule); and
 * Settings (inside a company only - never on the entity list) and Logout.
 *
 * Where the links go: this app's own pages by `HUB_PATHS`; Petty Cash into Minty through
 * `/entity/<id>/enter` (the cookie's token re-establishes the Flask session); Bills to the
 * payments app; Logout to Minty's, which ends the session everywhere.
 */

import Image from "next/image";
import type { ReactNode } from "react";

import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { COMPANY_SETTINGS_PATTERN, companySettingsPath, HUB_PATHS } from "@/lib/hubPaths";
import { guardLeave } from "@/lib/leaveGuard";
import { logOut } from "@/lib/logout";
import { mintyEntryUrl } from "@/lib/mintyEntry";
import { getModuleClaims, type ModuleClaims } from "@/lib/moduleClaims";
import { useViewer, type Viewer } from "@/lib/viewer";

export type MenuContext = {
  /**
   * Which modules the company has, when the page knows better than the token (the module
   * settings page reads them fresh). Omitted, the token's claims decide. A module that is off
   * gets no section.
   */
  modules?: ModuleClaims;
  /** The person looking, when the page already knows them; else read once per token. */
  viewer?: Viewer | null;
};

export type SideMenuProps = MenuContext & {
  /** Every link calls it as it navigates, and Logout before it leaves. */
  onClose: () => void;
  /**
   * The person's block. Given (inside the sidebar), it is a button that does this - switch to
   * My Profile, or just close on the profile page itself. Omitted, it is a link to `/profile`.
   */
  onProfile?: () => void;
};

type Current = "profile" | "entities" | "subscriptions" | "settings" | null;

/** Which item is the page being shown - read off the URL, so every page gets it for free. */
export function currentOf(pathname: string): Current {
  if (pathname === HUB_PATHS.profile) return "profile";
  if (pathname === HUB_PATHS.entities) return "entities";
  if (COMPANY_SETTINGS_PATTERN.test(pathname)) return "settings";
  if (pathname === HUB_PATHS.subscription || pathname.startsWith(`${HUB_PATHS.subscription}/`)) {
    return "subscriptions";
  }
  return null;
}

// Minty v2: rows are 44 high at least, grey until hovered; the page being shown (aria-current)
// is tinted as the selected row. The one tinted row otherwise is Bills, which the design draws as
// a button ("Bill Button").
const ROW =
  "flex min-h-11 w-full items-center rounded-lg text-title-l font-medium transition-colors";
const IDLE =
  "text-ink-muted hover:bg-hover aria-[current=page]:bg-selected aria-[current=page]:text-link";
const BUTTON = "bg-selected text-link hover:bg-hover";

function MenuLink({
  href,
  current,
  className,
  onNavigate,
  children,
}: {
  href: string;
  current: boolean;
  className: string;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={`${ROW} ${IDLE} ${className}`}
    >
      {children}
    </a>
  );
}

function Separator() {
  return <div className="h-px w-full shrink-0 bg-line-subtle" role="presentation" />;
}

/** Figma "Manage subscriptions": four outlined rings, placed as the design places them. */
function SubscriptionsIcon() {
  return (
    <span className="relative block h-[31px] w-[28px] shrink-0" aria-hidden>
      <Image
        className="absolute left-[3px] top-[4px]"
        src="/menu/subscriptions-ring.svg"
        alt=""
        width={22}
        height={23}
        unoptimized
      />
      <Image
        className="absolute left-0 top-0"
        src="/menu/subscriptions-dot-large.svg"
        alt=""
        width={16}
        height={16}
        unoptimized
      />
      <Image
        className="absolute left-[20px] top-[6px]"
        src="/menu/subscriptions-dot-small.svg"
        alt=""
        width={8}
        height={8}
        unoptimized
      />
      <Image
        className="absolute left-[6px] top-[21px]"
        src="/menu/subscriptions-dot-medium.svg"
        alt=""
        width={10}
        height={10}
        unoptimized
      />
    </span>
  );
}

function ModuleHeading({
  title,
  tone,
  icon,
  iconBox,
}: {
  title: ReactNode;
  tone: string;
  icon: { src: string; width: number; height: number };
  iconBox: string;
}) {
  return (
    <div className="flex items-center justify-between pl-5">
      <p className={`text-title-l font-semibold ${tone}`}>{title}</p>
      <span
        className={`flex size-[76px] shrink-0 items-center justify-center rounded-full ${iconBox}`}
        aria-hidden
      >
        <Image src={icon.src} alt="" width={icon.width} height={icon.height} unoptimized />
      </span>
    </div>
  );
}

const PERSON =
  "mt-8 flex min-h-11 w-full cursor-pointer items-center gap-10 rounded-lg py-1 pl-9 text-left hover:bg-hover aria-[current=page]:bg-selected";

/** Rendered only in the browser (inside the sidebar's portal), so the cookie and the URL exist. */
export function SideMenu({ modules, viewer, onClose, onProfile }: SideMenuProps) {
  const person = useViewer(viewer);
  const current = currentOf(window.location.pathname);
  const entityId = getAuth()?.entityId ?? "";
  // Inside a company only - and never on the entity list, where a person is choosing one.
  const inCompany = entityId !== "" && current !== "entities";
  // Read at every render, never memoised: the sidebar outlives a client-side move - the landing
  // stores a token after it has mounted - so a value kept from mount would describe no one.
  const access = modules ?? getModuleClaims();

  // A page with unsaved changes asks first (`lib/leaveGuard.ts`), and this is the one exit that
  // needs saying so: it is a button, so the guard's click rule never sees it, and `logOut` clears
  // the token BEFORE it navigates - a browser prompt answered with "stay" would leave the person
  // on the page signed out. `guardLeave` does nothing on a page that arms no guard.
  const logout = () =>
    guardLeave(() => {
      onClose();
      logOut();
    });

  const reports = entityId ? `/entity/${entityId}/petty-cash/reports` : undefined;
  const who = (
    <>
      <span
        className="flex h-[57px] w-[56px] shrink-0 items-center justify-center rounded-full bg-[var(--avatar-bg)] text-display-l font-medium text-[var(--avatar-fg)]"
        aria-hidden
      >
        {person?.initials ?? ""}
      </span>
      <span
        className="max-w-[130px] break-words text-title-l text-ink"
        aria-hidden
      >
        {person?.name ?? "My Profile"}
      </span>
    </>
  );
  const whoLabel = person ? `${person.name}, My Profile` : "My Profile";

  return (
    <nav
      className="flex min-h-full flex-col px-12 pt-[max(48px,env(safe-area-inset-top,0px))] pb-[max(40px,env(safe-area-inset-bottom,0px))]"
      aria-label="Main navigation"
    >
      <Image
        className="ml-22 h-auto w-[99px] shrink-0"
        src="/menu/minty-logo.svg"
        alt="Minty"
        width={99}
        height={71}
        unoptimized
      />

      {onProfile ? (
        <button
          type="button"
          onClick={onProfile}
          aria-current={current === "profile" ? "page" : undefined}
          aria-label={whoLabel}
          className={PERSON}
        >
          {who}
        </button>
      ) : (
        <a
          href={HUB_PATHS.profile}
          onClick={onClose}
          aria-current={current === "profile" ? "page" : undefined}
          aria-label={whoLabel}
          className={PERSON}
        >
          {who}
        </a>
      )}

      <div className="mt-8">
        <Separator />
      </div>
      <div className="mt-4 flex flex-col gap-1">
        <MenuLink
          href={HUB_PATHS.entities}
          current={current === "entities"}
          onNavigate={onClose}
          className="gap-5 pl-8"
        >
          <span className="flex w-[28px] shrink-0 justify-center" aria-hidden>
            <Image src="/menu/select-entity.svg" alt="" width={22} height={20} unoptimized />
          </span>
          Select Entity
        </MenuLink>
        <MenuLink
          href={HUB_PATHS.subscription}
          current={current === "subscriptions"}
          onNavigate={onClose}
          className="gap-5 py-2 pl-8"
        >
          <SubscriptionsIcon />
          <span className="max-w-[130px]">Manage subscriptions</span>
        </MenuLink>
      </div>
      <div className="mt-4">
        <Separator />
      </div>

      {inCompany && (access.pettyCash || access.billing) ? (
        <div className="flex flex-col">
          {access.pettyCash ? (
            <div className="mt-6 flex flex-col" role="group" aria-label="Petty Cash">
              <ModuleHeading
                title="Petty Cash"
                tone="text-ink"
                icon={{ src: "/menu/petty-cash.svg", width: 42, height: 45 }}
                iconBox="bg-warning-bg"
              />
              <MenuLink
                href={mintyEntryUrl()}
                current={false}
                onNavigate={onClose}
                className="mt-4 gap-6 pl-5"
              >
                <Image
                  src="/menu/dashboard.svg"
                  alt=""
                  width={23}
                  height={23}
                  unoptimized
                  aria-hidden
                />
                Dashboard
              </MenuLink>
              <MenuLink
                href={mintyEntryUrl(reports)}
                current={false}
                onNavigate={onClose}
                className="gap-6 pl-5"
              >
                <Image
                  src="/menu/reports.svg"
                  alt=""
                  width={23}
                  height={23}
                  unoptimized
                  aria-hidden
                />
                Reports
              </MenuLink>
            </div>
          ) : null}
          {access.pettyCash && access.billing ? (
            <div className="mt-6">
              <Separator />
            </div>
          ) : null}
          {access.billing ? (
            <div className="mt-6 flex flex-col" role="group" aria-label="Payment Request">
              <ModuleHeading
                title={
                  <>
                    Payment
                    <br aria-hidden /> Request
                  </>
                }
                tone="text-info"
                icon={{ src: "/menu/payment-request.svg", width: 76, height: 76 }}
                iconBox=""
              />
              <a
                href={`${env.PAYMENT_REQUEST_WEB_URL}/`}
                onClick={onClose}
                className={`${ROW} ${BUTTON} mt-7 gap-6 pl-4`}
              >
                <Image
                  src="/menu/bills.svg"
                  alt=""
                  width={27}
                  height={20}
                  unoptimized
                  aria-hidden
                />
                Bills
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-6 flex-1" aria-hidden />
      {/* The cat sits above Settings and Logout on every page (the user's rule, 2026-09-29) -
          decoration, not navigation. Flask's own side panel draws the same one. */}
      <div className="flex shrink-0 justify-center pb-4">
        <Image
          src="/menu/sidepanel_cat.webp"
          alt=""
          width={1370}
          height={1101}
          className="h-auto w-[min(100%,10rem)] select-none object-contain"
          draggable={false}
          unoptimized
        />
      </div>
      <Separator />
      <div className="mt-4 flex flex-col gap-1">
        {inCompany ? (
          <MenuLink
            href={companySettingsPath(entityId, getAuth()?.entityName ?? "")}
            current={current === "settings"}
            onNavigate={onClose}
            className="gap-4 pl-4"
          >
            <span className="flex size-[31px] shrink-0 items-center justify-center" aria-hidden>
              <Image
                className="-scale-y-100"
                src="/menu/settings.svg"
                alt=""
                width={27}
                height={27}
                unoptimized
              />
            </span>
            Settings
          </MenuLink>
        ) : null}
        <button
          type="button"
          onClick={logout}
          className={`${ROW} ${IDLE} cursor-pointer gap-4 pl-4 text-left`}
        >
          <span className="flex size-[31px] shrink-0 items-center justify-center" aria-hidden>
            <Image src="/menu/logout.svg" alt="" width={23} height={23} unoptimized />
          </span>
          Logout
        </button>
      </div>
    </nav>
  );
}
