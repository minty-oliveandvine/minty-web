// The addresses that moved: the Module tab's pre-phase-2 ones, and a company's pages from the
// plural `/entities/…` to the singular `/entity/…` (proxy.ts).

import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { toFlask } from "@minty/shared/proxy";

import { movedModulePage, movedSignUpPage, proxy } from "@/proxy";

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

describe("movedSignUpPage", () => {
  // Pins the old sign-up address rule before it moves to @minty/shared (the shared-code refactor, 2026-10-21)
  const moved = (href: string) => movedSignUpPage(new URL(href, "http://localhost:3000"));

  it("moves /login?mode=signup to /signup, keeping every other param and dropping mode", () => {
    expect(moved("/login?mode=signup")).toBe("/signup");
    expect(moved("/login?mode=signup&email=a%40b.test&x=1")).toBe("/signup?email=a%40b.test&x=1");
  });

  it("leaves an invitation, another mode and other pages alone", () => {
    expect(moved("/login?mode=signup&invite=abc")).toBeNull();
    expect(moved("/login?mode=SIGNUP")).toBeNull();
    expect(moved("/login")).toBeNull();
    expect(moved("/login/?mode=signup")).toBeNull();
    expect(moved("/signup?mode=signup")).toBeNull();
  });

  it("an EMPTY invite does not count as one", () => {
    expect(moved("/login?mode=signup&invite=")).toBe("/signup?invite=");
  });
});

describe("proxy's other answers", () => {
  // Pins proxy()'s redirects and pass-throughs before they move to @minty/shared (the shared-code refactor, 2026-10-21)
  it("307s a moved address, keeping its query", () => {
    const res = proxy(new NextRequest("http://localhost:3000/entities/360812e1/co/settings/users?tab=2"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/entity/360812e1/co/settings/users?tab=2");
  });

  it("307s the old sign-up address", () => {
    const res = proxy(new NextRequest("http://localhost:3000/login?mode=signup&email=a"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/signup?email=a");
  });

  it("lets an open page through without a cookie, and any page with one", () => {
    expect(proxy(new NextRequest("http://localhost:3000/terms/beta-1")).headers.get("x-middleware-next")).toBe("1");
    const withCookie = new NextRequest("http://localhost:3000/subscription", {
      headers: { cookie: "minty_token=anything" },
    });
    expect(proxy(withCookie).headers.get("x-middleware-next")).toBe("1");
  });

  it("an EMPTY cookie is no cookie", () => {
    const req = new NextRequest("http://localhost:3000/subscription", { headers: { cookie: "minty_token=" } });
    expect(proxy(req).status).toBe(307);
  });
});

describe("toFlask", () => {
  // proxy.ts's toFlask is @minty/shared/proxy's (the shared-code refactor, 2026-10-21)
  const FLASK = 'https://flask.test/handoff?a=1&b="2"<3>';

  it("a normal host gets a plain 307 to the URL", () => {
    const res = toFlask(new NextRequest("https://my.dailyminty.com/x"), "https://flask.test/h?a=1&b=2");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://flask.test/h?a=1&b=2");
  });

  it("a preview-set host gets this exact page, escaping &, \", < and >", async () => {
    // owner 2026-10-21: one shared module (@minty/shared/proxy) - ">" was left as it stood
    const res = toFlask(new NextRequest("https://pr-feat-x-my.dailyminty.com/x"), FLASK);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe(
      '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" ' +
        'content="0;url=https://flask.test/handoff?a=1&amp;b=&quot;2&quot;&lt;3&gt;"><title>Minty</title>',
    );
  });
});
