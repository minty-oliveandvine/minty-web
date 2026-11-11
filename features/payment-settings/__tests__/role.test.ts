// Who may change Payment Settings (lib/role.ts), from the token's claims - minty-payment-request-web's
// lib/useUserRole.ts rules: an allowlist of elevated roles, and the token's is_view_only.

import { afterEach, describe, expect, it } from "vitest";

import { clearAuth, setAuth } from "@/lib/auth";

import { readSettingsRole } from "@/features/payment-settings/lib/role";

function signIn(claims: Record<string, unknown>) {
  const payload = btoa(JSON.stringify({ user_id: "u1", entity_id: "e1", ...claims }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  setAuth(`h.${payload}.s`, "e1", "Olive Shop");
}

afterEach(() => clearAuth());

describe("readSettingsRole", () => {
  it.each(["accountant", "admin", "super_admin", "Super Admin", "super-admin"])(
    "%s may change them",
    (role) => {
      signIn({ role, system_role: "normal", is_view_only: false });
      expect(readSettingsRole()).toEqual({ isElevated: true, isViewOnly: false });
    },
  );

  it.each(["cashier", "shop_manager", "entity_base", ""])("%s may only look", (role) => {
    signIn({ role, system_role: "normal", is_view_only: false });
    expect(readSettingsRole()).toEqual({ isElevated: false, isViewOnly: false });
  });

  it("a view-only visitor may not, whatever the role says", () => {
    signIn({ role: "super_admin", system_role: "superadmin", is_view_only: true });
    expect(readSettingsRole()).toEqual({ isElevated: false, isViewOnly: true });
  });

  it("a system super admin who is a member keeps their role", () => {
    signIn({ role: "admin", system_role: "superadmin", is_view_only: false });
    expect(readSettingsRole()).toEqual({ isElevated: true, isViewOnly: false });
  });

  it.each(["superadmin", "superuser", " SuperAdmin "])(
    "with no claim, a system super admin (%s) is view-only - the most restrictive reading",
    (systemRole) => {
      signIn({ role: "super_admin", system_role: systemRole });
      expect(readSettingsRole()).toEqual({ isElevated: false, isViewOnly: true });
    },
  );

  it("no token, or one that does not decode, may change nothing", () => {
    expect(readSettingsRole()).toEqual({ isElevated: false, isViewOnly: false });
    setAuth("not-a-token", "e1", "Olive Shop");
    expect(readSettingsRole()).toEqual({ isElevated: false, isViewOnly: false });
  });
});
