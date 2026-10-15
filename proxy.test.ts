// The addresses that moved: the Module tab's pre-phase-2 ones, and a company's pages from the
// plural `/entities/…` to the singular `/entity/…` (proxy.ts).

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { movedModulePage, proxy } from "@/proxy";

describe("movedModulePage", () => {
  it("moves the short-id address to the company's settings", () => {
    expect(movedModulePage("/subscription/entities/360812e1/olive-and-vine/modules")).toBe(
      "/entity/360812e1/olive-and-vine/settings/modules",
    );
  });

  it("moves the full-id address with a placeholder name the page corrects", () => {
    expect(movedModulePage("/subscription/entities/360812e1-9f94-46a3-aa31-347e21afde8e/modules")).toBe(
      "/entity/360812e1-9f94-46a3-aa31-347e21afde8e/company/settings/modules",
    );
  });

  it("moves a company's plural address to the singular one, path and depth kept", () => {
    expect(movedModulePage("/entities/360812e1/olive-and-vine")).toBe("/entity/360812e1/olive-and-vine");
    expect(movedModulePage("/entities/360812e1/olive-and-vine/settings/users")).toBe(
      "/entity/360812e1/olive-and-vine/settings/users",
    );
  });

  it("leaves every other address alone - the list included", () => {
    for (const path of [
      "/subscription",
      "/subscription/subscriptions",
      "/entities",
      "/entities/",
      "/entity/360812e1/olive-and-vine/settings/modules",
      "/subscription/entities/a/b/c/modules",
    ]) {
      expect(movedModulePage(path)).toBeNull();
    }
  });
});

describe("proxy without a token", () => {
  it("redirects to Flask's re-handoff, naming the origin it was asked on", () => {
    const res = proxy(new NextRequest("http://localhost:3000/subscription?tab=1"));
    expect(res.status).toBe(307);
    const target = new URL(res.headers.get("location") ?? "");
    expect(target.pathname).toBe("/handoff/minty-web");
    expect(target.searchParams.get("next")).toBe("/subscription?tab=1");
    expect(target.searchParams.get("return_origin")).toBe("http://localhost:3000");
  });

  // On a preview-set host the trip must START on this page, or the browser calls it cross-site
  // (a link from GitHub or an email) and Flask - which names a set only on a same-site
  // navigation - hands back to the configured hub instead of the set (2026-10-13).
  it("on a preview-set host, forwards from a page of its own instead of a redirect", async () => {
    const res = proxy(new NextRequest("https://pr-feat-x-my.dailyminty.com/subscription?tab=1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const html = await res.text();
    const target = new URL(/url=([^"]+)"/.exec(html)![1].replaceAll("&amp;", "&"));
    expect(target.pathname).toBe("/handoff/minty-web");
    expect(target.searchParams.get("next")).toBe("/subscription?tab=1");
    expect(target.searchParams.get("return_origin")).toBe("https://pr-feat-x-my.dailyminty.com");
    expect(html).not.toMatch(/url=[^"]*&(?!amp;)/); // every & escaped in the attribute
  });
});
