// The page header on a phone (the owner, 2026-10-26): at 360px the title stays whole and the
// company name gives way with "…". jsdom lays nothing out, so this pins the classes that do it.

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/entity/abcd/acme/settings" }));

import { AppHeader } from "@/components/ui/AppHeader";
import { SidebarProvider } from "@/components/ui/Sidebar";
import { setAuth } from "@/lib/auth";
import { _setViewerLoaderForTests } from "@/lib/viewer";

const LONG = "Olive & Vine Trading Company Limited";

const classes = (el: Element | null) => (el?.getAttribute("class") ?? "").split(/\s+/);

describe("the page header", () => {
  beforeEach(() => {
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    _setViewerLoaderForTests(() => Promise.resolve({ name: "Olive Vine", initials: "OV" }));
  });

  it("keeps the title whole and shortens a long company name", () => {
    render(
      <SidebarProvider profile={null}>
        <AppHeader
          title="Settings"
          back={{ href: "/entities", label: "Back" }}
          companyName={LONG}
        />
      </SidebarProvider>,
    );
    const title = screen.getByRole("heading", { level: 1, name: "Settings" });
    expect(classes(title)).toEqual(expect.arrayContaining(["shrink-0", "whitespace-nowrap"]));
    expect(classes(title)).not.toContain("truncate");

    const company = screen.getByText(LONG);
    expect(classes(company)).toEqual(expect.arrayContaining(["min-w-0", "truncate"]));
    // the group holding the company gives way; the side holding the title does not
    expect(classes(company.parentElement)).not.toContain("shrink-0");
    expect(classes(company.parentElement)).toContain("min-w-0");
    const titleSide = title.parentElement!.parentElement;
    expect(classes(titleSide)).toContain("shrink-0");
    expect(classes(titleSide)).not.toContain("min-w-0");
  });
});
