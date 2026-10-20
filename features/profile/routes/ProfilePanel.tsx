"use client";

/**
 * My Profile in the sidebar - the view the header's initials open, and the menu's name switches
 * to (the user's call, 2026-09-29: one sidebar, two views). The panel is `@minty/shared/profile`'s
 * (v0.6, the owner 2026-10-20: one implementation for every app, in the sidebar's look); this app
 * hands it its Flask calls and its toast. The `subscriptions` slot is the shell's to fill
 * (`app/layout.tsx`).
 */

import { ProfilePanel as SharedProfilePanel } from "@minty/shared/profile";
import type { ReactNode } from "react";

import "@/components/ui/sidebarHost";
import { useToast } from "@/components/ui/Toast";

import { profileApi } from "@/features/profile/api/profile";

export function ProfilePanel({ subscriptions }: { subscriptions?: ReactNode }) {
  const { showToast } = useToast();
  return <SharedProfilePanel api={profileApi} notify={showToast} subscriptions={subscriptions} />;
}
