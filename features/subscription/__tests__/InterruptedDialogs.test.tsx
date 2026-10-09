// When it fails or gets interrupted (Figma 06·B), rendered: the declined card named, the retry
// sentence only where a scheduled retry follows, Try again now / Done. A-11's "Leave without
// saving?" moved with its component - components/ui/__tests__/LeaveDialog.test.tsx.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  DONE,
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
