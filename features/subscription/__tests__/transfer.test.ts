// The transfer screens' rules (Figma section 07): minor-unit money, the paid-through day and
// the responsibility sentence, the person a request waits on, inherited trials, the expiry chip.
// Accepting charges nothing, so there is no money line on the recipient's side to test.

import { describe, expect, it } from "vitest";

import {
  INCOMING_REQUEST,
  SUBSCRIBER_OPTIONS,
  SUBSCRIBER_OPTIONS_ALONE,
  SUBSCRIBER_OPTIONS_PENDING,
} from "@/features/subscription/__fixtures__/transfers";
import { longDate, shortDate, utcDay } from "@/features/subscription/lib/subscriptionSummary";
import {
  declinedNote,
  expiresLabel,
  undatedDecline,
  formatMinor,
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
  it("reads the paid-through day off the company, and writes the sentence", () => {
    const day = paidThrough(SUBSCRIBER_OPTIONS)!;
    expect(day).toEqual(utcDay(SUBSCRIBER_OPTIONS.paid_through));
    expect(responsibilityNote("Company B Limited", day)).toBe(
      `Send request to take over the subscription. You are still responsible for Company B Limited until the transfer is successfully completed. This subscription has been paid up until ${longDate(day)}. The new subscriber will begin incurring charges after this date.`,
    );
    expect(responsibilityNote("Company B Limited", null)).toBe(
      "Send request to take over the subscription. You are still responsible for Company B Limited until the transfer is successfully completed.",
    );
  });

  it("still says it when there is nobody to hand the company to", () => {
    // The payer is the only admin, so the API prices no quotes - the date used to come off
    // one of those, and the footer lost two sentences on exactly this company.
    expect(SUBSCRIBER_OPTIONS_ALONE.candidates.every((c) => !c.quote)).toBe(true);
    expect(paidThrough(SUBSCRIBER_OPTIONS_ALONE)).toEqual(utcDay(SUBSCRIBER_OPTIONS.paid_through));
    // And with a request already waiting, where quotes are not priced either.
    expect(paidThrough(SUBSCRIBER_OPTIONS_PENDING)).not.toBeNull();
  });

  it("falls back to a candidate's quote when the company does not say", () => {
    // An API that has not shipped the field yet still answers through the old path.
    const older = { ...SUBSCRIBER_OPTIONS, paid_through: null };
    expect(paidThrough(older)).toEqual(utcDay(SUBSCRIBER_OPTIONS.candidates[1].quote!.covers_from));
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
});

describe("the recipient's side", () => {
  it("says what happens to a declined module - and a trial ends on a different day", () => {
    const day = utcDay(INCOMING_REQUEST.quote!.covers_from)!;
    const paid = (name: string) => ({ name, trialing: false });
    const trial = (name: string) => ({ name, trialing: true });

    expect(declinedNote([], day)).toBe("No pending changes");
    expect(declinedNote([paid("Payment Request")], day)).toBe(
      `Payment Request ends on ${shortDate(day)}.`,
    );
    expect(declinedNote([paid("Petty Cash"), paid("Payment Request")], day)).toBe(
      `Petty Cash and Payment Request end on ${shortDate(day)}.`,
    );
    // A trial runs its free days out and then does not convert - it does not stop when the
    // outgoing payer's money does, which is what this used to claim.
    expect(declinedNote([trial("Petty Cash")], day)).toBe(
      "Petty Cash ends when the trial runs out.",
    );
    // One of each: two sentences, because they are two different days.
    expect(declinedNote([trial("Petty Cash"), paid("Payment Request")], day)).toBe(
      `Petty Cash ends when the trial runs out. Payment Request ends on ${shortDate(day)}.`,
    );
  });

  it("refuses, loudly, when a PAID module is declined and nothing says when it ends", () => {
    const paid = (name: string) => ({ name, trialing: false });
    const trial = (name: string) => ({ name, trialing: true });
    const day = utcDay(INCOMING_REQUEST.quote!.covers_from)!;

    // The date comes from the same read that prices the handover, so its absence means the
    // pricing failed - not that the answer is "no date". Worded softly it reads as ordinary
    // copy above a button that cancels a module for real.
    expect(undatedDecline([paid("Payment Request")], null)).toMatch(
      /can't tell when Payment Request would stop being billed/,
    );
    expect(() => declinedNote([paid("Payment Request")], null)).toThrow(/no end date/);

    // Nothing wrong in any of these.
    expect(undatedDecline([paid("Payment Request")], day)).toBeNull();
    expect(undatedDecline([], null)).toBeNull();
    // A declined trial ends at its own trial end and never needed this date.
    expect(undatedDecline([trial("Petty Cash")], null)).toBeNull();
    expect(declinedNote([trial("Petty Cash")], null)).toBe(
      "Petty Cash ends when the trial runs out.",
    );
  });

  it("dates the expiry chip", () => {
    expect(expiresLabel(INCOMING_REQUEST)).toBe(
      `Expires ${shortDate(utcDay(INCOMING_REQUEST.expires_at)!)}`,
    );
  });
});
