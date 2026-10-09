/**
 * The sign-in screens' frame: the bar with the Minty mark (as the hub's other pages draw it - no
 * initials and no menu, there is nobody signed in yet) over one narrow column. The look is the
 * sign-in page Flask and minty-onboarding-web drew until phase 2.
 */

import Image from "next/image";
import type { ReactNode } from "react";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-card pt-[env(safe-area-inset-top,0px)]">
        <div className="mx-auto flex h-16 w-full max-w-[1920px] items-center gap-2 px-4 sm:h-18 sm:px-6">
          <Image
            src="/minty-mark.png"
            alt=""
            width={40}
            height={40}
            priority
            unoptimized
            className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
          />
          <span className="text-lg font-semibold text-ink">Minty</span>
        </div>
      </header>
      <main className="flex flex-1 justify-center px-4 pb-12 pt-6">
        <div className="flex w-full min-w-0 max-w-[380px] flex-col gap-6 pt-6">{children}</div>
      </main>
    </div>
  );
}

export function AuthHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <div>
      <h1 className="text-[26px] font-bold leading-tight text-ink">{title}</h1>
      <p className="mt-1.5 text-body-l text-ink-2">{lead}</p>
    </div>
  );
}

/** The form's classes, one set for both screens. */
export const AUTH_LABEL = "mb-1.5 block text-sm font-semibold text-ink";
export const AUTH_INPUT =
  "block h-12 w-full rounded-xl border border-line-input bg-card px-4 text-body-m text-ink placeholder:text-ink-muted focus:border-line-selected focus:outline-none focus:ring-2 focus:ring-line-selected/25 read-only:bg-sunk";
export const AUTH_PRIMARY =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-action px-5 text-body-m font-semibold text-white transition-colors hover:bg-action-hover active:bg-action-pressed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mv2-border-focus)] disabled:cursor-not-allowed disabled:bg-action-disabled disabled:text-ink-disabled";
export const AUTH_GHOST =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-card px-5 text-body-m font-semibold text-ink transition-colors hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mv2-border-focus)]";
export const AUTH_LINK = "font-semibold text-link underline underline-offset-2";
export const AUTH_ERROR = "text-center text-body-s text-danger";
