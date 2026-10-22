"use client";

/**
 * The shell's header: the app name, the company in play (from the cookie) and the way back to
 * Minty. Part 3 grows the hub's navigation here (login, dashboard, profile, settings);
 * minty-payment-request-web's Header/NavMenu are the model, not the code - skeletal by decision.
 */

import { useClientValue } from "@minty/shared/clientValue";

import { getAuth } from "@/lib/auth";
import { env } from "@/lib/env";

// Cookies are not available during server rendering, and a client value that differs from the
// server's is a hydration error. useClientValue (@minty/shared/clientValue) renders the server
// snapshot ("") while hydrating and the cookie's value right after - no effect, no
// setState-in-effect.
const readEntityName = () => getAuth()?.entityName ?? "";
const serverEntityName = () => "";

export function Header({ title = "Minty" }: { title?: string }) {
  const entityName = useClientValue(readEntityName, serverEntityName);

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-line px-4 sm:px-6 lg:px-8">
      <div className="flex items-baseline gap-3">
        <span className="text-title-l font-semibold text-ink">{title}</span>
        {entityName && <span className="text-body-m text-ink-2">{entityName}</span>}
      </div>
      <nav aria-label="Primary">
        <a
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-body-m text-link underline hover:bg-hover"
          href={env.PETTY_CASH_URL}
        >
          Back to Minty
        </a>
      </nav>
    </header>
  );
}
