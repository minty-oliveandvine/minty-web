/**
 * Every settings tab's buttons, in one place so each has the same look, enabled and disabled - the
 * Settings frames' (Figma 353:999, owner 2026-11-10): radius 12, 14px SemiBold, at least 44px high.
 * Primary is the Minty Action fill with its teal shadow; a disabled Primary turns grey (SET-G's
 * "Save changes" with nothing to save). Hover and pressed follow CLAUDE.md's Primary CTA.
 */

/** What every settings button shares: size, type, focus ring, the not-allowed cursor. */
const SETTINGS_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] px-5 py-3 text-sm leading-[1.4] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-set-tab disabled:cursor-not-allowed";

/** The tab's main action: Save changes, Invite, Send invitation, Connect / Reconnect to Xero. */
export const SETTINGS_PRIMARY = `${SETTINGS_BUTTON} bg-action text-white shadow-[0_4px_6px_rgba(0,203,198,0.28)] hover:bg-action-hover active:bg-action-pressed disabled:bg-set-line disabled:text-set-mute disabled:shadow-none`;
/** A quieter action beside it: Cancel, Resend. */
export const SETTINGS_OUTLINE = `${SETTINGS_BUTTON} border border-set-edge bg-white text-set-ink-2 hover:bg-set-pill disabled:opacity-50 disabled:hover:bg-white`;
/** Taking something away, as a quiet button: Disconnect from Xero, cancelling an invitation. */
export const SETTINGS_DANGER = `${SETTINGS_BUTTON} border border-set-danger-line bg-white text-danger hover:bg-set-warn-bg disabled:opacity-50 disabled:hover:bg-white`;
/** A dialog's confirming danger action (SET-2b's Disconnect). */
export const SETTINGS_DANGER_FILL = `${SETTINGS_BUTTON} bg-set-danger-line text-white hover:bg-danger disabled:opacity-50`;
