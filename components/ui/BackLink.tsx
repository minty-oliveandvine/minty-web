"use client";

import type { MouseEvent, ReactNode } from "react";

import { goBack } from "@/lib/backLink";

/**
 * A real link to `href` (the fallback: what a new tab, a middle-click or no script opens) whose
 * plain click goes back to the page the person came from (lib/backLink.ts).
 */
export function BackLink({
  href,
  className,
  ariaLabel,
  children,
}: {
  href: string;
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    goBack(href);
  };
  return (
    <a href={href} className={className} aria-label={ariaLabel} onClick={onClick} data-back-link>
      {children}
    </a>
  );
}
