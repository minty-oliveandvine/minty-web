// The portal's back line is drawn by the page but sits in the header bar (2026-09-29): inside
// the provider it lands in the header's slot, never in the page; outside it (a screen's own
// tests) it stays where the page put it.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  PortalBack,
  PortalBackProvider,
  PortalBackSlot,
} from "@/features/subscription/components/PortalBack";
import { PortalHero } from "@/features/subscription/components/PortalHero";

describe("PortalBack", () => {
  it("draws the page's back line in the header slot", () => {
    const onBack = vi.fn();
    render(
      <PortalBackProvider>
        <header>
          <PortalBackSlot />
        </header>
        <main>
          <PortalHero title="Manage Subscriptions" onBack={onBack} />
        </main>
      </PortalBackProvider>,
    );

    const back = within(screen.getByRole("banner")).getByRole("button", {
      name: "Back to the previous page",
    });
    back.click();
    expect(onBack).toHaveBeenCalledOnce();
    expect(within(screen.getByRole("main")).queryByText("Back to the previous page")).toBeNull();
  });

  it("leaves the slot empty on a page with no back line of its own", () => {
    render(
      <PortalBackProvider>
        <header>
          <PortalBackSlot />
        </header>
        <PortalHero title="Transfer Subscription" />
      </PortalBackProvider>,
    );
    expect(screen.getByRole("banner")).toHaveTextContent("");
  });

  it("stays in the page outside the portal's frame", () => {
    render(
      <PortalBack>
        <a href="/x">Back to the entity dashboard</a>
      </PortalBack>,
    );
    expect(screen.getByRole("link", { name: "Back to the entity dashboard" })).toBeInTheDocument();
  });
});
