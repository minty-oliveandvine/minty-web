/**
 * Onboarding's billing sheet as Tailwind classes - its `.billing-*` rules
 * (`minty-onboarding-web/app/globals.css`, Figma 01-L / 01-D / 01-J), in one place because two files draw
 * from them: the sheet itself (`AccountSheet`) and the card form it mounts (`CardCaptureForm`,
 * look "sheet"). The values are onboarding's, copied rather than approximated - the same dialog
 * in two apps must be the same dialog, so a change to one is a change to the other.
 *
 * The buttons are split into a look and a size so a caller never stacks two heights or two radii
 * on one element: Tailwind orders its utilities itself, not by the order of the class string.
 */

/** `.billing-label` */
export const SHEET_LABEL = "mb-1.5 block text-label font-semibold text-ink";
/**
 * `.billing-label .req` - the red asterisk on a mandatory field's label.
 *
 * Always paired with `aria-required` (or the native `required`) on the CONTROL: an asterisk
 * read aloud is "star", so the mark is for the eye and the attribute for everyone else.
 * Mirrored in `minty-onboarding-web/app/globals.css`, per the note at the top of this file.
 */
export const SHEET_REQUIRED = "text-danger";
/** `.billing-field` */
export const SHEET_FIELD = "mb-3.5";
/** `.billing-input` - matched to the Stripe fields below it (`STRIPE_APPEARANCE`). */
export const SHEET_INPUT =
  "block h-11 w-full rounded-lg border bg-card px-3 py-3 text-body-m text-ink transition-[border-color,box-shadow] duration-150 placeholder:text-ink-muted focus:outline-none disabled:cursor-not-allowed disabled:bg-sunk";
export const SHEET_INPUT_OK =
  "border-line-input focus:border-line-selected focus:ring-2 focus:ring-line-selected/25";
/** `.billing-input.is-invalid` - the border AND the message under it; colour alone is no signal. */
export const SHEET_INPUT_BAD = "border-danger focus:ring-2 focus:ring-danger/25";
/** `.billing-fielderror` */
export const SHEET_FIELD_ERROR = "mt-1.5 text-label leading-[1.4] text-danger";
/** `.billing-error` - half a point larger than the mandate: it is read once, under pressure. */
export const SHEET_ERROR =
  "mt-6 rounded-lg border border-danger bg-danger-bg px-3 py-2.5 text-body-s leading-normal text-danger [overflow-wrap:anywhere]";
/** `.billing-loading` */
export const SHEET_LOADING = "py-4 text-body-m text-ink-muted";

/** `.btn-primary`'s look: the gradient, its glow, and the grey it turns when disabled. */
const PRIMARY_LOOK =
  "inline-flex items-center justify-center gap-2 bg-action text-white transition-[background-color,transform] duration-200 hover:bg-action-hover active:bg-action-pressed active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-action-disabled disabled:text-ink-disabled disabled:active:scale-100";
/** `.billing-actions .btn` - Minty v2 Primary: 44 high, 12px radius. */
export const SHEET_PRIMARY = `${PRIMARY_LOOK} h-11 rounded-lg px-4 text-body-m font-semibold`;
/** `.billing-done-btn` - 01-J's one button, now the ordinary Primary size. */
export const SHEET_DONE = `${PRIMARY_LOOK} h-11 rounded-lg px-4 text-body-m font-semibold`;
/** `.btn-ghost` inside `.billing-actions` - Minty v2 Secondary (teal edge, teal label). */
export const SHEET_GHOST =
  "inline-flex h-11 items-center justify-center rounded-lg border border-line-selected bg-card px-4 text-body-m font-semibold text-link transition-colors duration-200 hover:bg-selected disabled:cursor-not-allowed disabled:opacity-60";

/** `.billing-actions` - Minty v2's dialog actions: Cancel then the verb, right-aligned; below
 * 640px stacked, the verb first, full width. */
export const SHEET_PAIR = "mt-6 flex justify-end gap-3 max-sm:flex-col-reverse";
export const SHEET_PAIR_BACK = "max-sm:w-full";
export const SHEET_PAIR_MAIN = "max-sm:w-full";
/** `.billing-actions.is-single` - one button, right-aligned like a pair's verb. */
export const SHEET_SINGLE = "mt-6 flex justify-end max-sm:[&>*]:w-full";

/** `.billing-list` - scrolls at ~3.5 rows, so a fourth is visibly cut off. */
export const SHEET_LIST =
  "m-0 grid max-h-[370px] list-none gap-2.5 overflow-y-auto overscroll-contain p-0.5";
/** `.billing-add` - a button styled as the design's link: it opens the form, it goes nowhere. */
export const SHEET_ADD =
  "mx-auto mt-8 block min-h-11 cursor-pointer border-0 bg-transparent px-2 py-1 text-title-m font-normal text-link hover:underline hover:underline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-50";
