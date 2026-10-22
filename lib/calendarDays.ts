/**
 * The trial window both features count against (the subscription pages' trial banners and the
 * select-company list's "Needs you"), so the two never disagree about "soon". It lives in `lib/`
 * because a feature may not import another one.
 *
 * The day arithmetic itself - Hong Kong's "today", `daysFromToday`, `isoDateInTimeZone` - is
 * `@minty/shared/dates` (owner 2026-10-21: one shared module); this file keeps only this app's
 * constant.
 */

/**
 * How near a trial's end must be to need the person now - the overview's banner and the
 * company list's "Needs you" both use it.
 */
export const TRIAL_SOON_DAYS = 7;
