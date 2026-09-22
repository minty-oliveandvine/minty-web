// The card flags -> what the card shows. Every state the Figma page draws, the precedence
// where flags overlap, and the day arithmetic that must not drift across a timezone.

import { describe, expect, it } from "vitest";

import type { ModuleCard } from "@/features/subscription/api/moduleSettings";
import { FIXTURES, TODAY } from "@/features/subscription/__fixtures__/modulePage";
import {
  daysLabel,
  daysUntil,
  moduleState,
  pageLook,
  paymentFailed,
  resolveModuleState,
  sharedCta,
} from "@/features/subscription/lib/moduleState";

const petty = (frame: keyof typeof FIXTURES) => FIXTURES[frame].cards[0];
const payment = (frame: keyof typeof FIXTURES) => FIXTURES[frame].cards[1];

describe("moduleState", () => {
  it("names each frame's cards", () => {
    expect(moduleState(petty("A"))).toBe("trialing");
    expect(moduleState(payment("A"))).toBe("trial_eligible");
    expect(moduleState(payment("C"))).toBe("active");
    expect(moduleState(petty("D"))).toBe("expired");
    expect(moduleState(petty("E"))).toBe("pending_cancel");
    expect(moduleState(petty("F"))).toBe("past_due");
  });

  it("past due wins over a pending cancellation, which wins over the phase", () => {
    const both: ModuleCard = { ...petty("F"), pending_cancel: true };
    expect(moduleState(both)).toBe("past_due");
    const cancelledTrial: ModuleCard = {
      ...petty("A"),
      trial_cancelled: true,
      pending_cancel: true,
    };
    expect(moduleState(cancelledTrial)).toBe("pending_cancel");
  });

  it("a closing trial is still a trial - the access gate ends it, not the date", () => {
    expect(moduleState({ ...petty("A"), trial_closing: true })).toBe("trialing");
  });

  it("a lapsed module that is no longer trial-eligible is expired", () => {
    expect(moduleState({ ...payment("A"), trial_eligible: false, lapsed_long: true })).toBe(
      "expired",
    );
  });
});

describe("resolveModuleState", () => {
  it("03-A: trial with days remaining, and a trial on offer", () => {
    const pc = resolveModuleState(petty("A"), TODAY);
    expect(pc.status).toEqual({ eyebrow: "Trial", text: "3 days remaining", tone: "accent" });
    expect(pc.live).toBe(true);
    expect(pc.cta).toEqual({ kind: "manage", label: "Manage Subscription", variant: "filled" });

    const pr = resolveModuleState(payment("A"), TODAY);
    expect(pr.status).toEqual({
      eyebrow: "Get Started",
      text: "30 days trial available",
      tone: "info",
    });
    expect(pr.live).toBe(false);
    expect(pr.cta).toEqual({ kind: "start_trial", label: "Start Free Trial", variant: "outline" });
  });

  it("03-B: a trial is urgent (red) at seven days or fewer, else 'Trial Active' in black", () => {
    expect(resolveModuleState(petty("B"), TODAY).status).toEqual({
      eyebrow: "Trial",
      text: "3 days remaining",
      tone: "accent",
    });
    expect(resolveModuleState(payment("B"), TODAY).status).toEqual({
      eyebrow: "Trial Active",
      text: "15 days remaining",
      tone: "plain",
    });
    const trialEnding = (days: number): ModuleCard => {
      const end = new Date(TODAY);
      end.setUTCDate(end.getUTCDate() + days);
      return { ...petty("B"), period_end: end.toISOString() };
    };
    expect(resolveModuleState(trialEnding(7), TODAY).status.tone).toBe("accent");
    expect(resolveModuleState(trialEnding(7), TODAY).status.eyebrow).toBe("Trial");
    expect(resolveModuleState(trialEnding(8), TODAY).status.tone).toBe("plain");
    expect(resolveModuleState(trialEnding(8), TODAY).status.eyebrow).toBe("Trial Active");
    // no end date at all: still a trial, drawn as urgent
    expect(resolveModuleState({ ...petty("B"), period_end: null }, TODAY).status).toEqual({
      eyebrow: "Trial",
      text: "Active",
      tone: "accent",
    });
  });

  it("03-C: active is a text link", () => {
    const v = resolveModuleState(petty("C"), TODAY);
    expect(v.status).toEqual({ text: "Currently Active", tone: "teal" });
    expect(v.cta.variant).toBe("link");
    expect(v.daysRemaining).toBeNull();
  });

  it("03-D: an expired trial can be activated", () => {
    const v = resolveModuleState(petty("D"), TODAY);
    expect(v.status).toEqual({ text: "Trial Expired", tone: "muted" });
    expect(v.live).toBe(false);
    expect(v.cta).toEqual({ kind: "activate", label: "Activate Subscription", variant: "outline" });
  });

  it("03-E: a pending cancellation counts down to the access end", () => {
    const v = resolveModuleState(petty("E"), TODAY);
    expect(v.status).toEqual({
      eyebrow: "Cancellation pending",
      text: "Ends in 15 days",
      tone: "accent",
    });
    expect(v.live).toBe(true);
    expect(v.cta).toEqual({ kind: "resume", label: "Resume Subscription", variant: "filled" });
  });

  it("03-F: suspended", () => {
    const v = resolveModuleState(petty("F"), TODAY);
    expect(v.status).toEqual({ text: "Subscription Suspended", tone: "muted" });
    expect(v.live).toBe(false);
    expect(v.cta).toEqual({
      kind: "reactivate",
      label: "Reactivate Subscription",
      variant: "outline",
    });
  });
});

describe("daysUntil", () => {
  it("counts calendar days, never negative, singular at one", () => {
    const today = new Date("2026-09-21T23:30:00.000Z");
    expect(daysUntil("2026-09-24", today)).toBe(3);
    expect(daysUntil("2026-09-22T01:00:00+08:00", today)).toBe(1);
    expect(daysUntil("2026-09-21", today)).toBe(0);
    expect(daysUntil("2026-09-01", today)).toBe(0);
    expect(daysUntil(null, today)).toBeNull();
    expect(daysUntil("soon", today)).toBeNull();
    expect(daysLabel(1)).toBe("1 day remaining");
    expect(daysLabel(3)).toBe("3 days remaining");
  });
});

describe("sharedCta / paymentFailed / pageLook", () => {
  const views = (frame: keyof typeof FIXTURES) =>
    FIXTURES[frame].cards.map((c) => resolveModuleState(c, TODAY));

  it("03-B and 03-C share one CTA; the others keep their own", () => {
    expect(sharedCta(views("B"))).toEqual({
      kind: "manage",
      label: "Manage Subscription",
      variant: "filled",
    });
    expect(sharedCta(views("C"))?.variant).toBe("link");
    expect(sharedCta(views("A"))).toBeNull();
    expect(sharedCta(views("D"))).toBeNull();
    expect(sharedCta(views("E"))).toBeNull();
    expect(sharedCta(views("F"))).toBeNull();
  });

  it("only 03-A draws the CTA inside the card", () => {
    expect(pageLook(views("A"))).toBe("inline");
    expect(pageLook([...views("A")].reverse())).toBe("inline");
    for (const frame of ["B", "C", "D", "E", "F"] as const) {
      expect(pageLook(views(frame)), frame).toBe("stacked");
    }
    // one card alone, or two of the same state, is not the frame
    expect(pageLook(views("A").slice(0, 1))).toBe("stacked");
    expect(pageLook([views("A")[1], views("A")[1]])).toBe("stacked");
  });

  it("the banner shows only when a module is suspended", () => {
    expect(paymentFailed(views("F"))).toBe(true);
    expect(paymentFailed(views("E"))).toBe(false);
  });
});
