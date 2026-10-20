"use client";

/**
 * `/profile` - My Profile as a page (Figma 10-A / 10-B, 1410:3314 / 1410:3364). Inside this app
 * the profile opens in the sidebar instead (`ProfilePanel`); the page stays for Minty's `/profile`
 * router and the links that still use it (the payments app's portal crumbs, a header without
 * scripts). One column, the design's own 375 px on a phone, centred at up to 560 px wider than
 * that (the design has no desktop frame: "only the profile exists at 375").
 *
 * The body is `@minty/shared/profile`'s - the same one the sidebar draws (v0.6); the page's own
 * part is its titlebar (‹, "My Profile", the side menu) and where ‹ goes. `subscriptions` is the
 * slot between the details card and Log Out, filled by the shell (`app/profile/page.tsx`).
 */

import { ProfileBody, useProfile, type ProfileApi } from "@minty/shared/profile";
import { useMemo, type ReactNode } from "react";

import "@/components/ui/sidebarHost";
import { useToast } from "@/components/ui/Toast";

import { profileApi } from "@/features/profile/api/profile";
import { ProfileTitlebar } from "@/features/profile/components/ProfileParts";
import { backHref } from "@/features/profile/lib/profileView";

export type ProfileScreenProps = {
  /** Dev-only: `?fixture=SCOPED|SUPERMINTY|UNSCOPED` (`__fixtures__/profile.ts`). */
  fixture?: string | null;
  subscriptions?: ReactNode;
};

/** The dev-only `?fixture=` switch: the named fixture instead of Flask, in development only. */
function apiFor(fixture: string | null | undefined): ProfileApi {
  if (process.env.NODE_ENV === "production" || !fixture) return profileApi;
  return {
    load: async (entityId, signal) => {
      const f = await import("@/features/profile/__fixtures__/profile");
      return f.isProfileFixture(fixture) ? f.FIXTURES[fixture] : profileApi.load(entityId, signal);
    },
    save: profileApi.save,
  };
}

export function ProfileScreen({ fixture = null, subscriptions }: ProfileScreenProps) {
  const { showToast } = useToast();
  const api = useMemo(() => apiFor(fixture), [fixture]);
  const p = useProfile(api, showToast);

  return (
    <div className="flex min-h-dvh flex-col bg-[#f9fafb]">
      <ProfileTitlebar back={backHref(p.entityId)} />
      <main className="mx-auto flex w-full max-w-[560px] flex-col px-4 pb-10">
        <ProfileBody model={p} subscriptions={subscriptions} />
      </main>
    </div>
  );
}
