// The result screens' rules (Figma 05·C): which screen a change lands on, read off the page
// model before and after; the copy of the design's generated frames; the money line agreeing
// with the panel's forecast.

import { describe, expect, it } from "vitest";

import {
  RESULT_FIXTURES,
  SUMMARY_FIXTURES,
  TODAY,
} from "@/features/subscription/__fixtures__/modulePage";
import { ENTITIES } from "@/features/subscription/__fixtures__/subscriptions";
import {
  CONGRATULATIONS,
  HERO_MODULE_CANCELLED,
  HERO_SUBSCRIPTION_CANCELLED,
  NOTHING_CHARGED,
  SUBSCRIPTION_UPDATED,
  THANK_YOU,
  buildChangeResult,
  moneyLine,
  outcomeOf,
  startedTrialResult,
} from "@/features/subscription/lib/changeResult";
import { forecast, shortDate, longDate } from "@/features/subscription/lib/subscriptionSummary";

const entity = { entity_name: "Kestrel Foods Limited", created_at: ENTITIES[0].created_at };

function build(frame: keyof typeof RESULT_FIXTURES) {
  const { before, asked, after } = RESULT_FIXTURES[frame];
  return buildChangeResult(asked, before, after, entity, TODAY);
}

function text(r: ReturnType<typeof build>) {
  return r.lines.map((l) => l.text);
}

describe("buildChangeResult (05·C)", () => {
  it("RU22: both trials confirmed - ONE line, the bundle, not the same sentence twice", () => {
    // The design's RU frames say it per module; both confirmed is the bundle said twice, so
    // the row says it once. Only when the SAME thing happened to every module of the bundle.
    const r = build("RU22");
    expect(r.kind).toBe("celebrate");
    expect(r.layout).toBe("row");
    expect(r.headline).toEqual({ module: null, text: CONGRATULATIONS });
    expect(text(r)).toEqual([
      "Super Minty is confirmed. Billing starts the day its trial ends.",
    ]);
    expect(r.lines.map((l) => l.module.tone)).toEqual(["bundle"]);
    expect(r.lines.map((l) => l.module.code)).toEqual(["BUNDLE"]);
    expect(r.money).toBe("Nothing charged today · HK$400 a month when the trial ends.");
    expect(r.footer.createdOn).not.toBeNull();
  });

  it("RU23: a trial confirmed and an expired trial bought back - HK$280 now, the bundle after", () => {
    const r = build("RU23");
    expect(r.kind).toBe("celebrate");
    expect(text(r)).toEqual([
      "Petty Cash is confirmed. Billing starts the day its trial ends.",
      "Payment Request is active. Your card has been charged.",
    ]);
    expect(r.money).toBe("HK$280 a month now · HK$400 when the trial ends.");
  });

  it("RU24: a removal and an addition in one change - Subscription updated, until/then", () => {
    const r = build("RU24");
    const { after } = RESULT_FIXTURES.RU24;
    const end = after.cards[1].access_end_date!;
    const [y, m, d] = end.split("-").map(Number);
    const day = new Date(Date.UTC(y, m - 1, d));
    expect(r.kind).toBe("updated");
    expect(r.layout).toBe("row");
    expect(r.headline.text).toBe(SUBSCRIPTION_UPDATED);
    expect(text(r)).toEqual([
      `Payment Request is scheduled to end on ${shortDate(day)}.`,
      "Petty Cash is available now.",
    ]);
    // "until" is the day the removed module ends - the same day the line above names.
    expect(r.money).toBe(`HK$280 until ${shortDate(day)}, then HK$280 a month.`);
  });

  it("RV14: a trial started beside an active module - 30 days free, the other's price", () => {
    const r = build("RV14");
    expect(r.kind).toBe("celebrate");
    expect(text(r)).toEqual(["Petty Cash free trial has started — 30 days, free."]);
    expect(r.money).toBe("HK$280 a month.");
  });

  it("RV51: a cancellation resumed - restored, billing carries on", () => {
    const r = build("RV51");
    expect(text(r)).toEqual(["Petty Cash is restored and billing carries on as before."]);
    expect(r.money).toBe("HK$280 a month.");
  });

  it("RV44: one module removed while the other keeps running - the module cancellation page", () => {
    const r = build("RV44");
    const { after } = RESULT_FIXTURES.RV44;
    const end = after.cards[0].access_end_date!;
    const [y, m, d] = end.split("-").map(Number);
    const until = longDate(new Date(Date.UTC(y, m - 1, d)));
    expect(r.kind).toBe("module_cancelled");
    expect(r.layout).toBe("page");
    expect(r.hero).toBe(HERO_MODULE_CANCELLED);
    expect(r.headline.module?.name).toBe("Petty Cash");
    expect(r.headline.text).toBe(" Cancellation Confirmed");
    expect(r.company).toBe("Kestrel Foods Limited");
    const paragraphs = r.paragraphs.map((p) => p.map((part) => part.text).join(""));
    expect(paragraphs).toEqual([
      "We've received your cancellation request for Petty Cash.",
      `You'll still have access until ${until}. Your other module will remain active, and your subscription fee will be updated accordingly.`,
      "Changed your mind? You can reactivate Petty Cash anytime!",
    ]);
    expect(r.paragraphs[1][1]).toEqual({ text: until, style: "strong" });
    expect(r.paragraphs[0][1]).toEqual({ text: "Petty Cash", style: "petty" });
    expect(r.lines).toEqual([]);
    expect(r.money).toBeNull();
  });

  it("RV45 / RW45: the other module winding down still counts as running; resumed = the bundle", () => {
    const cancelled = build("RV45");
    expect(cancelled.kind).toBe("module_cancelled");
    expect(cancelled.headline.module?.name).toBe("Petty Cash");
    const resumed = build("RW45");
    expect(resumed.kind).toBe("celebrate");
    expect(text(resumed)).toEqual([
      "Payment Request is restored and billing carries on as before.",
    ]);
    expect(resumed.money).toBe("HK$400 a month.");
  });

  it("RV41: the only paid module removed - the subscription cancellation page", () => {
    const r = build("RV41");
    expect(r.kind).toBe("subscription_cancelled");
    expect(r.layout).toBe("page");
    expect(r.hero).toBe(HERO_SUBSCRIPTION_CANCELLED);
    expect(r.headline).toEqual({ module: null, text: THANK_YOU });
    const paragraphs = r.paragraphs.map((p) => p.map((part) => part.text).join(""));
    expect(paragraphs[0]).toBe("Your Minty subscription has been scheduled for cancellation.");
    expect(paragraphs[1]).toMatch(
      /^You will continue to have access to your subscribed modules until the end of your current billing period which is \d{1,2} \w+ \d{4}\.$/,
    );
    expect(paragraphs[2]).toBe("You may reactivate the subscription anytime.");
  });

  it("RNX21a: a confirmed trial unticked with nothing else billing - the subscription page", () => {
    const r = build("RNX21a");
    expect(r.kind).toBe("subscription_cancelled");
  });

  it("a change the page model does not reflect still lands somewhere honest", () => {
    const { before } = RESULT_FIXTURES.RV51;
    const r = buildChangeResult(
      { kind: "ticks", codes: ["PETTY_CASH"] },
      before,
      before,
      entity,
      TODAY,
    );
    expect(r.kind).toBe("celebrate");
    expect(text(r)).toEqual(["Petty Cash has been updated."]);
  });
});

describe("outcomeOf", () => {
  it("names each transition the changes make", () => {
    const f = RESULT_FIXTURES;
    expect(outcomeOf(f.RU22.before.cards[0], f.RU22.after.cards[0])).toBe("confirmed");
    expect(outcomeOf(f.RU23.before.cards[1], f.RU23.after.cards[1])).toBe("activated");
    expect(outcomeOf(f.RU24.before.cards[1], f.RU24.after.cards[1])).toBe("ending");
    expect(outcomeOf(f.RV14.before.cards[0], f.RV14.after.cards[0])).toBe("started");
    expect(outcomeOf(f.RV51.before.cards[0], f.RV51.after.cards[0])).toBe("restored");
    expect(outcomeOf(f.RNX21a.before.cards[0], f.RNX21a.after.cards[0])).toBe("stopped");
    // untouched
    expect(outcomeOf(f.RV14.before.cards[1], f.RV14.after.cards[1])).toBeNull();
  });
});

describe("moneyLine", () => {
  it("says the panel's numbers in the design's five sentences", () => {
    const f = RESULT_FIXTURES;
    expect(moneyLine(forecast(f.RV44.before, TODAY))).toBe("HK$400 a month.");
    expect(moneyLine(forecast(f.RU22.after, TODAY))).toBe(
      "Nothing charged today · HK$400 a month when the trial ends.",
    );
    expect(moneyLine(forecast(f.RU23.after, TODAY))).toBe(
      "HK$280 a month now · HK$400 when the trial ends.",
    );
    expect(moneyLine(forecast(f.RV41.before, TODAY))).toBe("HK$280 a month.");
    expect(moneyLine(forecast(f.RNX21a.after, TODAY))).toBe(NOTHING_CHARGED);
    expect(moneyLine(forecast(f.RV44.after, TODAY))).toMatch(
      /^HK\$400 until \d{1,2} \w+ \d{4}, then HK\$280 a month\.$/,
    );
  });
});

describe("startedTrialResult (RV11, rebuilt from the page model alone)", () => {
  it("says exactly what buildChangeResult says for the same trial", () => {
    const { after } = RESULT_FIXTURES.RV14;
    const rebuilt = startedTrialResult(entity, after, "PETTY_CASH", TODAY);
    expect(rebuilt).toEqual(build("RV14"));
  });

  it("RV11: a lone trial - 30 days free, and nothing is being charged", () => {
    // M21 is RV11's company: Petty Cash on trial, nothing else started, so nothing bills.
    const r = startedTrialResult(entity, SUMMARY_FIXTURES.M21, "PETTY_CASH", TODAY);
    expect(r?.kind).toBe("celebrate");
    expect(r?.layout).toBe("row");
    expect(r?.headline).toEqual({ module: null, text: CONGRATULATIONS });
    expect(r?.lines.map((l) => l.text)).toEqual([
      "Petty Cash free trial has started — 30 days, free.",
    ]);
    expect(r?.money).toBe(NOTHING_CHARGED);
  });

  it("says nothing unless that module is really on trial", () => {
    const no = (page: Parameters<typeof startedTrialResult>[1], code: string) =>
      startedTrialResult(entity, page, code, TODAY);
    expect(no(SUMMARY_FIXTURES.M11, "PETTY_CASH")).toBeNull(); // never started
    expect(no(SUMMARY_FIXTURES.M31, "PETTY_CASH")).toBeNull(); // the trial expired
    expect(no(SUMMARY_FIXTURES.M44, "PETTY_CASH")).toBeNull(); // active, not on trial
    expect(no(SUMMARY_FIXTURES.M61, "PETTY_CASH")).toBeNull(); // suspended
    expect(no(SUMMARY_FIXTURES.M21, "BANANA")).toBeNull(); // no such module here
    expect(no(null, "PETTY_CASH")).toBeNull(); // the page model is not in yet
    // A trial since cancelled still reads as "trialing" - it must not celebrate again.
    const cancelled = {
      ...SUMMARY_FIXTURES.M21,
      cards: SUMMARY_FIXTURES.M21.cards.map((c) =>
        c.code === "PETTY_CASH" ? { ...c, trial_cancelled: true } : c,
      ),
    };
    expect(no(cancelled, "PETTY_CASH")).toBeNull();
    // A trial already confirmed is still a trial that has just started - that one celebrates.
    expect(no(SUMMARY_FIXTURES.N21a, "PETTY_CASH")).not.toBeNull();
  });
});
