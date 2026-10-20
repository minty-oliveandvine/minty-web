// Calendar days are Hong Kong's: the business runs on HKT, so "today" is the day on a Hong Kong
// wall clock - 17:00 UTC on 19 Oct is already 20 Oct there.

import { describe, expect, it } from "vitest";

import { daysFromToday, hkIsoDate, TRIAL_SOON_DAYS } from "@/lib/calendarDays";

describe("calendarDays", () => {
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
