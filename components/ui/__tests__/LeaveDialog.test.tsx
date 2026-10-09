// "Leave without saving?" (Figma A-11) rendered: both sentences, the "dont" image, Discard
// changes / Go Back - and Escape takes the safe way out (stay), not the destructive one.
// What ASKS is `lib/leaveGuard.ts`; its own tests cover which exits are held.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DISCARD_CHANGES, GO_BACK_UPPER, LEAVE_TITLE, LeaveDialog } from "@/components/ui/LeaveDialog";

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
