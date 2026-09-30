"use client";

/**
 * `/profile` - My Profile as a page (Figma 10-A / 10-B, 1410:3314 / 1410:3364). Inside this app
 * the profile opens in the sidebar instead (`ProfilePanel`); the page stays for Minty's `/profile`
 * router and the links that still use it (the payments app's portal crumbs, a header without
 * scripts) - both other apps open a copy of the sidebar's My Profile in place since 2026-09-30. One column, the design's own 375 px on a
 * phone, centred at up to 560 px wider than that (the design has no desktop frame: "only the
 * profile exists at 375").
 *
 * `subscriptions` is the slot between the details card and Log Out: the "Subscriptions
 * Overview" card, which belongs to the subscription feature and is composed in by the shell
 * (`app/profile/page.tsx`) - this feature never reaches into another. An app without that
 * feature simply passes nothing.
 */

import type { ReactNode } from "react";

import { ProfileBody } from "@/features/profile/components/ProfileBody";
import { ProfileTitlebar } from "@/features/profile/components/ProfileParts";
import { useProfile, type UseProfileArgs } from "@/features/profile/hooks/useProfile";
import { backHref } from "@/features/profile/lib/profileView";

export type ProfileScreenProps = UseProfileArgs & {
  /** `?from=bills`: opened from the payments app, so the back arrow returns there. */
  from?: string | null;
  subscriptions?: ReactNode;
};

export function ProfileScreen({ from = null, subscriptions, ...args }: ProfileScreenProps) {
  const p = useProfile(args);

  return (
    <div className="flex min-h-dvh flex-col bg-[#f9fafb]">
      <ProfileTitlebar back={backHref(p.entityId, from)} />
      <main className="mx-auto flex w-full max-w-[560px] flex-col px-4 pb-10">
        <ProfileBody model={p} subscriptions={subscriptions} />
      </main>
    </div>
  );
}
