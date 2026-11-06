// This app's own wrapper around the shared `next` rule: `safeNext` (lib/handoff.ts) falls back to
// the HUB's home, which is minty-web's answer and not the package's. The rule itself - which
// spellings are refused, and why `/\evil.com` was an open redirect - is tested in @minty/shared
// (src/lib/__tests__/safeNext.test.ts), where the one implementation now lives.

import { describe, expect, it, vi } from "vitest";

import { env } from "@/lib/env";
import { handoffUrl, postNavigate, safeNext, withReturnOrigin } from "@/lib/handoff";
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
    const target = new URL(
      handoffUrl("/subscription", undefined, "https://pr-feat-x-my.dailyminty.com"),
    );
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

// Minty's /logout takes a POST only (a GET answers 405), from a front end's Origin: a top-level
// form POST, never fetch and never location.
describe("postNavigate", () => {
  it("submits a hidden, empty POST form to the address, with a referrer policy that keeps Origin", () => {
    const submitted: HTMLFormElement[] = [];
    vi.spyOn(HTMLFormElement.prototype, "submit").mockImplementation(function (
      this: HTMLFormElement,
    ) {
      submitted.push(this);
    });

    postNavigate(`${env.PETTY_CASH_URL}/logout`);

    expect(submitted).toHaveLength(1);
    const [form] = submitted;
    expect(form.getAttribute("method")).toBe("POST");
    expect(form.getAttribute("action")).toBe(`${env.PETTY_CASH_URL}/logout`);
    expect(form.hidden).toBe(true);
    expect(form.elements).toHaveLength(0);
    expect(form.isConnected).toBe(true);
    const meta = document.head.querySelector('meta[name="referrer"]');
    expect(meta?.getAttribute("content")).toBe("strict-origin");
  });
});
