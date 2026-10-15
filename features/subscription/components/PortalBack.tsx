"use client";

/**
 * The portal's way back - "Back to the entity dashboard" (08-A), "Back to the previous page"
 * (04-A, 08-B) - lives in the header bar (the user, 2026-09-29: no more "‹ Entity List"), lined
 * up with the teal banner's left edge. The header belongs to the layout and the line to the
 * page, so the layout owns an empty slot in the header and each page portals its line into it.
 * A page with no line of its own leaves the slot empty: every such page has its own way out in
 * its body (Go Back, Cancel, Back to Manage Subscriptions).
 *
 * Rendered outside `PortalBackProvider` (a screen's own tests), the line stays where it is.
 */

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Slot = { el: HTMLElement | null; setEl: (el: HTMLElement | null) => void };

const SlotContext = createContext<Slot | null>(null);

export function PortalBackProvider({ children }: { children: ReactNode }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  return <SlotContext.Provider value={{ el, setEl }}>{children}</SlotContext.Provider>;
}

/**
 * The header's slot. The row it sits in is a size container (`AppHeader`'s `lead`), so `cqw` is
 * that row's content box. `SubscriptionLayout` pads its column as the header row is padded
 * (px-4 / sm:px-6 / lg:px-8) and each page centres its content at its own width
 * (`data-portal-col`, read into `--portal-col` by globals.css), so the content's left edge is
 * half of what the row has beyond that width. Keep the paddings in step.
 */
export function PortalBackSlot() {
  const slot = useContext(SlotContext);
  return (
    <div
      ref={slot?.setEl}
      className="flex min-w-0 items-center pl-[max(0px,calc(50cqw-var(--portal-col)/2))]"
    />
  );
}

export const BACK_LINE_CLASS = "min-w-0 truncate text-base text-ink-2 hover:underline";

export function PortalBack({ children }: { children: ReactNode }) {
  const slot = useContext(SlotContext);
  if (!slot) return <div className="self-start">{children}</div>;
  // Null only for the first commit: the slot's ref lands in that same commit and re-renders us.
  return slot.el ? createPortal(children, slot.el) : null;
}
