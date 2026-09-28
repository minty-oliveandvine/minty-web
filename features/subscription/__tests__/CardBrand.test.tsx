// The network mark's two fits. `tile` is onboarding's look, unchanged: the mark in the middle of
// a card-shaped field. `mark` is the same drawing with that field cropped away, so the mark fills
// the summaries' logo slot (Figma 05·A / 07-D) instead of sitting small in the middle of it.

import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { CardBrand, SUMMARY_MARK } from "@/features/subscription/components/CardBrand";

const svgOf = (ui: ReactElement) => render(ui).container.querySelector("svg")!;

describe("CardBrand", () => {
  it("draws on the card-shaped field by default, as onboarding does", () => {
    for (const brand of ["visa", "mastercard"]) {
      const svg = svgOf(<CardBrand brand={brand} />);
      expect(svg).toHaveAttribute("viewBox", "0 0 46 30");
      expect(svg).not.toHaveAttribute("preserveAspectRatio");
      expect(svg).not.toHaveAttribute("width");
    }
  });

  it("crops a wordmark to its own width and its capitals' height", () => {
    // VISA's four letters are 24.8 units wide, centred on x=23.
    const visa = svgOf(<CardBrand brand="visa" fit="mark" />);
    const [x, y, w, h] = visa.getAttribute("viewBox")!.split(" ").map(Number);
    expect(x).toBeCloseTo(23 - 24.8 / 2);
    expect(w).toBeCloseTo(24.8);
    expect([y, h]).toEqual([10, 10.5]);
    expect(visa).toHaveAttribute("preserveAspectRatio", "xMaxYMid meet");
    expect(visa.querySelector("text")).toHaveAttribute("textLength", String(w));
    // The crop's own size is the svg's intrinsic ratio, which `h-auto` sizes it by.
    expect(Number(visa.getAttribute("width"))).toBeCloseTo(w);
    expect(Number(visa.getAttribute("height"))).toBe(h);

    // A long name keeps the tile's cap, so the crop never grows past it.
    const long = svgOf(<CardBrand brand="unionpay" fit="mark" />);
    expect(long.getAttribute("viewBox")!.split(" ").map(Number)[2]).toBe(38);
  });

  it("never crops narrower than a four-letter mark, so a short one is not drawn huge", () => {
    // CB is 14 units wide; cropped to itself it would stand as tall as Mastercard.
    const cb = svgOf(<CardBrand brand="cartes_bancaires" fit="mark" />);
    const [x, , w] = cb.getAttribute("viewBox")!.split(" ").map(Number);
    expect(w).toBeCloseTo(24.8);
    expect(x + w).toBeCloseTo(23 + 14 / 2); // flush right: the crop ends where CB does
  });

  it("crops Mastercard to its two circles", () => {
    const svg = svgOf(<CardBrand brand="mastercard" fit="mark" />);
    expect(svg).toHaveAttribute("viewBox", "9.5 6 27 18");
    expect(svg).toHaveAttribute("width", "27");
    expect(svg).toHaveAttribute("height", "18");
    expect(svg.querySelectorAll("circle")).toHaveLength(2);
  });

  it("an unknown brand still gets a readable mark from its label", () => {
    const { container } = render(
      <CardBrand brand="link" label="Link" fit="mark" className={SUMMARY_MARK} />,
    );
    expect(container.querySelector("text")).toHaveTextContent("LINK");
    expect(container.firstElementChild).toHaveAttribute("data-brand", "link");
  });
});
