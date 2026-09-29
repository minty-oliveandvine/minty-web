/**
 * My Profile per state - Figma 10-A (opened inside a company with Payment Request), 10-B's
 * header (a SuperMinty company) and the profile opened from the entity list (no company).
 * Shared by Vitest, Playwright's `page.route` stubs and the dev-only `?fixture=` switch.
 */

import type { Profile } from "@/features/profile/api/profile";

const USER = {
  id: "u-john",
  first_name: "John",
  last_name: "Birmingha",
  name: "John Birmingha",
  initials: "JB",
  email: "john.doe@oliveandvinehk.com",
};

export const SCOPED: Profile = {
  user: USER,
  entity: {
    id: "e-company-a",
    name: "Company A Limited",
    role: "shop_manager",
    role_label: "Shop Manager",
    modules: ["PAYMENT_REQUEST"],
  },
};

export const SUPERMINTY: Profile = {
  user: USER,
  entity: { ...SCOPED.entity!, modules: ["PAYMENT_REQUEST", "PETTY_CASH"] },
};

export const UNSCOPED: Profile = { user: USER, entity: null };

export const FIXTURES = { SCOPED, SUPERMINTY, UNSCOPED } as const;
export type ProfileFixture = keyof typeof FIXTURES;

export function isProfileFixture(name: string | null | undefined): name is ProfileFixture {
  return name === "SCOPED" || name === "SUPERMINTY" || name === "UNSCOPED";
}
