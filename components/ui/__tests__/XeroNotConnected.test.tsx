// The one "Xero isn't connected" notice (owner, 2026-11-12: Petty Cash Settings drew it grey while
// Payment Settings drew it red; both are this one now).

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { XeroNotConnected } from "@/components/ui/XeroNotConnected";

describe("XeroNotConnected", () => {
  it("says what to do and links to the Integration tab", () => {
    render(<XeroNotConnected href="/entity/e1/olive-shop/settings/integration" />);

    const box = screen.getByRole("status");
    expect(box).toHaveTextContent(
      "Xero isn't connected. Connect it in Integration to set these up.",
    );
    expect(within(box).getByRole("link", { name: "Integration" })).toHaveAttribute(
      "href",
      "/entity/e1/olive-shop/settings/integration",
    );
    expect(box).toHaveAttribute("data-xero-not-connected");
  });

  it("is drawn in the danger tint with the red link-off icon", () => {
    render(<XeroNotConnected href="/x" />);

    const box = screen.getByRole("status");
    expect(box.className).toContain("bg-set-warn-bg");
    expect(box.className).toContain("border-set-danger-line/40");
    expect(box.querySelector("[aria-hidden]")).toHaveTextContent("link_off");
    expect(box.querySelector("[aria-hidden]")?.className).toContain("text-danger");
  });
});
