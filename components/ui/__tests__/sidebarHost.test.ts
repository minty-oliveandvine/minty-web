// This app's host for the packaged sidebar (components/ui/sidebarHost.ts): who is looking (a
// DECORATION read of Flask's profile), which page is showing, and where each menu entry goes.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { billsHref, sidebarHost } from "@/components/ui/sidebarHost";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";
import { pettyCashWebUrl } from "@/lib/mintyEntry";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const ID = "360812e1-9f94-46a3-aa31-347e21afde8e";
const fetchMock = vi.fn<typeof fetch>();
const navigate = vi.fn<(url: string) => void>();

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("sidebarHost.loadViewer", () => {
  // loadViewer from @minty/shared/portal over this app's decoration client (the shared-code refactor, 2026-10-21)
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    _resetHandoffForTests(navigate);
    setAuth(TOKEN, ID, "Olive & Vine");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    _resetHandoffForTests();
  });

  it("reads Flask's profile with no ?entity= and answers only the name and initials", async () => {
    fetchMock.mockResolvedValueOnce(
      answer(200, { user: { name: "Olive Vine", initials: "OV", email: "o@v.test" }, company: {} }),
    );
    expect(await sidebarHost.loadViewer()).toEqual({ name: "Olive Vine", initials: "OV" });
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${env.PETTY_CASH_URL}/api/me/profile`);
  });

  it("is null when either is not a string, or there is no user", async () => {
    for (const body of [
      { user: { name: "Olive", initials: null } },
      { user: { name: 1, initials: "OV" } },
      { user: null },
      {},
      null,
    ]) {
      fetchMock.mockResolvedValueOnce(answer(200, body));
      expect(await sidebarHost.loadViewer()).toBeNull();
    }
  });

  it("empty strings still count as a viewer", async () => {
    fetchMock.mockResolvedValueOnce(answer(200, { user: { name: "", initials: "" } }));
    expect(await sidebarHost.loadViewer()).toEqual({ name: "", initials: "" });
  });

  it("a 401 only rejects - no re-handoff, the cookie kept", async () => {
    fetchMock.mockResolvedValueOnce(answer(401, {}));
    await expect(sidebarHost.loadViewer()).rejects.toMatchObject({ status: 401 });
    expect(navigate).not.toHaveBeenCalled();
    expect(sidebarHost.currentToken()).toBe(TOKEN);
  });

  it("any other failure rejects with Flask's sentence", async () => {
    fetchMock.mockResolvedValueOnce(answer(500, { error: "Down for a moment." }));
    await expect(sidebarHost.loadViewer()).rejects.toMatchObject({
      status: 500,
      message: "Down for a moment.",
    });
  });
});

describe("sidebarHost's reads of the cookie and the page", () => {
  it('names the app and reads the company and token from the cookie, "" with none', () => {
    expect(sidebarHost.app).toBe("minty-web");
    expect(sidebarHost.entityId()).toBe("");
    expect(sidebarHost.entityName()).toBe("");
    expect(sidebarHost.currentToken()).toBe("");
    setAuth(TOKEN, ID, "Olive & Vine");
    expect(sidebarHost.entityId()).toBe(ID);
    expect(sidebarHost.entityName()).toBe("Olive & Vine");
    expect(sidebarHost.currentToken()).toBe(TOKEN);
  });

  it("currentOf knows the hub's four pages and nothing else", () => {
    expect(sidebarHost.currentOf("/profile")).toBe("profile");
    expect(sidebarHost.currentOf("/profile/")).toBeNull();
    expect(sidebarHost.currentOf("/entities")).toBe("entities");
    expect(sidebarHost.currentOf("/entity/360812e1/co/settings/users")).toBe("settings");
    expect(sidebarHost.currentOf("/entity/360812e1/co")).toBeNull();
    expect(sidebarHost.currentOf("/subscription")).toBe("subscriptions");
    expect(sidebarHost.currentOf("/subscription/billing")).toBe("subscriptions");
    expect(sidebarHost.currentOf("/subscriptions")).toBeNull();
    expect(sidebarHost.currentOf("/")).toBeNull();
  });

  it("links: the hub's own pages, and Petty Cash through Flask for the cookie's company", () => {
    setAuth(TOKEN, ID, "Olive & Vine");
    const { links } = sidebarHost;
    expect(links.entities()).toBe("/entities");
    expect(links.subscriptions()).toBe("/subscription");
    expect(links.profile()).toBe("/profile");
    expect(links.settings()).toBe("/entity/360812e1/olive-and-vine/settings/modules");
    expect(links.pettyCashDashboard()).toBe(pettyCashWebUrl(ID));
    // reports name the GIVEN company's id, but the cookie's company NAME in the path
    expect(links.pettyCashReports("abcdef12-0000")).toBe(
      pettyCashWebUrl("abcdef12-0000", "/entity/abcdef12/olive-and-vine/petty-cash/reports"),
    );
  });

  it("with no cookie, settings is built around an empty id and the placeholder name", () => {
    expect(sidebarHost.links.settings()).toBe("/entity//company/settings/modules");
    expect(sidebarHost.links.pettyCashDashboard()).toBe("/entities");
    expect(billsHref("my.dailyminty.com")).toBe("/entities");
  });

  it("lockScroll (@minty/shared/scrollLock) hides the body's overflow and puts back what was there", () => {
    document.body.style.overflow = "scroll";
    const release = sidebarHost.lockScroll();
    expect(document.body.style.overflow).toBe("hidden");
    release();
    expect(document.body.style.overflow).toBe("scroll");
    document.body.style.overflow = "";
  });
});
