"use client";

// The sidebar lives in @minty/shared (Part 3 step 4, 2026-10-12). This file stays for two
// reasons: the side-effect import below registers THIS app's host before anything renders, and
// keeping the path means no page, feature or test had to change. What differs per app is
// components/ui/sidebarHost.ts - that file, and nothing else.

import "@/components/ui/sidebarHost";

export { SideMenu, type MenuContext, type SideMenuProps } from "@minty/shared/sidebar";
