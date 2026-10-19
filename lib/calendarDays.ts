/**
 * Calendar-day arithmetic shared by the features (the subscription pages' trial counts and the
 * select-company list's "Trial ends in N days"), so the two never count a day differently.
 * Moved here from `features/subscription/lib/moduleState.ts` on 2026-10-19, when the entity list
 * needed it: a feature may not import another one.
 */

/**
 * How near a trial's end must be to need the person now - the overview's banner and the
 * company list's "Needs you" both use it.
 */
export const TRIAL_SOON_DAYS = 7;

/** The zone the business's days are reckoned in (minty-payment-request-web's `BILLING_TIME_ZONE`). */
export const BUSINESS_TIME_ZONE = "Asia/Hong_Kong";

/**
 * The calendar date an instant falls on in Hong Kong, as `YYYY-MM-DD` - 17:00 UTC on 19 Oct is
 * 20 Oct there. Mirrors minty-payment-request-web's `isoDateInTimeZone` (lib/dateDisplayFormat.ts)
 * until it moves into @minty/shared. "" for an unreadable instant.
 */
export function hkIsoDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return y && m && day ? `${y}-${m}-${day}` : "";
}

/** `YYYY-MM-DD` of an ISO date or datetime, or null when it does not start with one. */
function isoDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function utcMidnight(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Whole days from `today` to the day part of `until` - negative once it has passed, null when
 * `until` is not a date. Both sides are calendar days: `until`'s day part (the API's dates are
 * the business day already) and `today`'s date in HONG KONG (`hkIsoDate`, 2026-10-19 - it was
 * UTC's, a day behind from 00:00 to 08:00 HKT), never instants.
 */
export function daysFromToday(until: string | null | undefined, today: Date): number | null {
  const end = isoDay(until);
  if (!end) return null;
  const from = hkIsoDate(today);
  if (!from) return null;
  const start = utcMidnight(from);
  return Math.round((utcMidnight(end) - start) / 86_400_000);
}
