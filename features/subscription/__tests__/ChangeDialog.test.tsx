// The confirmation modal rendered (Figma section 06): the module's name in its colour in the
// title, the company, the sentences with their bold and coloured runs, Minty's mood, the
// confirming button in its tone; Go back, Escape and the backdrop go back, nothing while busy.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SUMMARY_FIXTURES } from "@/features/subscription/__fixtures__/modulePage";
import { ChangeDialog } from "@/features/subscription/components/ChangeDialog";
import { buildChangeModal } from "@/features/subscription/lib/changeModal";

function show(
  codes: ("PETTY_CASH" | "PAYMENT_REQUEST")[],
  page = SUMMARY_FIXTURES.M44,
  busy = false,
) {
  const onConfirm = vi.fn();
  const onBack = vi.fn();
  const modal = buildChangeModal(page, codes)!;
  render(
    <ChangeDialog
      modal={modal}
      entityName="Nexora Health Limited"
      busy={busy}
      onConfirm={onConfirm}
      onBack={onBack}
    />,
  );
  return { onConfirm, onBack, dialog: screen.getByRole("dialog") };
}

describe("ChangeDialog", () => {
  it("Remove Petty Cash? - the name in its colour, the two sentences, Confirm Change in orange", async () => {
    const { dialog, onConfirm, onBack } = show(["PETTY_CASH"]);
    expect(dialog).toHaveAccessibleName("Remove Petty Cash?");
    expect(within(dialog).getByText("Petty Cash")).toHaveClass("text-[#ea9713]");
    expect(within(dialog).getByText("Nexora Health Limited")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/You've chosen to remove Petty Cash\. You'll still have access/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/Your other module will stay active/)).toBeInTheDocument();
    expect(dialog.querySelector("img")).toHaveAttribute("data-image", "surprised");
    const confirm = within(dialog).getByRole("button", { name: "Confirm Change" });
    expect(confirm).toHaveAttribute("data-tone", "orange");
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(within(dialog).getByRole("button", { name: "Go back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    expect(onBack).toHaveBeenCalledTimes(2);
  });

  it("Cancel Subscription? - the red button, Minty sad", () => {
    const { dialog } = show(["PETTY_CASH", "PAYMENT_REQUEST"]);
    expect(dialog).toHaveAccessibleName("Cancel Subscription?");
    expect(within(dialog).getByText("No modules are selected.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm Cancellation" })).toHaveAttribute(
      "data-tone",
      "red",
    );
    expect(dialog.querySelector("img")).toHaveAttribute("data-image", "sad");
  });

  it("You have unlocked Super Minty - the bundle's name in teal, Minty in a cape", () => {
    const { dialog } = show(["PETTY_CASH", "PAYMENT_REQUEST"], SUMMARY_FIXTURES.M22);
    expect(dialog).toHaveAccessibleName("You have unlocked Super Minty");
    expect(within(dialog).getByText("Super Minty")).toHaveClass("text-[#18c4c7]");
    expect(within(dialog).getByRole("button", { name: "Confirm" })).toHaveAttribute(
      "data-tone",
      "teal",
    );
    expect(dialog.querySelector("img")).toHaveAttribute("data-image", "super");
  });

  it("Subscription Changes - the modules in colour, removed and added in bold", () => {
    const { dialog } = show(["PETTY_CASH", "PAYMENT_REQUEST"], SUMMARY_FIXTURES.M45);
    expect(dialog).toHaveAccessibleName("Subscription Changes");
    const p = within(dialog)
      .getByText(/will be/)
      .closest("p")!;
    expect(within(p).getByText("Petty Cash")).toHaveClass("text-[#ea9713]");
    expect(within(p).getByText("Payment Request")).toHaveClass("text-[#2e6ff2]");
    expect(within(p).getByText("removed").tagName).toBe("STRONG");
    expect(within(p).getByText("added").tagName).toBe("STRONG");
    expect(within(dialog).getByRole("button", { name: "Confirm Changes" })).toBeInTheDocument();
  });

  it("while the change is being applied nothing closes it", async () => {
    const { dialog, onBack, onConfirm } = show(["PETTY_CASH"], SUMMARY_FIXTURES.M44, true);
    expect(within(dialog).getByRole("button", { name: "Confirm Change" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(onBack).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
