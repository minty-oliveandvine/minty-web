// When it fails or gets interrupted (Figma 06·B), rendered: the declined card named, the retry
// sentence only where a scheduled retry follows, Try again now / Done; Leave without saving?
// with Discard changes / Go Back - Escape takes the safe way out of each.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  DISCARD_CHANGES,
  DONE,
  GO_BACK_UPPER,
  LEAVE_TITLE,
  LeaveDialog,
  PAYMENT_FAILED_RETRY,
  PAYMENT_FAILED_TITLE,
  PaymentFailedDialog,
  TRY_AGAIN_NOW,
} from "@/features/subscription/components/InterruptedDialogs";

describe("PaymentFailedDialog (A-05)", () => {
  it("names the card, says a retry is scheduled when one is, and offers to try again now", async () => {
    const onTryAgain = vi.fn();
    const onDone = vi.fn();
    render(
      <PaymentFailedDialog
        card="Visa 4121"
        autoRetry
        busy={false}
        onTryAgain={onTryAgain}
        onDone={onDone}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName(PAYMENT_FAILED_TITLE);
    expect(within(dialog).getByText("Visa 4121")).toHaveClass("text-[#ea9713]");
    expect(within(dialog).getByText(PAYMENT_FAILED_RETRY)).toBeInTheDocument();
    expect(within(dialog).getByText(/If you've resolved the issue/)).toBeInTheDocument();
    expect(within(dialog).queryByText("Entity")).toBeNull();
    expect(dialog.querySelector("img")).toHaveAttribute("data-image", "payment_failed");
    const retry = within(dialog).getByRole("button", { name: TRY_AGAIN_NOW });
    expect(retry).toHaveAttribute("data-tone", "teal");
    await userEvent.click(retry);
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    await userEvent.click(within(dialog).getByRole("button", { name: DONE }));
    expect(onDone).toHaveBeenCalledTimes(1);
    // Escape is Done, not another attempt.
    await userEvent.keyboard("{Escape}");
    expect(onDone).toHaveBeenCalledTimes(2);
    expect(onTryAgain).toHaveBeenCalledTimes(1);
  });

  it("without a scheduled retry the first sentence is left out; without a card, no card line", () => {
    render(
      <PaymentFailedDialog
        card={null}
        autoRetry={false}
        busy={false}
        onTryAgain={vi.fn()}
        onDone={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText(PAYMENT_FAILED_RETRY)).toBeNull();
    expect(within(dialog).getByText(/feel free to try again/)).toBeInTheDocument();
  });
});

describe("LeaveDialog (A-11)", () => {
  it("asks, and Escape stays", async () => {
    const onDiscard = vi.fn();
    const onStay = vi.fn();
    render(<LeaveDialog onDiscard={onDiscard} onStay={onStay} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName(LEAVE_TITLE);
    expect(within(dialog).getByText("You have unsaved changes.")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Your changes will be lost if you leave this page."),
    ).toBeInTheDocument();
    expect(dialog.querySelector("img")).toHaveAttribute("data-image", "dont");
    await userEvent.click(within(dialog).getByRole("button", { name: DISCARD_CHANGES }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    await userEvent.click(within(dialog).getByRole("button", { name: GO_BACK_UPPER }));
    expect(onStay).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    expect(onStay).toHaveBeenCalledTimes(2);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
