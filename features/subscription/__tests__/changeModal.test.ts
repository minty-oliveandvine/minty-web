// The confirmation modals' rules (Figma section 06): which of the seven shapes a pending change
// asks with, read off the ticks, and the design's copy.

import { describe, expect, it } from "vitest";

import { SUMMARY_FIXTURES } from "@/features/subscription/__fixtures__/modulePage";
import {
  CONFIRM,
  CONFIRM_CANCELLATION,
  CONFIRM_CHANGE,
  CONFIRM_CHANGES,
  buildChangeModal,
  menuCodes,
  ticksFor,
} from "@/features/subscription/lib/changeModal";
import { longDate, utcDay } from "@/features/subscription/lib/subscriptionSummary";

const text = (m: NonNullable<ReturnType<typeof buildChangeModal>>) =>
  m.paragraphs.map((p) => p.map((part) => part.text).join(""));

describe("buildChangeModal (section 06)", () => {
  it("PV21: a trial confirmed alone - Activate <Module>", () => {
    const m = buildChangeModal(SUMMARY_FIXTURES.M21, ["PETTY_CASH"])!;
    expect(m.kind).toBe("activate");
    expect(m.title).toEqual({
      lead: "Activate",
      module: { code: "PETTY_CASH", name: "Petty Cash", tone: "petty" },
      tail: "",
    });
    expect(text(m)).toEqual(["You've chosen to activate Petty Cash."]);
    expect(m.confirmLabel).toBe(CONFIRM);
    expect(m.confirmTone).toBe("teal");
    expect(m.image).toBe("celebrating");
  });

  it("PV31: an expired trial bought back asks the same way", () => {
    expect(buildChangeModal(SUMMARY_FIXTURES.M31, ["PETTY_CASH"])?.kind).toBe("activate");
  });

  it("PU22 / PV24: both ticked after the change - You have unlocked the bundle", () => {
    const both = buildChangeModal(SUMMARY_FIXTURES.M22, ["PETTY_CASH", "PAYMENT_REQUEST"])!;
    expect(both.kind).toBe("bundle");
    expect(both.title.lead).toBe("You have unlocked");
    expect(both.title.module).toEqual({ code: "PETTY_CASH", name: "Super Minty", tone: "bundle" });
    expect(text(both)).toEqual([
      "You’ve activated both modules.",
      "Enjoy bundled pricing and access to all available modules.",
    ]);
    expect(both.image).toBe("super");
    // PW45: the cancelling Payment Request restored beside an active Petty Cash - both again.
    expect(buildChangeModal(SUMMARY_FIXTURES.M45, ["PAYMENT_REQUEST"])?.kind).toBe("bundle");
  });

  it("PV51: a cancellation resumed alone - Continue <Module>", () => {
    const m = buildChangeModal(SUMMARY_FIXTURES.M51, ["PETTY_CASH"])!;
    expect(m.kind).toBe("continue");
    expect(m.title.lead).toBe("Continue");
    expect(text(m)).toEqual([
      "Petty Cash will remain in your subscription.",
      "Your scheduled cancellation will be removed.",
    ]);
  });

  it("PV61: a suspension reactivated alone - Reactivating <Module>", () => {
    const m = buildChangeModal(SUMMARY_FIXTURES.M61, ["PETTY_CASH"])!;
    expect(m.kind).toBe("reactivate");
    expect(m.title.lead).toBe("Reactivating");
    expect(text(m)).toEqual([
      "Petty Cash will be reactivated.",
      "Your subscription billing will resume.",
    ]);
  });

  it("PV44: one module removed while the other stays - Remove <Module>?, the orange button", () => {
    const m = buildChangeModal(SUMMARY_FIXTURES.M44, ["PETTY_CASH"])!;
    expect(m.kind).toBe("remove");
    expect(m.title).toEqual({
      lead: "Remove",
      module: { code: "PETTY_CASH", name: "Petty Cash", tone: "petty" },
      tail: "?",
    });
    expect(text(m)).toEqual([
      "You've chosen to remove Petty Cash. You'll still have access for another 30 days.",
      "Your other module will stay active, and your subscription fee will be updated accordingly.",
    ]);
    expect(m.confirmLabel).toBe(CONFIRM_CHANGE);
    expect(m.confirmTone).toBe("orange");
    expect(m.image).toBe("surprised");
  });

  it("PU44 / PV45 / NX21a: nothing ticked after - Cancel Subscription?, the red button", () => {
    const both = buildChangeModal(SUMMARY_FIXTURES.M44, ["PETTY_CASH", "PAYMENT_REQUEST"])!;
    expect(both.kind).toBe("cancel_subscription");
    expect(both.title.lead).toBe("Cancel Subscription?");
    expect(text(both)).toEqual([
      "No modules are selected.",
      "Your Minty subscription will be cancelled after 30 days.",
    ]);
    expect(both.confirmLabel).toBe(CONFIRM_CANCELLATION);
    expect(both.confirmTone).toBe("red");
    expect(both.image).toBe("sad");
    // The other module winding down is not ticked: nothing is left.
    expect(buildChangeModal(SUMMARY_FIXTURES.M45, ["PETTY_CASH"])?.kind).toBe(
      "cancel_subscription",
    );
  });

  // R1 (owner, 2026-11-10): unticking a trial only stops it continuing on a paid plan. The trial
  // runs on, so the popup never says cancel or remove, and never draws the red button.
  it("NX21a: a confirmed trial unticked - Stop <Module> after the trial?, no cancellation", () => {
    const m = buildChangeModal(SUMMARY_FIXTURES.N21a, ["PETTY_CASH"])!;
    const end = longDate(utcDay(SUMMARY_FIXTURES.N21a.cards[0].period_end)!);
    expect(m.kind).toBe("trial_stop");
    expect(m.title).toEqual({
      lead: "Stop",
      module: { code: "PETTY_CASH", name: "Petty Cash", tone: "petty" },
      tail: " after the trial?",
    });
    expect(text(m)).toEqual([
      `Petty Cash stays free until ${end}, and you can keep using it until then.`,
      `It won't continue on a paid plan after that. Tick it again before ${end} to keep it.`,
    ]);
    expect(m.confirmLabel).toBe(CONFIRM_CHANGE);
    expect(m.confirmTone).toBe("orange");
    expect(JSON.stringify(m)).not.toMatch(/cancel|remov/i);
  });

  it("both trials unticked - one question for both, still no cancellation", () => {
    const m = buildChangeModal(SUMMARY_FIXTURES.N22a, ["PETTY_CASH", "PAYMENT_REQUEST"])!;
    expect(m.kind).toBe("trial_stop");
    expect(m.title).toEqual({ lead: "Stop after the trial?", module: null, tail: "" });
    expect(text(m)).toHaveLength(3);
    expect(text(m)[0]).toMatch(/^Petty Cash stays free until /);
    expect(text(m)[1]).toMatch(/^Payment Request stays free until /);
    expect(JSON.stringify(m)).not.toMatch(/cancel|remov/i);
  });

  it("a trial unticked beside an addition - Subscription Changes, the trial's own sentence", () => {
    // Petty Cash's confirmed trial unticked while Payment Request's expired trial is bought.
    const page = {
      ...SUMMARY_FIXTURES.N21a,
      cards: [SUMMARY_FIXTURES.N21a.cards[0], SUMMARY_FIXTURES.M31.cards[0]].map((c, i) =>
        i === 1 ? { ...c, code: "PAYMENT_REQUEST" as const, name: "Payment Request" } : c,
      ),
    };
    const m = buildChangeModal(page, ["PETTY_CASH", "PAYMENT_REQUEST"])!;
    const end = longDate(utcDay(page.cards[0].period_end)!);
    expect(m.kind).toBe("changes");
    expect(text(m)).toEqual([
      `Petty Cash will stay free until ${end} and won't continue after that. Payment Request will be added. You'll have access immediately.`,
    ]);
  });

  it("the unticked trial ticked again - Continue <Module>, it continues when the trial ends", () => {
    const m = buildChangeModal(SUMMARY_FIXTURES.NX21a, ["PETTY_CASH"])!;
    const end = longDate(utcDay(SUMMARY_FIXTURES.NX21a.cards[0].period_end)!);
    expect(m.kind).toBe("continue");
    expect(m.title.lead).toBe("Continue");
    expect(text(m)).toEqual([
      `Petty Cash will continue on a paid plan when its trial ends on ${end}.`,
    ]);
    expect(JSON.stringify(m)).not.toMatch(/cancel/i);
  });

  it("PU45: a removal beside an addition - Subscription Changes, what leaves and what arrives", () => {
    const m = buildChangeModal(SUMMARY_FIXTURES.M45, ["PETTY_CASH", "PAYMENT_REQUEST"])!;
    expect(m.kind).toBe("changes");
    expect(m.title.lead).toBe("Subscription Changes");
    expect(text(m)).toEqual([
      "Petty Cash will be removed. You'll continue to have access for another 30 days. Payment Request will be added. You'll have access immediately.",
    ]);
    expect(m.paragraphs[0][0]).toEqual({ text: "Petty Cash", style: "petty" });
    expect(m.paragraphs[0][2]).toEqual({ text: "removed", style: "strong" });
    expect(m.confirmLabel).toBe(CONFIRM_CHANGES);
    expect(m.confirmTone).toBe("orange");
  });

  it("nothing to ask about when no code changes anything", () => {
    expect(buildChangeModal(SUMMARY_FIXTURES.M11, ["PETTY_CASH"])).toBeNull();
  });
});

describe("the ⋮'s items (05·D)", () => {
  it("Cancel subscription unticks every ACTIVE module; Reactivate ticks every one that is not", () => {
    const f = SUMMARY_FIXTURES;
    expect(menuCodes(f.M44, "cancel_subscription")).toEqual(["PETTY_CASH", "PAYMENT_REQUEST"]);
    expect(menuCodes(f.M44, "reactivate")).toEqual([]);
    // M45: Petty Cash active, Payment Request winding down - the cancellation is not ACTIVE.
    expect(menuCodes(f.M45, "cancel_subscription")).toEqual(["PETTY_CASH"]);
    expect(menuCodes(f.M45, "reactivate")).toEqual(["PAYMENT_REQUEST"]);
    // M21: a trial running, Payment Request never started - no tick to give the latter.
    expect(menuCodes(f.M21, "cancel_subscription")).toEqual([]);
    expect(menuCodes(f.M21, "reactivate")).toEqual(["PETTY_CASH"]);
    // M61: suspended + never started; M31: expired + never started; N21a: confirmed = ticked.
    expect(menuCodes(f.M61, "reactivate")).toEqual(["PETTY_CASH"]);
    expect(menuCodes(f.M31, "reactivate")).toEqual(["PETTY_CASH"]);
    expect(menuCodes(f.N21a, "reactivate")).toEqual([]);
    expect(menuCodes(f.N21a, "cancel_subscription")).toEqual([]);
  });

  it("the ticks flip each module named to the opposite of what the API says", () => {
    const f = SUMMARY_FIXTURES;
    expect(ticksFor(f.M44, ["PETTY_CASH", "PAYMENT_REQUEST"])).toEqual({
      PETTY_CASH: false,
      PAYMENT_REQUEST: false,
    });
    expect(ticksFor(f.M45, ["PAYMENT_REQUEST"])).toEqual({ PAYMENT_REQUEST: true });
    expect(ticksFor(f.M11, ["PETTY_CASH"])).toEqual({});
  });

  it("each item lands on the modal for exactly that change", () => {
    const f = SUMMARY_FIXTURES;
    expect(buildChangeModal(f.M45, menuCodes(f.M45, "cancel_subscription"))?.kind).toBe(
      "cancel_subscription",
    );
    expect(buildChangeModal(f.M45, menuCodes(f.M45, "reactivate"))?.kind).toBe("bundle");
    expect(buildChangeModal(f.M44, menuCodes(f.M44, "cancel_subscription"))?.kind).toBe(
      "cancel_subscription",
    );
    expect(buildChangeModal(f.M61, menuCodes(f.M61, "reactivate"))?.kind).toBe("reactivate");
  });
});
