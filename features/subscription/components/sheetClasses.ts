/**
 * Onboarding's billing sheet as Tailwind classes - its `.billing-*` rules
 * (`onboarding/app/globals.css`, Figma 01-L / 01-D / 01-J), in one place because two files draw
 * from them: the sheet itself (`AccountSheet`) and the card form it mounts (`CardCaptureForm`,
 * look "sheet"). The values are onboarding's, copied rather than approximated - the same dialog
 * in two apps must be the same dialog, so a change to one is a change to the other.
 *
 * The buttons are split into a look and a size so a caller never stacks two heights or two radii
 * on one element: Tailwind orders its utilities itself, not by the order of the class string.
 */

/** `.billing-label` */
export const SHEET_LABEL = "mb-1.5 block text-[13px] font-semibold text-[#16202e]";
/** `.billing-field` */
export const SHEET_FIELD = "mb-3.5";
/** `.billing-input` - matched to the Stripe fields below it (`STRIPE_APPEARANCE`). */
export const SHEET_INPUT =
  "block h-11 w-full rounded-lg border bg-white px-3.5 py-3 text-[14px] text-[#16202e] transition-[border-color,box-shadow] duration-150 placeholder:text-[#9aa6ac] focus:outline-none disabled:cursor-not-allowed disabled:bg-[#fbfbfa]";
export const SHEET_INPUT_OK =
  "border-[#d7dee2] focus:border-[#4fc7c7] focus:shadow-[0_0_0_3px_rgba(79,199,199,0.18)]";
/** `.billing-input.is-invalid` - the border AND the message under it; colour alone is no signal. */
export const SHEET_INPUT_BAD =
  "border-[#b4231f] focus:shadow-[0_0_0_3px_rgba(180,35,31,0.15)]";
/** `.billing-fielderror` */
export const SHEET_FIELD_ERROR = "mt-1.5 text-[12.5px] leading-[1.4] text-[#b4231f]";
/** `.billing-error` - half a point larger than the mandate: it is read once, under pressure. */
export const SHEET_ERROR =
  "mt-6 rounded-[10px] border border-[#ffcccc] bg-[#fff1f1] px-3 py-2.5 text-[13.5px] leading-normal text-[#b4231f] [overflow-wrap:anywhere]";
/** `.billing-loading` */
export const SHEET_LOADING = "py-[18px] text-[14px] text-[#8a8d8b]";

/** `.btn-primary`'s look: the gradient, its glow, and the grey it turns when disabled. */
const PRIMARY_LOOK =
  "inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#00cbc6] to-[#00d5bf] text-white shadow-[0_4px_12px_rgba(0,203,198,0.28)] transition-[box-shadow,transform] duration-200 hover:shadow-[0_8px_22px_rgba(0,203,198,0.4)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-none disabled:bg-[#d9d9d6] disabled:shadow-none disabled:active:scale-100";
/** `.billing-actions .btn` - 44 high, the inputs' 8px radius. */
export const SHEET_PRIMARY = `${PRIMARY_LOOK} h-11 rounded-lg px-5 text-[14px] font-semibold`;
/** `.billing-done-btn` - 01-J's one button. */
export const SHEET_DONE = `${PRIMARY_LOOK} h-[66px] min-w-[169px] rounded-[14px] px-5 text-[18px] font-bold`;
/** `.btn-ghost` inside `.billing-actions`. */
export const SHEET_GHOST =
  "inline-flex h-11 items-center justify-center rounded-lg border border-[#d7dee2] bg-transparent px-5 text-[14px] font-semibold text-[#16202e] transition-colors duration-200 hover:bg-[#f5f5f3] disabled:cursor-not-allowed disabled:opacity-60";

/** `.billing-actions` - a narrow Cancel and a wide action, 150 : the rest; stacked on a phone. */
export const SHEET_PAIR = "mt-5 flex gap-3.5 max-[560px]:flex-col-reverse";
export const SHEET_PAIR_BACK = "flex-[0_0_150px] max-[560px]:w-full max-[560px]:flex-none";
export const SHEET_PAIR_MAIN = "flex-[1_1_auto] max-[560px]:w-full max-[560px]:flex-none";
/** `.billing-actions.is-single` - one button, centred: nothing to balance it against. */
export const SHEET_SINGLE = "mt-7 flex justify-center";

/** `.billing-list` - scrolls at ~3.5 rows, so a fourth is visibly cut off. */
export const SHEET_LIST =
  "m-0 grid max-h-[370px] list-none gap-2.5 overflow-y-auto overscroll-contain p-0.5";
/** `.billing-add` - a button styled as the design's link: it opens the form, it goes nowhere. */
export const SHEET_ADD =
  "mx-auto mt-[30px] block cursor-pointer border-0 bg-transparent px-2 py-1 text-[16px] font-normal text-[#18c4c7] hover:underline hover:underline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-50";
