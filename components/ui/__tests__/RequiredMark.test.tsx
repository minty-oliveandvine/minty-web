// Mandatory fields say so BEFORE anything is attempted.
//
// This repo had no required marker at all: eighteen mandatory fields, none marked, and the
// only feedback on several forms was a disabled button. The pairing is the point - a red
// asterisk for the eye, `aria-required` on the control for everyone else - so both halves are
// asserted here, per form, from the outside.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RequiredMark } from "@/components/ui/RequiredMark";

describe("the mark itself", () => {
  it("is an asterisk", () => {
    const { container } = render(
      <label>
        Email
        <RequiredMark />
      </label>,
    );

    expect(container.textContent).toContain("*");
  });

  it("is hidden from a reader, because an asterisk read aloud is 'star'", () => {
    const { container } = render(<RequiredMark />);

    expect(container.querySelector("span")).toHaveAttribute("aria-hidden");
  });

  it("leaves the field's accessible name alone", () => {
    render(
      <>
        <label htmlFor="f">
          Email
          <RequiredMark />
        </label>
        <input id="f" aria-required="true" />
      </>,
    );

    // The accessible NAME skips aria-hidden content, so assistive tech hears "Email",
    // required - not "Email star".
    expect(screen.getByRole("textbox")).toHaveAccessibleName("Email");
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-required", "true");
  });
});
