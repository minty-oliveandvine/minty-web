// /landing (app/landing/page.tsx): where Flask sends a fresh token. With one it is stored and the
// page moves on to a SAFE `next`; with none the browser goes back to Flask's re-handoff for it.

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Landing from "@/app/landing/page";
import { getAuth, setAuth } from "@/lib/auth";
import { _resetHandoffForTests } from "@/lib/handoff";

const nav = vi.hoisted(() => ({
  replace: vi.fn<(href: string) => void>(),
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  useSearchParams: () => nav.params,
}));

const navigate = vi.fn<(url: string) => void>();

function land(query: string) {
  nav.params = new URLSearchParams(query);
  render(<Landing />);
}

describe("the landing", () => {
  // useLandingHandoff from @minty/shared/landing, with this app's cookie, home and re-handoff (the shared-code refactor, 2026-10-21)
  beforeEach(() => _resetHandoffForTests(navigate));
  afterEach(() => _resetHandoffForTests());

  it("stores the token with its company and replaces the page with next", () => {
    land("token=t1&entity_id=e1&entity_name=Olive%20%26%20Vine&next=%2Fsubscription%3Fa%3D1");
    expect(getAuth()).toEqual({ token: "t1", entityId: "e1", entityName: "Olive & Vine" });
    expect(nav.replace).toHaveBeenCalledWith("/subscription?a=1");
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");
  });

  it("an unsafe or missing next goes to the hub home, the entity list", () => {
    land("token=t1&next=https%3A%2F%2Fevil.com");
    expect(nav.replace).toHaveBeenLastCalledWith("/entities");
    land("token=t1");
    expect(nav.replace).toHaveBeenLastCalledWith("/entities");
  });

  it("a token with no company stores empty company cookies (replacing the old ones)", () => {
    setAuth("old", "e-old", "Old Co");
    land("token=t2");
    expect(getAuth()).toEqual({ token: "t2", entityId: "", entityName: "" });
  });

  it("no token: back to Flask's re-handoff for the safe next and the company, storing nothing", () => {
    land("entity_id=e1&next=%2Fprofile");
    expect(getAuth()).toBeNull();
    expect(nav.replace).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledTimes(1);
    const target = new URL(navigate.mock.calls[0][0]);
    expect(target.pathname).toBe("/handoff/minty-web");
    expect(target.searchParams.get("next")).toBe("/profile");
    expect(target.searchParams.get("entity_id")).toBe("e1");
  });

  it("no token and no company: the re-handoff names none, and next is the hub home", () => {
    land("next=%2F%2Fevil.com");
    const target = new URL(navigate.mock.calls[0][0]);
    expect(target.searchParams.get("next")).toBe("/entities");
    expect(target.searchParams.has("entity_id")).toBe(false);
  });

  it("an empty token counts as none", () => {
    land("token=&next=%2Fprofile");
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
