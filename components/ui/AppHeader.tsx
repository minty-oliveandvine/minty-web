/**
 * billing-frontend's page header (`components/layout/Header.tsx` there), in the shape its
 * settings page uses: a back link, the title, then the company (`corporate_fare` + name), the
 * viewer's initials and the hamburger drawer. A page here must read as one of its pages, with
 * only the contents differing (decision 2026-09-21). The breadcrumb, logo and status-badge
 * variants of the original are not needed yet and are not ported.
 */

import { NavMenu, type NavMenuProps } from "@/components/ui/NavMenu";

export type AppHeaderProps = {
  title: string;
  back: { href: string; label: string };
  companyName: string;
  companyAbbreviation: string;
  /** The person looking; the badge shows their initials. Omitted, no badge is drawn. */
  viewer?: { name: string; initials: string } | null;
  nav: Omit<NavMenuProps, "companyAbbreviation">;
  /** Drop the bottom border when a sticky pills row sits directly below. */
  noBorder?: boolean;
};

export function AppHeader({
  title,
  back,
  companyName,
  companyAbbreviation,
  viewer,
  nav,
  noBorder = false,
}: AppHeaderProps) {
  return (
    <header
      className={`bg-white ${noBorder ? "" : "border-b border-gray-200"} pt-[env(safe-area-inset-top,0px)]`}
    >
      <div className="mx-auto flex w-full max-w-[1920px] flex-row items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6 sm:py-4">
        <div className="flex min-w-0 min-h-10 flex-1 items-center sm:min-h-0">
          <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 sm:gap-3">
            <a
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
            </a>
            <h1 className="min-w-0 cursor-default truncate text-base font-semibold text-black sm:text-lg">
              {title}
            </h1>
          </div>
        </div>
        <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 sm:gap-3">
          <span
            className="material-symbols-outlined text-[22px] leading-none text-primary sm:text-[26px]"
            aria-hidden
          >
            corporate_fare
          </span>
          <span className="min-w-0 max-w-[min(100%,6.5rem)] truncate text-sm font-medium text-primary sm:max-w-[9rem] sm:text-base md:max-w-[14rem] lg:max-w-md">
            {companyName}
          </span>
          <div className="flex shrink-0 items-center gap-1.5 pl-0.5 sm:gap-2 sm:pl-2">
            {viewer && (
              <span
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FFE6B1] text-[12px] font-semibold text-[#6B3A12]"
                role="img"
                aria-label={viewer.name}
                title={viewer.name}
              >
                {viewer.initials}
              </span>
            )}
            <NavMenu companyAbbreviation={companyAbbreviation} {...nav} />
          </div>
        </div>
      </div>
    </header>
  );
}
