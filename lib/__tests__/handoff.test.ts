// This app's own wrapper around the shared `next` rule: `safeNext` (lib/handoff.ts) falls back to
// the HUB's home, which is minty-web's answer and not the package's. The rule itself - which
// spellings are refused, and why `/\evil.com` was an open redirect - is tested in @minty/shared
// (src/lib/__tests__/safeNext.test.ts), where the one implementation now lives.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { withReturnOrigin } from "@minty/shared/previewSibling";

import { getAuth, setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import {
  _resetHandoffForTests,
  handoffUrl,
  leaveTo,
  logOut,
  redirectToHandoff,
  safeNext,
} from "@/lib/handoff";
import { HUB_HOME } from "@/lib/hubPaths";

describe("handoff's safeNext", () => {
  it("keeps a same-origin path", () => {
    expect(safeNext("/subscription/invoices")).toBe("/subscription/invoices");
  });

  it("falls back to the hub home, not to a bare slash", () => {
    expect(safeNext("//evil.com")).toBe(HUB_HOME);
    expect(safeNext("https://evil.com")).toBe(HUB_HOME);
    expect(safeNext(null)).toBe(HUB_HOME);
  });
});

// Preview sets (Minty blueprints/shared/preview_origin.py): every trip to Flask names the origin
// it came from, so Flask can hand back into a branch preview. Flask ignores it unless its
// PREVIEW_ORIGIN_REGEX allows it, and a normal host's origin leaves any set Flask remembered.
describe("handoffUrl", () => {
  it("names the page's own origin as the way back", () => {
    const target = new URL(handoffUrl("/subscription", "e1"));
    expect(target.searchParams.get("return_origin")).toBe(window.location.origin);
    expect(target.searchParams.get("next")).toBe("/subscription");
    expect(target.searchParams.get("entity_id")).toBe("e1");
  });

  it("takes the origin it is given - the proxy runs on the server", () => {
    const target = new URL(handoffUrl("/subscription", undefined, "https://pr-feat-x-my.dailyminty.com"));
    expect(target.searchParams.get("return_origin")).toBe("https://pr-feat-x-my.dailyminty.com");
  });
});

describe("withReturnOrigin", () => {
  it("adds the origin to a Flask address, keeping what it had", () => {
    const target = new URL(withReturnOrigin(`${env.PETTY_CASH_URL}/auth/email/handoff?t=abc`));
    expect(target.searchParams.get("t")).toBe("abc");
    expect(target.searchParams.get("return_origin")).toBe(window.location.origin);
  });
});

describe("handoff's exact spelling", () => {
  // lib/handoff.ts is this app's createHandoff instance (the shared-code refactor, 2026-10-21)
  it("orders next, entity_id, return_origin; an unsafe next becomes the hub home", () => {
    expect(handoffUrl("/subscription?a=1", "e1", "https://x.test")).toBe(
      `${env.PETTY_CASH_URL}/handoff/minty-web?next=%2Fsubscription%3Fa%3D1&entity_id=e1&return_origin=https%3A%2F%2Fx.test`,
    );
    expect(handoffUrl("//evil.com", undefined, "https://x.test")).toBe(
      `${env.PETTY_CASH_URL}/handoff/minty-web?next=%2Fentities&return_origin=https%3A%2F%2Fx.test`,
    );
  });

  it("an empty entity id names no company", () => {
    expect(new URL(handoffUrl("/x", "")).searchParams.has("entity_id")).toBe(false);
  });

  it("safeNext takes the caller's own fallback", () => {
    expect(safeNext("https://evil.com", "/profile")).toBe("/profile");
    expect(safeNext(undefined, "/profile")).toBe("/profile");
    expect(safeNext("", "/profile")).toBe("/profile");
  });

  it("withReturnOrigin REPLACES a return_origin already there, and re-serialises the URL", () => {
    expect(withReturnOrigin("https://flask.test/a?return_origin=old&b=1", "https://new.test")).toBe(
      "https://flask.test/a?return_origin=https%3A%2F%2Fnew.test&b=1",
    );
    // A bare origin comes back with the slash URL adds.
    expect(withReturnOrigin("https://flask.test", "https://o.test")).toBe(
      "https://flask.test/?return_origin=https%3A%2F%2Fo.test",
    );
  });
});

describe("redirectToHandoff and leaveTo", () => {
  const navigate = vi.fn<(url: string) => void>();

  beforeEach(() => {
    _resetHandoffForTests(navigate);
    window.history.replaceState({}, "", "/subscription/billing?page=2");
  });
  afterEach(() => _resetHandoffForTests());

  it("goes once, clearing the cookie first; later calls do nothing until reset", () => {
    setAuth("t1", "e1", "Co");
    redirectToHandoff();
    expect(getAuth()).toBeNull();
    setAuth("t2", "e2", "Co 2");
    redirectToHandoff("/profile", "e2");
    expect(getAuth()?.token).toBe("t2"); // the second call did not even clear
    expect(navigate).toHaveBeenCalledTimes(1);
    const target = new URL(navigate.mock.calls[0][0]);
    expect(target.searchParams.get("next")).toBe("/subscription/billing?page=2");
    expect(target.searchParams.has("entity_id")).toBe(false);
    expect(target.searchParams.get("return_origin")).toBe(window.location.origin);
  });

  it("takes an explicit next and company", () => {
    redirectToHandoff("/profile", "e2");
    const target = new URL(navigate.mock.calls[0][0]);
    expect(target.searchParams.get("next")).toBe("/profile");
    expect(target.searchParams.get("entity_id")).toBe("e2");
  });

  it("leaveTo navigates every time, the URL untouched, and leaves the cookie alone", () => {
    setAuth("t1", "e1", "Co");
    redirectToHandoff();
    leaveTo("https://checkout.example/x?y=1");
    leaveTo("https://checkout.example/z");
    expect(navigate.mock.calls.map(([u]) => u).slice(1)).toEqual([
      "https://checkout.example/x?y=1",
      "https://checkout.example/z",
    ]);
  });
});

describe("logOut", () => {
  // lib/handoff.ts's logOut over @minty/shared's logoutUrl (it was lib/logout.ts)
  const navigate = vi.fn<(url: string) => void>();
  beforeEach(() => _resetHandoffForTests(navigate));
  afterEach(() => _resetHandoffForTests());

  it("clears the cookie and leaves for Flask's /logout - no return_origin, no next", () => {
    setAuth("t1", "e1", "Co");
    logOut();
    expect(getAuth()).toBeNull();
    expect(navigate.mock.calls).toEqual([[`${env.PETTY_CASH_URL}/logout`]]);
  });

  it("is not the once-only redirect: a second log out goes again", () => {
    logOut();
    logOut();
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
