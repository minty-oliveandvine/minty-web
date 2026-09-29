// My Profile in the sidebar (one sidebar, two views - 2026-09-29): the header's initials open
// it over the page, it reads the profile only then, draws the same body as the /profile page,
// and its titlebar goes back to the menu or closes the sidebar.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/entities" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

import { AppHeader } from "@/components/ui/AppHeader";
import { SidebarProvider } from "@/components/ui/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";
import { _setViewerLoaderForTests } from "@/lib/viewer";

import { UNSCOPED } from "@/features/profile/__fixtures__/profile";
import { ProfilePanel } from "@/features/profile/routes/ProfilePanel";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const fetchMock = vi.fn<typeof fetch>();

function serve(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

function show() {
  render(
    <ToastProvider>
      <SidebarProvider profile={<ProfilePanel subscriptions={<p>The overview card</p>} />}>
        <AppHeader title="Select Company" showLogo />
      </SidebarProvider>
    </ToastProvider>,
  );
}

const panel = () => screen.queryByRole("region", { name: "My Profile" });

describe("ProfilePanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    _resetHandoffForTests(vi.fn());
    setAuth(TOKEN, "", "");
    nav.pathname = "/entities";
    window.history.replaceState({}, "", "/entities");
    _setViewerLoaderForTests(() =>
      Promise.resolve({ name: UNSCOPED.user.name, initials: UNSCOPED.user.initials }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _resetHandoffForTests();
    _setViewerLoaderForTests(null);
  });

  it("opens from the header's initials over the page, and reads the profile only then", async () => {
    show();
    const badge = await screen.findByRole("button", { name: `${UNSCOPED.user.name}, My Profile` });
    expect(fetchMock).not.toHaveBeenCalled();

    serve(UNSCOPED);
    await userEvent.click(badge);
    const view = within(panel()!);
    expect(await view.findByRole("heading", { level: 2, name: UNSCOPED.user.name })).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${env.MINTY_URL}/api/me/profile`);
    // the same body as the page: the details card, the slot, Log Out
    expect(view.getByRole("region", { name: "Your details" })).toBeInTheDocument();
    expect(view.getByText("The overview card")).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Log Out" })).toBeInTheDocument();
    // over the page: nothing navigated
    expect(window.location.pathname).toBe("/entities");
  });

  it("‹ goes back to the menu, and the close shuts the sidebar", async () => {
    show();
    serve(UNSCOPED);
    await userEvent.click(
      await screen.findByRole("button", { name: `${UNSCOPED.user.name}, My Profile` }),
    );
    const back = await within(panel()!).findByRole("button", { name: "Back to the menu" });
    await waitFor(() => expect(back).toHaveFocus());

    await userEvent.click(back);
    expect(panel()).toBeNull();
    const menu = within(screen.getByRole("navigation", { name: "Main navigation" }));

    serve(UNSCOPED);
    await userEvent.click(menu.getByRole("button", { name: `${UNSCOPED.user.name}, My Profile` }));
    await userEvent.click(await within(panel()!).findByRole("button", { name: "Close My Profile" }));
    expect(panel()).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).toBeNull();
  });
});
