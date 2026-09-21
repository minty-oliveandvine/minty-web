"use client";

/**
 * The ⋮ on a list row (Figma 04·M): a small white popover with only the items that apply -
 * Request transfer always; Cancel subscription when a module is active; Reactivate when one is
 * not. Closes on an outside press or Escape. billing-frontend's SubscriptionRowMenu is the
 * behaviour reference (outside-click, Escape, drop-up near the bottom of the window).
 */

import { useEffect, useId, useRef, useState } from "react";

import type { MenuItem } from "@/features/subscription/lib/portalRows";

const LABEL: Record<MenuItem, string> = {
  request_transfer: "Request transfer",
  cancel_subscription: "Cancel subscription",
  reactivate: "Reactivate",
};

export function RowMenu({
  entityName,
  items,
  onSelect,
}: {
  entityName: string;
  items: MenuItem[];
  onSelect: (item: MenuItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPress = (e: MouseEvent | TouchEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPress);
    document.addEventListener("touchstart", onPress);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPress);
      document.removeEventListener("touchstart", onPress);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    const rect = button.current?.getBoundingClientRect();
    setDropUp(Boolean(rect) && window.innerHeight - (rect?.bottom ?? 0) < 160);
    setOpen((o) => !o);
  };

  return (
    <div ref={root} className="relative flex shrink-0 items-center">
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Actions for ${entityName}`}
        className="flex h-10 w-8 items-center justify-center rounded-md text-[26px] font-bold leading-none text-[#8c949e] hover:bg-gray-100"
      >
        ⋮
      </button>
      {open && (
        <ul
          id={menuId}
          role="menu"
          className={`absolute right-0 z-30 w-[201px] rounded-[14px] bg-white py-2 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)] ${
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {items.map((item) => (
            <li key={item} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSelect(item);
                }}
                className="block w-full px-[22px] py-[7px] text-left text-[15px] text-ink hover:bg-gray-50"
              >
                {LABEL[item]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
