/**
 * minty-payment-request-web's page header (`components/layout/Header.tsx` there), in two of its shapes:
 * the settings page's (a back link, the title, then the company - `corporate_fare` + name) and
 * the home page's (`showLogo`: the Minty mark, no way back - the entity list, whose title sits
 * in the middle of the bar: `centerTitle`, the user's call 2026-09-29).
 * On the right, always, the person's initials (My Profile) and the ≡ (the side menu) - one
 * sidebar, two views (`components/ui/Sidebar.tsx`). A page here must read as one of its pages,
 * with only the contents differing (decision 2026-09-21) - except the sidebar itself, which is
 * the Figma 02 / 10-A design since 2026-09-29. The breadcrumb and status-badge variants of the
 * original are not needed yet and are not ported.
 */

import Image from "next/image";
import type { ReactNode } from "react";

import { BackLink } from "@/components/ui/BackLink";
import { NavMenu, type NavMenuProps } from "@/components/ui/NavMenu";
import { ViewerBadge } from "@/components/ui/ViewerBadge";
import type { Viewer } from "@/lib/viewer";

export type AppHeaderProps = {
  /** The page's name in the bar - omitted when a `lead` stands in for it. */
  title?: string;
  /** The way back: `href` is the fallback; a plain click returns to the page the person came
   * from (components/ui/BackLink.tsx). Omitted on a page that is itself the start (the entity
   * list). */
  back?: { href: string; label: string };
  /** The company the page is about - omitted on a page about none. */
  companyName?: string;
  /** The Minty mark at the left, as minty-payment-request-web's home header draws it. */
  showLogo?: boolean;
  /** The title in the middle of the bar rather than beside the way back or the mark. */
  centerTitle?: boolean;
  /**
   * The left of the bar drawn by the page instead of the way back and the title (the payer
   * portal's back line). The row becomes a size container, so the lead can line itself up with
   * the page's column in `cqw`.
   */
  lead?: ReactNode;
  /**
   * The person looking, when the page already knows them (the module page's model names the
   * viewer). Omitted, the badge and the menu read it once per token (`lib/viewer.ts`).
   */
  viewer?: Viewer | null;
  nav?: Omit<NavMenuProps, "viewer">;
  /** Drop the bottom border when a sticky pills row sits directly below. */
  noBorder?: boolean;
};

export function AppHeader({
  title,
  back,
  companyName,
  showLogo = false,
  centerTitle = false,
  lead,
  viewer,
  nav,
  noBorder = false,
}: AppHeaderProps) {
  return (
    <header
      // Sticky on every page (the user, 2026-09-29): a page that scrolls the document (the
      // portal) keeps it in view; one that scrolls its own <main> under it never moves it anyway.
      // Above the page's own layers (row menus z-30), below the dialogs (150) and sidebar (200).
      // Its row has a fixed height so a bar sticking under it can use `--app-header-h`.
      className={`sticky top-0 z-40 bg-white ${noBorder ? "" : "border-b border-gray-200"} pt-[env(safe-area-inset-top,0px)]`}
    >
      <div className={`relative mx-auto flex w-full max-w-[1920px] ${lead ? "@container" : ""} flex h-16 flex-row items-center justify-between gap-2 px-4 sm:h-18 sm:gap-3 sm:px-6`}>
        <div className="flex min-w-0 min-h-10 flex-1 items-center sm:min-h-0">
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 sm:gap-3">
            {lead}
            {!lead && back ? (
              <BackLink
                href={back.href}
                className="inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary transition-colors hover:text-secondary sm:text-base"
              >
                <span
                  className="material-symbols-outlined text-[22px] leading-none sm:text-[24px]"
                  aria-hidden
                >
                  chevron_left
                </span>
                {back.label}
              </BackLink>
            ) : null}
            {!lead && showLogo ? (
              <Image
                src="/minty-mark.png"
                alt=""
                width={40}
                height={40}
                priority
                unoptimized
                className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
              />
            ) : null}
            {lead || centerTitle || !title ? null : (
              <h1 className="min-w-0 cursor-default truncate text-base font-semibold text-black sm:text-lg">
                {title}
              </h1>
            )}
          </div>
        </div>
        {!lead && centerTitle && title ? (
          <h1 className="absolute left-1/2 top-1/2 max-w-[45%] -translate-x-1/2 -translate-y-1/2 cursor-default truncate text-base font-semibold text-black sm:text-lg">
            {title}
          </h1>
        ) : null}
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-3">
          {companyName ? (
            <>
              <span
                className="material-symbols-outlined text-[22px] leading-none text-primary sm:text-[26px]"
                aria-hidden
              >
                corporate_fare
              </span>
              {/* A plain 6.5rem, not min(100%,6.5rem): a percentage cap counts as no cap while
                  the shrink-0 block around it is sized, so on a phone a long name made it cover
                  the way back (fixed in minty-payment-request-web's Header and Flask's port too). */}
              <span className="min-w-0 max-w-[6.5rem] truncate text-sm font-medium text-primary sm:max-w-[9rem] sm:text-base md:max-w-[14rem] lg:max-w-md">
                {companyName}
              </span>
            </>
          ) : null}
          <div className="flex shrink-0 items-center gap-1.5 pl-0.5 sm:gap-2 sm:pl-2">
            <ViewerBadge viewer={viewer} />
            <NavMenu {...nav} viewer={viewer} />
          </div>
        </div>
      </div>
    </header>
  );
}
