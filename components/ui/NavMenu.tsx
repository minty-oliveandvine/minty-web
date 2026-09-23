"use client";

/**
 * The hamburger drawer of billing-frontend's header (`components/layout/NavMenu.tsx` there),
 * so a page here reads as one of its pages: the company's abbreviation, "Select entity", the
 * Petty Cash and Payment Request sections (each only when that module is on), Settings, Logout
 * and the cat. What differs is where the links go - this app has no pages of its own for them,
 * so Petty Cash goes into Minty through `/entity/<id>/enter` (the cookie token re-establishes
 * the Flask session, as billing-frontend does), Payments to the payments app, Logout to Minty's.
 */

import Image from "next/image";
import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";

import { clearAuth, getAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { mintyEntryUrl } from "@/lib/mintyEntry";

export type NavItem = { href: string; label: string; icon: string; current?: boolean };
export type NavSection = { title: string; items: NavItem[] };

export type NavMenuProps = {
  companyAbbreviation?: string;
  /** Which modules the company has - a section for a module that is off is not offered. */
  modules: { pettyCash: boolean; billing: boolean };
  /** This app's settings page, so the Settings item stays in the app. */
  settingsHref: string;
};

function buildSections(modules: NavMenuProps["modules"]): NavSection[] {
  const auth = getAuth();
  const sections: NavSection[] = [];
  if (modules.pettyCash) {
    const reports = auth?.entityId ? `/entity/${auth.entityId}/reports` : undefined;
    sections.push({
      title: "Petty Cash",
      items: [
        { href: mintyEntryUrl(), label: "Dashboard", icon: "space_dashboard" },
        { href: mintyEntryUrl(reports), label: "Reports", icon: "bar_chart" },
      ],
    });
  }
  if (modules.billing) {
    sections.push({
      title: "Payment Request",
      items: [{ href: `${env.PAYMENTS_WEB_URL}/`, label: "Payments", icon: "local_atm" }],
    });
  }
  return sections;
}

// The drawer is rendered only on the client (a portal), and the cookie it reads is only
// readable there: "mounted" is the server/client seam, as Header.tsx does it.
const noSubscribe = () => () => {};
const clientTrue = () => true;
const serverFalse = () => false;

function ItemLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  return (
    <a
      href={item.href}
      onClick={onNavigate}
      aria-current={item.current ? "page" : undefined}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-base font-medium transition-colors ${
        item.current ? "bg-secondary/15 text-secondary" : "text-primary hover:bg-primary/10"
      }`}
    >
      <span
        className={`material-symbols-outlined shrink-0 text-[22px] leading-none ${
          item.current ? "text-secondary" : "text-primary"
        }`}
        aria-hidden
      >
        {item.icon}
      </span>
      {item.label}
    </a>
  );
}

export function NavMenu({ companyAbbreviation = "---", modules, settingsHref }: NavMenuProps) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(noSubscribe, clientTrue, serverFalse);
  const panelId = useId();

  // Read once mounted (the cookie is not there during server rendering) and when the
  // company's modules change; `mounted` in the deps is what makes the first client read happen.
  const sections = useMemo(() => (mounted ? buildSections(modules) : []), [mounted, modules]);
  const hasEntity = mounted && Boolean(getAuth()?.entityId);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const logout = () => {
    close();
    clearAuth();
    window.location.href = `${env.MINTY_URL}/logout`;
  };

  const selectEntity: NavItem = {
    href: `${env.MINTY_URL}/entity`,
    label: "Select entity",
    icon: "corporate_fare",
  };
  const settings: NavItem = {
    href: settingsHref,
    label: "Settings",
    icon: "settings",
    current: true,
  };

  const drawer = (
    <div
      className={`fixed inset-0 z-[200] overflow-x-hidden overscroll-x-none ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={`absolute inset-0 cursor-pointer bg-black/40 transition-opacity duration-300 ease-out ${open ? "opacity-100" : "opacity-0"}`}
        onClick={close}
        tabIndex={open ? 0 : -1}
        aria-label="Close menu"
      />
      <nav
        id={panelId}
        className={`absolute right-0 top-0 flex h-full w-[min(100%,14rem)] flex-col bg-white pt-[env(safe-area-inset-top,0px)] shadow-xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        aria-label="Main navigation"
      >
        <div className="flex flex-col gap-3 border-b border-primary/20 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span
              className="min-w-0 truncate text-sm font-semibold tracking-wide text-primary sm:text-base"
              title={companyAbbreviation}
            >
              {companyAbbreviation}
            </span>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined text-[26px] leading-none">close</span>
            </button>
          </div>
          {hasEntity ? <ItemLink item={selectEntity} onNavigate={close} /> : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {hasEntity ? (
              <div className="w-full max-h-[calc(100%-11.5rem)] flex-none overflow-y-auto overscroll-contain">
                <div className="flex flex-col gap-3">
                  {sections.map((section) => (
                    <div
                      key={section.title}
                      className={`flex flex-col ${section.title === "Payment Request" ? "mt-6 gap-3" : "gap-1"}`}
                      role="group"
                      aria-label={section.title}
                    >
                      <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-primary/70">
                        {section.title}
                      </p>
                      <ul className="flex flex-col gap-1">
                        {section.items.map((item) => (
                          <li key={item.label} className="w-full">
                            <ItemLink item={item} onNavigate={close} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div
              className={`shrink-0 -mx-4 sm:-mx-6 ${hasEntity ? "mt-4 border-t border-primary/15" : ""}`}
              role="presentation"
            >
              <div className="flex flex-col gap-1 px-4 pt-4 sm:px-6 sm:pt-4">
                {hasEntity ? <ItemLink item={settings} onNavigate={close} /> : null}
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-left text-base font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  <span
                    className="material-symbols-outlined shrink-0 text-[22px] leading-none text-primary"
                    aria-hidden
                  >
                    logout
                  </span>
                  Logout
                </button>
              </div>
            </div>
            <div className="min-h-0 min-w-0 flex-1" aria-hidden />
            {/* the cat sits at the bottom of the drawer on every page - decoration, not navigation */}
            <div className="flex shrink-0 justify-center px-2 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
              <Image
                src="/cat.png"
                alt=""
                width={200}
                height={180}
                className="h-auto w-[min(100%,10rem)] object-contain object-bottom select-none"
                draggable={false}
                unoptimized
              />
            </div>
          </div>
        </div>
      </nav>
    </div>
  );

  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Open navigation menu"
      >
        <span className="material-symbols-outlined text-[26px] leading-none">menu</span>
      </button>
      {mounted ? createPortal(drawer, document.body) : null}
    </div>
  );
}
