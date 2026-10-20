/**
 * The `/profile` page's titlebar (Figma 10-A, 1410:3314): ‹, "My Profile", the side menu - no
 * initials badge: this page IS the person. The rest of My Profile - the head, the details card,
 * Log Out, the sidebar panel's own titlebar - is `@minty/shared/profile`'s (v0.6).
 */

import Image from "next/image";

import { BackLink } from "@/components/ui/BackLink";
import { NavMenu } from "@/components/ui/NavMenu";

import { PAGE_TITLE } from "@/features/profile/lib/profileView";

export function ProfileTitlebar({ back }: { back: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between bg-canvas px-4 py-1.5 sm:h-15 sm:px-6 lg:px-8">
      <BackLink
        href={back}
        ariaLabel="Back"
        className="flex size-11 items-center justify-center rounded-lg hover:bg-hover"
      >
        <Image
          className="-scale-x-100"
          src="/profile/back.svg"
          alt=""
          width={24}
          height={24}
          unoptimized
        />
      </BackLink>
      <h1 className="p-2.5 text-center text-base font-semibold whitespace-nowrap text-ink-2">
        {PAGE_TITLE}
      </h1>
      <NavMenu />
    </header>
  );
}
