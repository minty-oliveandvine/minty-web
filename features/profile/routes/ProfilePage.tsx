"use client";

/**
 * `/profile` - My Profile. The query string carries `from` (`bills` when opened from the
 * payments app, so the back arrow returns there) and the dev-only `fixture` switch; the
 * `subscriptions` slot is filled by the shell (`app/profile/page.tsx`).
 */

import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { ProfileScreen } from "@/features/profile/routes/ProfileScreen";

function Content({ subscriptions }: { subscriptions?: ReactNode }) {
  const q = useSearchParams();
  return <ProfileScreen from={q.get("from")} fixture={q.get("fixture")} subscriptions={subscriptions} />;
}

export function ProfilePage({ subscriptions }: { subscriptions?: ReactNode }) {
  return (
    <Suspense>
      <Content subscriptions={subscriptions} />
    </Suspense>
  );
}
