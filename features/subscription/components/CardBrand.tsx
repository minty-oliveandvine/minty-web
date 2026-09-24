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

export function CardBrand({
  brand,
  label,
  className = "h-[30px] w-[46px]",
}: {
  /** Stripe's brand id (`visa`, `american_express`, …). Any casing or separator. */
  brand?: string | null;
  /** The server's display name ("Visa", "Apple Pay"), used when the brand id is unknown. */
  label?: string | null;
  /** Where the mark is DRESSED — the summary draws it large, the picker small. */
  className?: string;
}) {
  const key = (brand || "").toLowerCase().replace(/[\s-]/g, "_");
  const name = label || (brand ? brand.replace(/_/g, " ") : "Card");

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
    return shell(
      <svg viewBox="0 0 46 30" className="h-full w-full" role="presentation">
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

  return shell(
    <svg viewBox="0 0 46 30" className="h-full w-full" role="presentation">
      <text
        x="23"
        y="15"
        textAnchor="middle"
        dominantBaseline="central"
        fill={ink}
        /* Shrinks to fit rather than overflowing — `textLength` with `spacingAndGlyphs` is the
           only way to hold an unknown-length wordmark inside a fixed box without measuring
           text in JavaScript. */
        textLength={Math.min(38, Math.max(14, text.length * 6.2))}
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
