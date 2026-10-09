/**
 * My Profile's frame and its fixed pieces (Figma 10-A, 1410:3314): the page's titlebar (‹, "My
 * Profile", the side menu - no initials badge: this page IS the person), the sidebar panel's
 * titlebar (‹ back to the menu, "My Profile", close), the head (the company it was opened from
 * and its plan, the avatar, the name, the role), Log Out, and the loading and failed states.
 */

import Image from "next/image";

import { BackLink } from "@/components/ui/BackLink";
import { NavMenu } from "@/components/ui/NavMenu";
import { logOut } from "@/lib/logout";

import type { Profile } from "@/features/profile/api/profile";
import { LOG_OUT, PAGE_TITLE, planLabel } from "@/features/profile/lib/profileView";

export function ProfileTitlebar({ back }: { back: string }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between bg-canvas px-4 py-1.5 sm:h-15 sm:px-6 lg:px-8">
      <BackLink
        href={back}
        ariaLabel="Back"
        className="flex size-11 items-center justify-center rounded-xl hover:bg-hover"
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

/**
 * The sidebar's My Profile titlebar: ‹ goes back to the menu - the panel is the sidebar's
 * second view, not a page - and the close is the way out on a phone, where the panel fills the
 * screen. Heading level 2: the page underneath owns the level 1.
 */
export function ProfilePanelTitlebar({
  onBack,
  onClose,
}: {
  onBack?: () => void;
  onClose?: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between bg-canvas px-4 py-1.5">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to the menu"
        className="flex size-11 cursor-pointer items-center justify-center rounded-xl hover:bg-hover"
      >
        <Image
          className="-scale-x-100"
          src="/profile/back.svg"
          alt=""
          width={24}
          height={24}
          unoptimized
        />
      </button>
      <h2 className="p-2.5 text-center text-base font-semibold whitespace-nowrap text-ink-2">
        {PAGE_TITLE}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close My Profile"
        className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-ink-2 hover:bg-hover"
      >
        <span className="material-symbols-rounded text-[24px] leading-none" aria-hidden>
          close
        </span>
      </button>
    </header>
  );
}

export function ProfileHero({ profile }: { profile: Profile }) {
  const company = profile.entity;
  const plan = planLabel(company);
  return (
    <section className="flex flex-col items-center text-center" aria-label="Who you are">
      {company ? (
        // The caped cat hangs 74 px off the name's right (10-B), so beside it the name keeps 74 px
        // clear on BOTH sides - still centred, and wrapping before the cat can reach past the
        // edge (a long company name put a sideways scrollbar under the sidebar's profile).
        <div
          className={`relative mt-5 flex flex-col items-center ${plan?.cat ? "max-w-[calc(100%-148px)]" : "max-w-full"}`}
        >
          <p className="text-sm leading-5 text-ink-2">{company.name}</p>
          {plan ? <p className={`mt-2.5 text-label leading-3 ${plan.tone}`}>{plan.text}</p> : null}
          {plan?.cat ? (
            <Image
              className="absolute -right-[74px] -top-[16px] h-[56px] w-[60px] object-contain"
              src="/profile/super-minty.png"
              alt=""
              width={240}
              height={240}
              unoptimized
            />
          ) : null}
        </div>
      ) : null}
      <span
        className={`${company ? "mt-6" : "mt-10"} flex h-[75px] w-[74px] items-center justify-center rounded-full bg-[var(--avatar-bg)] text-display-l font-medium text-[var(--avatar-fg)]`}
        aria-hidden
      >
        {profile.user.initials}
      </span>
      <h2 className="mt-4 text-display-l font-bold text-ink">
        {profile.user.name}
      </h2>
      {company?.role_label ? (
        <p className="mt-2 inline-flex h-6 items-center rounded-full bg-neutral-bg px-2.5 text-label font-semibold text-neutral">
          {company.role_label}
        </p>
      ) : null}
    </section>
  );
}

export function LogOutButton() {
  return (
    <button
      type="button"
      onClick={logOut}
      className="mx-auto mt-18 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-body-m font-semibold text-link hover:bg-hover"
    >
      <Image src="/profile/logout.svg" alt="" width={13} height={13} unoptimized aria-hidden />
      {LOG_OUT}
    </button>
  );
}

export function ProfileLoading() {
  return (
    <div
      className="mt-10 flex flex-col items-center gap-4"
      role="status"
      aria-label="Loading your profile"
    >
      <span className="h-[75px] w-[74px] animate-pulse rounded-full bg-neutral-bg" />
      <span className="h-8 w-56 animate-pulse rounded-lg bg-neutral-bg" />
      <span className="mt-6 h-[184px] w-full animate-pulse rounded-xl border border-line bg-sunk" />
    </div>
  );
}

export function ProfileError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 text-center" role="alert">
      <p className="text-sm text-ink-2">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="h-11 cursor-pointer rounded-xl bg-action px-4 text-body-m font-semibold text-white hover:bg-action-hover active:bg-action-pressed"
      >
        Try again
      </button>
    </div>
  );
}
