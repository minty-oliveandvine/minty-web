// The sidebar - one drawer, two views (the user's call, 2026-09-29): ≡ opens the menu, the
// header's initials open My Profile, the menu's name switches to it and its ‹ goes back;
// Escape, the page beside it and a move to another page close it. Nothing navigates to open
// it. The profile view is the shell's slot, mounted only once asked for.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/entities" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

import { AppHeader } from "@/components/ui/AppHeader";
import { NavMenu } from "@/components/ui/NavMenu";
import { SidebarProvider, useSidebar } from "@/components/ui/Sidebar";
import { setAuth } from "@/lib/auth";
import { _setViewerLoaderForTests } from "@/lib/viewer";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";

let profileMounts = 0;

/** Stands in for the profile feature's panel: its ‹, and a line to find it by. */
function ProfileSlot() {
  const sidebar = useSidebar();
  useEffect(() => {
    profileMounts += 1;
  }, []);
  return (
    <div>
      <button type="button" onClick={sidebar?.showMenu}>
        Back to the menu
      </button>
      <p>Olive&apos;s profile</p>
    </div>
  );
}

function at(path: string) {
  nav.pathname = path;
  window.history.replaceState({}, "", path);
}

function app(page = <AppHeader title="Select Company" showLogo />) {
  return (
    <SidebarProvider profile={<ProfileSlot />}>
      <main>{page}</main>
    </SidebarProvider>
  );
}

const menu = () => screen.queryByRole("navigation", { name: "Main navigation" });
const profile = () => screen.queryByRole("region", { name: "My Profile" });

describe("the sidebar", () => {
  beforeEach(() => {
    profileMounts = 0;
    setAuth(TOKEN, "", "");
    at("/entities");
    _setViewerLoaderForTests(() => Promise.resolve({ name: "Olive Vine", initials: "OV" }));
  });

  afterEach(() => _setViewerLoaderForTests(null));

  it("the header's initials open it on My Profile, over the page - nothing navigates", async () => {
    render(app());
    const badge = await screen.findByRole("button", { name: "Olive Vine, My Profile" });
    expect(badge).toHaveAttribute("title", "Olive Vine");
    expect(badge).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(badge);
    expect(within(profile()!).getByText("Olive's profile")).toBeInTheDocument();
    expect(menu()).toBeNull();
    expect(badge).toHaveAttribute("aria-expanded", "true");
    expect(window.location.pathname).toBe("/entities");
    expect(screen.getByRole("heading", { level: 1, name: "Select Company" })).toBeInTheDocument();
  });

  it("≡ opens the menu; the person's name switches to My Profile, and ‹ goes back", async () => {
    render(app());
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const name = await within(menu()!).findByRole("button", { name: "Olive Vine, My Profile" });
    // the profile is not read before it is asked for
    expect(profileMounts).toBe(0);

    await userEvent.click(name);
    expect(within(profile()!).getByText("Olive's profile")).toBeInTheDocument();
    expect(menu()).toBeNull();
    expect(profileMounts).toBe(1);
    // the keyboard lands on the new view's first control
    await waitFor(() => expect(screen.getByRole("button", { name: "Back to the menu" })).toHaveFocus());

    await userEvent.click(screen.getByRole("button", { name: "Back to the menu" }));
    expect(menu()).not.toBeNull();
    expect(profile()).toBeNull();
  });

  it("on the /profile page the menu's name only closes it - that page IS the profile", async () => {
    at("/profile");
    render(app(<NavMenu />));
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const name = await within(menu()!).findByRole("button", { name: "Olive Vine, My Profile" });
    expect(name).toHaveAttribute("aria-current", "page");

    await userEvent.click(name);
    expect(menu()).toBeNull();
    expect(profile()).toBeNull();
    expect(profileMounts).toBe(0);
  });

  it("Escape and a click beside it close it; the keyboard goes back to whichever opened it", async () => {
    render(app());
    const badge = await screen.findByRole("button", { name: "Olive Vine, My Profile" });
    await userEvent.click(badge);
    await userEvent.keyboard("{Escape}");
    expect(profile()).toBeNull();
    expect(badge).toHaveFocus();

    const sandwich = screen.getByRole("button", { name: "Open navigation menu" });
    await userEvent.click(sandwich);
    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(menu()).toBeNull();
    expect(sandwich).toHaveFocus();
  });

  it("a move to another page closes it", async () => {
    const { rerender } = render(app());
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    expect(menu()).not.toBeNull();

    at("/subscription");
    rerender(app());
    expect(menu()).toBeNull();
  });

  it("the menu carries what the page knows better than the token (fresh modules)", async () => {
    setAuth(TOKEN, "e1", "Olive Shop");
    at("/subscription/entities/e1/modules");
    render(app(<NavMenu modules={{ pettyCash: false, billing: true }} />));
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));

    const drawer = within(menu()!);
    expect(drawer.getByRole("group", { name: "Payment Request" })).toBeInTheDocument();
    expect(drawer.queryByRole("group", { name: "Petty Cash" })).toBeNull();
    expect(drawer.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  });

  it("without a profile slot, the initials and the menu's name are links to the /profile page", async () => {
    render(
      <SidebarProvider>
        <AppHeader title="Select Company" showLogo />
      </SidebarProvider>,
    );
    expect(await screen.findByRole("link", { name: "Olive Vine, My Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    expect(within(menu()!).getByRole("link", { name: "Olive Vine, My Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });
});
