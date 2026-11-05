/**
 * The Users and Entity & Integration tabs' buttons, in one place so every one has the same look,
 * enabled and disabled (2026-11-05): the page's flat teal, 44px high, the inputs' radius. Disabled
 * fades to half and shows the not-allowed cursor; hover does nothing then. The shared
 * `ConfirmDialog` keeps its own buttons; the billing sheets keep `SHEET_PRIMARY`'s gradient.
 */

/** What every settings button shares: size, type, focus ring, the disabled state. */
const SETTINGS_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-strong disabled:cursor-not-allowed disabled:opacity-50";

/** The tab's main action: Save Changes, Invite, Send invitation, Connect / Reconnect to Xero. */
export const SETTINGS_PRIMARY = `${SETTINGS_BUTTON} bg-secondary text-white hover:bg-teal-strong disabled:hover:bg-secondary`;
/** A quieter action beside it: Resend, the Invite dialog's Cancel. */
export const SETTINGS_OUTLINE = `${SETTINGS_BUTTON} border border-gray-300 text-ink hover:bg-gray-50 disabled:hover:bg-transparent`;
/** Taking something away: Disconnect (with a border), cancelling an invitation. */
export const SETTINGS_DANGER = `${SETTINGS_BUTTON} text-red-600 hover:bg-red-50 disabled:hover:bg-transparent`;
