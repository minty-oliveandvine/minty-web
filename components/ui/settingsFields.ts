/**
 * The settings tabs' fields (Figma SET-G, 2026-11-10): radius 12, the frames' edge, 14.5px text,
 * at least 44px high; the teal ring on focus. A refused field keeps the sheets' red border and
 * message (`components/ui/sheetClasses.ts`), so colour is never the only signal.
 */

export { SHEET_FIELD_ERROR as SETTINGS_FIELD_ERROR } from "@/components/ui/sheetClasses";
import { SHEET_INPUT_BAD } from "@/components/ui/sheetClasses";

export { SHEET_INPUT_BAD as SETTINGS_INPUT_BAD };

export const SETTINGS_INPUT =
  "block min-h-11 w-full rounded-[12px] border bg-white px-3.5 py-3 text-[14.5px] text-set-ink transition-[border-color,box-shadow] duration-150 focus:outline-none disabled:cursor-not-allowed disabled:bg-set-pill";
export const SETTINGS_INPUT_OK =
  "border-set-edge focus:border-set-tab focus:shadow-[0_0_0_3px_rgba(54,195,180,0.18)]";
export const SETTINGS_LABEL = "mb-1.5 block text-[13px] font-semibold text-set-ink";

/** A field's own problem as it is typed: the red edge (`SETTINGS_INPUT_BAD`) or the usual one. */
export function settingsInputClass(invalid: boolean): string {
  return `${SETTINGS_INPUT} ${invalid ? SHEET_INPUT_BAD : SETTINGS_INPUT_OK}`;
}
