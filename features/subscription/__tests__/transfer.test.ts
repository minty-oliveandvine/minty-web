// The transfer screens' rules (Figma section 07): minor-unit money, the paid-through day and
// the responsibility sentence, the person a request waits on, what a candidate or the recipient
// would be charged, inherited trials, the expiry chip.

import { describe, expect, it } from "vitest";

import {
  INCOMING_REQUEST,
  INCOMING_REQUEST_TRIAL,
  SUBSCRIBER_OPTIONS,
  SUBSCRIBER_OPTIONS_PENDING,
} from "@/features/subscription/__fixtures__/transfers";
import { longDate, shortDate, utcDay } from "@/features/subscription/lib/subscriptionSummary";
import {
  NOTHING_TO_PAY_TODAY,
  acceptCharge,
  candidateCharge,
  expiresLabel,
  formatMinor,
  inheritedTrialLines,
  paidThrough,
  pendingRecipient,
  pendingSentence,
  responsibilityNote,
} from "@/features/subscription/lib/transfer";

describe("formatMinor", () => {
  it("turns the engine's minor units into the page's money", () => {
    expect(formatMinor(8800, "HKD")).toBe("HKD 88");
    expect(formatMinor(8850, "HKD")).toBe("HKD 88.50");
    expect(formatMinor(8800, "HKD", "HK$")).toBe("HK$88");
    expect(formatMinor(28000, null)).toBe("280");
  });
});

describe("the payer's side", () => {
  it("reads the paid-through day off any candidate's quote, and writes the sentence", () => {
    const day = paidThrough(SUBSCRIBER_OPTIONS)!;
    expect(day).toEqual(utcDay(SUBSCRIBER_OPTIONS.candidates[1].quote!.covers_from));
    expect(responsibilityNote("Company B Limited", day)).toBe(
      `Send request to take over the subscription. You are still responsible for Company B Limited until the transfer is successfully completed. This subscription has been paid up until ${longDate(day)}. The new subscriber will begin incurring charges after this date.`,
    );
    expect(responsibilityNote("Company B Limited", null)).toBe(
      "Send request to take over the subscription. You are still responsible for Company B Limited until the transfer is successfully completed.",
    );
    expect(paidThrough(SUBSCRIBER_OPTIONS_PENDING)).toBeNull();
  });

  it("names the person an offer waits on, and since when", () => {
    expect(pendingRecipient(SUBSCRIBER_OPTIONS)).toBeNull();
    const who = pendingRecipient(SUBSCRIBER_OPTIONS_PENDING)!;
    expect(who.name).toBe("Jiwon Kim");
    expect(who.email).toBe("jiwon.kim@oliveandvine.com");
    expect(who.since).toEqual(utcDay(SUBSCRIBER_OPTIONS_PENDING.pending_transfer!.since));
    expect(pendingSentence(who)).toBe(
      `Sent ${shortDate(who.since!)} to Jiwon Kim. Nothing has changed and you are still the subscriber. Withdraw it if you want to ask somebody else.`,
    );
    // An offer to someone no longer listed still reads.
    const gone = pendingRecipient({
      ...SUBSCRIBER_OPTIONS_PENDING,
      candidates: SUBSCRIBER_OPTIONS_PENDING.candidates.filter((c) => c.id !== "u-jiwon"),
    })!;
    expect(gone.name).toBe("");
    expect(pendingSentence(gone)).toMatch(/to them\./);
  });

  it("says what the chosen person would be charged, from their own quote", () => {
    const [harry, rebecca, jiwon] = SUBSCRIBER_OPTIONS.candidates;
    expect(candidateCharge(harry)).toBeNull();
    const q = rebecca.quote!;
    expect(candidateCharge(rebecca)).toBe(
      `They’ll be charged HKD 88 for ${shortDate(utcDay(q.covers_from)!)} to ${shortDate(utcDay(q.covers_to)!)} — the days after the period you’ve paid for, up to their own billing date.`,
    );
    expect(candidateCharge(jiwon)).toMatch(/This also sets their billing date\.$/);
  });
});

describe("the recipient's side", () => {
  it("says what accepting charges today, or that nothing is due when everything is on trial", () => {
    const priced = acceptCharge(INCOMING_REQUEST, "HK$");
    const q = INCOMING_REQUEST.quote!;
    expect(priced.today).toBe(
      `You’ll be charged HK$88 today for ${shortDate(utcDay(q.covers_from)!)} to ${shortDate(utcDay(q.covers_to)!)}.`,
    );
    expect(priced.detail).toMatch(
      /^That covers the days after the period Priya Chan has already paid for/,
    );
    expect(priced.detail).toMatch(/renews on your usual billing date\.$/);
    expect(priced.nothingDueNow).toBe(false);

    const free = acceptCharge(INCOMING_REQUEST_TRIAL);
    expect(free).toEqual({ today: NOTHING_TO_PAY_TODAY, detail: null, nothingDueNow: true });

    const unpriced = acceptCharge({ ...INCOMING_REQUEST, amount: null, quote: null });
    expect(unpriced.today).toBeNull();
    expect(unpriced.detail).toMatch(/couldn’t price this request/);
  });

  it("lists the trials that carry over, and the expiry chip", () => {
    const t = INCOMING_REQUEST_TRIAL.trials[0];
    expect(inheritedTrialLines(INCOMING_REQUEST_TRIAL.trials, "HK$")).toEqual([
      `Petty Cash free trial carries over until ${shortDate(utcDay(t.trial_end)!)}; HK$280 a month after that.`,
    ]);
    expect(expiresLabel(INCOMING_REQUEST)).toBe(
      `Expires ${shortDate(utcDay(INCOMING_REQUEST.expires_at)!)}`,
    );
  });
});
