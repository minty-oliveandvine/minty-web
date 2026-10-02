// The side menu on every page (Figma 02 / 10-C), as the ≡ draws it WITHOUT a sidebar provider
// around it (a screen on its own): the person first - a link to the /profile page here - then
// Select Entity and Manage subscriptions; the company's sections and Settings only INSIDE a
// company, never on the entity list; the cat above Settings and Logout. The sidebar's two
// views are Sidebar.test.tsx's.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { AppHeader } from "@/components/ui/AppHeader";
import { NavMenu } from "@/components/ui/NavMenu";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _setViewerLoaderForTests } from "@/lib/viewer";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";

async function openMenu() {
  await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
  return within(screen.getByRole("navigation", { name: "Main navigation" }));
}

function at(path: string) {
  window.history.replaceState({}, "", path);
}

describe("NavMenu", () => {
  afterEach(() => _setViewerLoaderForTests(null));

  it("on the entity list: the person, Select Entity (here), Manage subscriptions - and no Settings", async () => {
    setAuth(TOKEN, "", "");
    at("/entities");
    _setViewerLoaderForTests(() => Promise.resolve({ name: "Olive Vine", initials: "OV" }));
    render(<NavMenu />);

    const menu = await openMenu();
    const profile = await menu.findByRole("link", { name: "Olive Vine, My Profile" });
    expect(profile).toHaveAttribute("href", "/profile");
    expect(profile).toHaveTextContent("OV");
    expect(menu.getByRole("link", { name: "Select Entity" })).toHaveAttribute("aria-current", "page");
    expect(menu.getByRole("link", { name: "Manage subscriptions" })).toHaveAttribute(
      "href",
      "/subscription",
    );
    expect(menu.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(menu.queryByRole("group", { name: "Petty Cash" })).toBeNull();
    expect(menu.queryByRole("group", { name: "Payment Request" })).toBeNull();
    expect(menu.getByRole("button", { name: "Logout" })).toBeInTheDocument();
  });

  it("the list never offers a company's items, even with one left in the cookie", async () => {
    setAuth(TOKEN, "e1", "Olive Shop");
    at("/entities");
    render(<NavMenu />);
    const menu = await openMenu();
    expect(menu.queryByRole("link", { name: "Settings" })).toBeNull();
    expect(menu.queryByRole("group", { name: "Petty Cash" })).toBeNull();
  });

  it("inside a company: its sections, and Settings to its own settings page", async () => {
    setAuth(TOKEN, "e1", "Olive Shop");
    at("/subscription");
    render(<NavMenu modules={{ pettyCash: true, billing: true }} />);

    const menu = await openMenu();
    const petty = within(menu.getByRole("group", { name: "Petty Cash" }));
    expect(petty.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      `${env.PETTY_CASH_URL}/entity/e1/enter?token=${encodeURIComponent(TOKEN)}`,
    );
    expect(petty.getByRole("link", { name: "Reports" }).getAttribute("href")).toContain(
      encodeURIComponent("/entity/e1/reports"),
    );
    const payments = within(menu.getByRole("group", { name: "Payment Request" }));
    expect(payments.getByRole("link", { name: "Bills" })).toHaveAttribute(
      "href",
      `${env.PAYMENT_REQUEST_WEB_URL}/`,
    );
    expect(menu.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/subscription/entities/e1/modules",
    );
    expect(menu.getByRole("link", { name: "Manage subscriptions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("the cat sits above Settings and Logout", async () => {
    setAuth(TOKEN, "e1", "Olive Shop");
    at("/subscription/entities/e1/modules");
    render(<NavMenu modules={{ pettyCash: true, billing: false }} />);

    const menu = await openMenu();
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    const cat = nav.querySelector('img[src*="sidepanel_cat"]');
    expect(cat).not.toBeNull();
    for (const below of [menu.getByRole("link", { name: "Settings" }), menu.getByRole("button", { name: "Logout" })]) {
      expect(cat!.compareDocumentPosition(below) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("opens with the keyboard inside it; Escape and the backdrop close it", async () => {
    setAuth(TOKEN, "", "");
    at("/entities");
    render(<NavMenu />);

    const menu = await openMenu();
    await waitFor(() => expect(menu.getByRole("link", { name: "My Profile" })).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).toBeNull(); // hidden again
    expect(screen.getByRole("button", { name: "Open navigation menu" })).toHaveFocus();

    await openMenu();
    await userEvent.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).toBeNull();
  });
});

describe("the header's avatar, without a sidebar around it", () => {
  afterEach(() => _setViewerLoaderForTests(null));

  it("is the way to the /profile page, with the name on hover", async () => {
    setAuth(TOKEN, "", "");
    at("/subscription");
    _setViewerLoaderForTests(() => Promise.resolve({ name: "Olive Vine", initials: "OV" }));
    render(<AppHeader title="Subscriptions" back={{ href: "/entities", label: "Entity List" }} companyName="Subscriptions" />);

    const badge = await screen.findByRole("link", { name: "Olive Vine, My Profile" });
    expect(badge).toHaveTextContent("OV");
    expect(badge).toHaveAttribute("title", "Olive Vine");
    expect(badge).toHaveAttribute("href", "/profile");
  });
});
