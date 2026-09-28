/**
 * The network mark on a saved card — the thing above "Visa 4121" in the summary, and beside
 * "Visa ending in 4121" in the picker.
 *
 * NOT THE ISSUERS' OFFICIAL ARTWORK, and deliberately not a trace of it. Each network
 * publishes its logo under a brand licence with its own rules about colour, clear space and
 * minimum size; a hand-drawn approximation of a registered mark is worse than an honest one,
 * because it looks close enough to pass and is wrong in the ways the licence is about. What
 * this draws instead is the network's NAME in its own colour — recognisable at a glance,
 * obviously ours, and correct for every brand including the ones nobody has drawn yet.
 *
 * Mastercard is the exception: its two interlocking circles are a geometric figure rather than
 * a wordmark, so they are drawn as circles.
 *
 * SO THE FALLBACK IS THE POINT. Stripe returns brands this file has never heard of
 * (`cartes_bancaires`, `eftpos_au`, and whatever ships next), and a wallet returns no card
 * brand at all. Every one of those gets a readable mark from the label the server already
 * derived, rather than a blank space where the other rows have one.
 *
 * Ported from onboarding's `components/CardBrand.tsx` — same marks, same fallback, dressed in
 * Tailwind instead of `globals.css` because that is how this app draws. A card must look the
 * same in both, so the two are kept in step deliberately.
 */

import type { ReactNode } from "react";

/* Each network's own colour, used for the wordmark. Anything absent falls through to the
   neutral ink below — grey is a fine answer for a brand we cannot name a colour for, and
   inventing one would be a guess presented as a fact. */
const BRAND_INK: Record<string, string> = {
  visa: "#1A1F71",
  amex: "#006FCF",
  american_express: "#006FCF",
  discover: "#E1621E",
  diners: "#0079BE",
  diners_club: "#0079BE",
  jcb: "#0B4EA2",
  unionpay: "#E21836",
  union_pay: "#005BAC",
  eftpos_au: "#0F7A6E",
  cartes_bancaires: "#153E7B",
};

/* Long names in a short box. The wordmark is what identifies the card, so it is shortened
   rather than shrunk to illegibility or clipped. */
const SHORT: Record<string, string> = {
  american_express: "AMEX",
  amex: "AMEX",
  diners_club: "DINERS",
  diners: "DINERS",
  cartes_bancaires: "CB",
  unionpay: "UNIONPAY",
  union_pay: "UNIONPAY",
  eftpos_au: "EFTPOS",
};

/**
 * The summaries' logo slot (05·A, 07-D here; onboarding's 01-C uses the same), for
 * `fit="mark"`: 74 wide and as tall as the mark, never over 42 - so VISA's letters land
 * 73 x 24 as 05·A draws them, and Mastercard 63 x 42 where 01-C draws it 68 x 42.
 */
export const SUMMARY_MARK = "w-[74px]";

/* The field every mark is drawn on: a card's proportions, the mark in its middle. */
const TILE = { viewBox: "0 0 46 30", className: "h-full w-full" };
/* Mastercard's two circles, and nothing around them. */
const CIRCLES = { x: 9.5, y: 6, w: 27, h: 18 };
/* A wordmark's capitals, y 10-20.5 (in Inter and in the system fallback). */
const CAPS = { y: 10, h: 10.5 };
/* The narrowest wordmark crop: a four-letter one's (VISA, AMEX). A two-letter mark ("CB")
   cropped to itself would be drawn as tall as Mastercard's circles. */
const MIN_CROP = 4 * 6.2;

/* A cropped mark's own width and height go on the <svg> too: they are its intrinsic ratio,
   which `h-auto` sizes it by - as wide as its slot, as tall as the mark, at most 42px. */
function cropped(x: number, y: number, w: number, h: number) {
  return {
    viewBox: `${x} ${y} ${w} ${h}`,
    width: w,
    height: h,
    preserveAspectRatio: "xMaxYMid meet",
    className: "block h-auto max-h-[42px] w-full",
  };
}

export function CardBrand({
  brand,
  label,
  className = "h-[30px] w-[46px]",
  fit = "tile",
}: {
  /** Stripe's brand id (`visa`, `american_express`, …). Any casing or separator. */
  brand?: string | null;
  /** The server's display name ("Visa", "Apple Pay"), used when the brand id is unknown. */
  label?: string | null;
  /** Where the mark is DRESSED — the summary draws it large, the picker small. */
  className?: string;
  /**
   * `tile` (the default): the mark in the middle of a card-shaped field, as a list row draws
   * it. `mark`: the same drawing with that field cropped away, so the mark itself fills the
   * width, flush right — the summaries' logo slot (`SUMMARY_MARK`), where the design draws
   * the network's logo bare. Only the viewBox changes: the marks stay the ones onboarding
   * draws, and onboarding's copy has the same two fits.
   */
  fit?: "tile" | "mark";
}) {
  const key = (brand || "").toLowerCase().replace(/[\s-]/g, "_");
  const name = label || (brand ? brand.replace(/_/g, " ") : "Card");
  const mark = fit === "mark";

  // Decoration beside a row that already says "Visa ending in 4121" in words. Announcing the
  // brand a second time is noise in a screen reader, so the mark is hidden from the
  // accessibility tree rather than labelled.
  // INLINE-BLOCK, always. A bare <span> is inline, so the width and height the caller passes
  // are ignored and the SVG inside (`h-full w-full`) resolves against whatever contains it -
  // which drew the mark at the full width of its column. It only looked right while every
  // caller happened to place it as a flex item, where the browser blocks it for them.
  const shell = (children: ReactNode) => (
    <span
      className={`inline-block ${className}`}
      aria-hidden="true"
      title={name}
      data-brand={key || "unknown"}
    >
      {children}
    </span>
  );

  if (key === "mastercard" || key === "master_card") {
    const frame = mark ? cropped(CIRCLES.x, CIRCLES.y, CIRCLES.w, CIRCLES.h) : TILE;
    return shell(
      <svg {...frame} role="presentation">
        <circle cx="18.5" cy="15" r="9" fill="#EB001B" />
        <circle cx="27.5" cy="15" r="9" fill="#F79E1B" />
        {/* The overlap is its own shape rather than an opacity trick: two translucent circles
            over white give a washed-out lozenge, not Mastercard's solid amber intersection. */}
        <path d="M23 8.2a9 9 0 0 0 0 13.6 9 9 0 0 0 0-13.6Z" fill="#FF5F00" />
      </svg>,
    );
  }

  const ink = BRAND_INK[key] || "#4A4D4B";
  const text = SHORT[key] || name.toUpperCase();
  // Shrinks to fit rather than overflowing — `textLength` with `spacingAndGlyphs` is the only
  // way to hold an unknown-length wordmark inside a fixed box without measuring text in
  // JavaScript.
  const length = Math.min(38, Math.max(14, text.length * 6.2));
  // Cropped to the wordmark, flush right; visible overflow keeps an italic's slant.
  const crop = Math.max(length, MIN_CROP);
  const frame = mark
    ? { ...cropped(23 + length / 2 - crop, CAPS.y, crop, CAPS.h), overflow: "visible" }
    : TILE;

  return shell(
    <svg {...frame} role="presentation">
      <text
        x="23"
        y="15"
        textAnchor="middle"
        dominantBaseline="central"
        fill={ink}
        textLength={length}
        lengthAdjust="spacingAndGlyphs"
        fontSize="11"
        fontWeight="800"
        fontStyle={key === "visa" ? "italic" : "normal"}
        letterSpacing="0.02em"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {text}
      </text>
    </svg>,
  );
}
