// My Profile's page rules: where it mounts and where its back arrow goes. The plan and what a
// save sends are @minty/shared/profile's (v0.6), tested there.

import { afterEach, describe, expect, it } from "vitest";

import { clearAuth, setAuth } from "@/lib/auth";
import { HUB_PATHS } from "@/lib/hubPaths";

import { PROFILE_BASE_PATH } from "@/features/profile/lib/paths";
import { backHref } from "@/features/profile/lib/profileView";

describe("profileView", () => {
  afterEach(() => clearAuth());

  it("mounts where the shell says it does", () => {
    expect(PROFILE_BASE_PATH).toBe(HUB_PATHS.profile);
  });

  it("the back arrow's new-tab fallback: the list, or the company it was opened from", () => {
    expect(backHref("")).toBe("/entities"); // no company: nothing to go back into
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "e1", "Olive Shop");
    expect(backHref("e1")).toContain(encodeURIComponent("/entity/e1/modules"));
  });
});
