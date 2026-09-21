"use client";

/**
 * The shell's header: the app name, the company in play (from the cookie) and the way back to
 * Minty. Part 3 grows the hub's navigation here (login, dashboard, profile, settings);
 * billing-frontend's Header/NavMenu are the model, not the code - skeletal by decision.
 */

import { useSyncExternalStore } from "react";

import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";

// Cookies are not available during server rendering, and a client value that differs from the
// server's is a hydration error. useSyncExternalStore renders the server snapshot ("") while
// hydrating and the cookie's value right after - no effect, no setState-in-effect.
const noSubscribe = () => () => {};
const readEntityName = () => getAuth()?.entityName ?? "";
const serverEntityName = () => "";

export function Header({ title = "Minty" }: { title?: string }) {
  const entityName = useSyncExternalStore(noSubscribe, readEntityName, serverEntityName);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3">
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-semibold">{title}</span>
        {entityName && <span className="text-sm text-muted">{entityName}</span>}
      </div>
      <nav aria-label="Primary">
        <a className="text-sm underline" href={env.MINTY_URL}>
          Back to Minty
        </a>
      </nav>
    </header>
  );
}
