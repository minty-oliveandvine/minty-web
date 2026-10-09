import { SHEET_REQUIRED } from "@/components/ui/sheetClasses";

/**
 * The red asterisk that says a field is mandatory.
 *
 * `aria-hidden`, because an asterisk read aloud is "star" - requiredness reaches assistive
 * tech from the CONTROL (`aria-required`, or the native `required`), never from this. Both
 * halves are needed: the mark for people who can see it, the attribute for people who cannot.
 */
export function RequiredMark() {
  return (
    <span className={SHEET_REQUIRED} aria-hidden>
      {" *"}
    </span>
  );
}
