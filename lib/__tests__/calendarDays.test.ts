// Calendar days are Hong Kong's: the business runs on HKT, so "today" is the day on a Hong Kong
// wall clock - 17:00 UTC on 19 Oct is already 20 Oct there. The arithmetic is
// @minty/shared/dates (the shared-code refactor, 2026-10-21); these pin what this app relies on.

import { describe, expect, it } from "vitest";

import { daysFromToday, HK_TIME_ZONE, isoDateInTimeZone } from "@minty/shared/dates";

import { TRIAL_SOON_DAYS } from "@/lib/calendarDays";

const hkIsoDate = (d: Date) => isoDateInTimeZone(HK_TIME_ZONE, d);

describe("calendar days", () => {
  it("reads today as Hong Kong's date, not UTC's", () => {
    expect(hkIsoDate(new Date("2026-10-19T15:59:59Z"))).toBe("2026-10-19");
    expect(hkIsoDate(new Date("2026-10-19T16:00:00Z"))).toBe("2026-10-20");
    expect(hkIsoDate(new Date("2026-10-19T17:00:00Z"))).toBe("2026-10-20");
  });

  it("counts from Hong Kong's day: 01:00 HK on 20 Oct is 2 days before the 22nd", () => {
    const lateUtc = new Date("2026-10-19T17:00:00Z"); // 20 Oct 01:00 in Hong Kong
    expect(daysFromToday("2026-10-22", lateUtc)).toBe(2);
    expect(daysFromToday("2026-10-20", lateUtc)).toBe(0);
    expect(daysFromToday("2026-10-19", lateUtc)).toBe(-1);
    // the day part of a datetime is the business day already
    expect(daysFromToday("2026-10-21T09:00:00+08:00", lateUtc)).toBe(1);
  });

  it("the same afternoon in both zones counts the same", () => {
    const midday = new Date("2026-10-19T04:00:00Z"); // 12:00 in Hong Kong
    expect(daysFromToday("2026-10-26", midday)).toBe(TRIAL_SOON_DAYS);
  });

  it("is null for no date or one it cannot read", () => {
    const now = new Date("2026-10-19T04:00:00Z");
    expect(daysFromToday(null, now)).toBeNull();
    expect(daysFromToday(undefined, now)).toBeNull();
    expect(daysFromToday("soon", now)).toBeNull();
  });
});

describe("calendar days' edges", () => {
  it('reckons in Asia/Hong_Kong, and a trial is "soon" within 7 days', () => {
    expect(HK_TIME_ZONE).toBe("Asia/Hong_Kong");
    expect(TRIAL_SOON_DAYS).toBe(7);
  });

  it('the Hong Kong day is "" for an unreadable instant, and pads month and day', () => {
    expect(hkIsoDate(new Date("nope"))).toBe("");
    expect(hkIsoDate(new Date("2026-01-04T00:00:00Z"))).toBe("2026-01-04");
  });

  it("daysFromToday is null for an unreadable today, and for an empty until", () => {
    expect(daysFromToday("2026-10-22", new Date("nope"))).toBeNull();
    expect(daysFromToday("", new Date("2026-10-19T04:00:00Z"))).toBeNull();
  });

  it("reads only the leading YYYY-MM-DD: trailing junk is ignored, a slashed date is not a date", () => {
    const now = new Date("2026-10-19T04:00:00Z");
    expect(daysFromToday("2026-10-20junk", now)).toBe(1);
    expect(daysFromToday("2026/10/20", now)).toBeNull();
    // owner 2026-10-21: one shared module (@minty/shared/dates) - surrounding whitespace is trimmed (it was null)
    expect(daysFromToday(" 2026-10-20", now)).toBe(1);
  });

  it("an impossible day is no date", () => {
    // owner 2026-10-21: one shared module (@minty/shared/dates) - it rolled 2026-02-30 over to 2 March (3)
    const now = new Date("2026-02-27T04:00:00Z");
    expect(daysFromToday("2026-02-30", now)).toBeNull();
  });

  it("counts across a year end and long spans in whole days", () => {
    const now = new Date("2026-12-31T04:00:00Z");
    expect(daysFromToday("2027-01-01", now)).toBe(1);
    expect(daysFromToday("2027-12-31", now)).toBe(365);
  });
});
