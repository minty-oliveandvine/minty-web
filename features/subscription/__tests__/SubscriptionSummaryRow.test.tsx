// The open row as a person sees it, per Figma 05·A frame: the cards, what sits under each, the
// panel in its simple and its current/future forms, the ⓘ line, the footer - and where a press
// on a tick, a Start Free Trial, Change or the chevron goes. Located by role and text.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  SUMMARY_FIXTURES,
  TODAY,
  WALLET,
  type SummaryFrame,
} from "@/features/subscription/__fixtures__/modulePage";
import { ENTITIES } from "@/features/subscription/__fixtures__/subscriptions";
import type { PortalEntity } from "@/features/subscription/api/payerPortal";
import {
  SubscriptionSummaryRow,
  type SummaryRowHandlers,
} from "@/features/subscription/components/SubscriptionSummaryRow";
import {
  CONFIRM_CHANGE,
  TRIAL_NOTICE,
  buildSummaryView,
  type PendingTicks,
  type SummaryView,
} from "@/features/subscription/lib/subscriptionSummary";

const entity: PortalEntity = { ...ENTITIES[0], entity_name: "Nexora Health Limited" };

function handlers(): SummaryRowHandlers {
  return {
    onClose: vi.fn(),
    onStartTrial: vi.fn(),
    onTick: vi.fn(),
    onConfirmChange: vi.fn(),
    onMenu: vi.fn(),
    onChangePaymentMethod: vi.fn(),
    onRetry: vi.fn(),
  };
}

function show(
  frame: SummaryFrame,
  wallet: typeof WALLET | null = WALLET,
  pending: PendingTicks = {},
) {
  const view: SummaryView = buildSummaryView(
    SUMMARY_FIXTURES[frame],
    entity,
    wallet,
    TODAY,
    pending,
  );
  const on = handlers();
  render(
    <ul>
      <SubscriptionSummaryRow
        entity={entity}
        status="ready"
        view={view}
        error={null}
        menu={["request_transfer", "cancel_subscription"]}
        on={on}
      />
    </ul>,
  );
  return { on, view };
}

const panel = () => screen.getByRole("region", { name: "Subscription Summary" });

describe("SubscriptionSummaryRow", () => {
  it("M44: both active - two ticked live cards, the bundle, the card on file, no pending changes", async () => {
    const { on, view } = show("M44");
    expect(
      screen.getByRole("heading", { level: 3, name: "Nexora Health Limited" }),
    ).toBeInTheDocument();
    for (const name of ["Petty Cash", "Payment Request"]) {
      const card = screen.getByRole("article", { name });
      expect(card).toHaveAttribute("data-ticked", "true");
      expect(within(card).getByText("Active")).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: `${name} subscription` })).toBeChecked();
    }
    expect(screen.queryByText(TRIAL_NOTICE)).not.toBeInTheDocument();

    const p = panel();
    expect(within(p).getByText("Selected plan")).toBeInTheDocument();
    expect(within(p).getByText("Super Minty")).toBeInTheDocument();
    expect(within(p).getByText("Payment method")).toBeInTheDocument();
    expect(within(p).getByText("Visa 4121")).toBeInTheDocument();
    expect(within(p).getByText("HK$400")).toBeInTheDocument();
    expect(within(p).getByText("/month")).toBeInTheDocument();
    expect(within(p).getByText("No pending changes")).toBeInTheDocument();

    await userEvent.click(within(p).getByRole("button", { name: "Change" }));
    expect(on.onChangePaymentMethod).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("checkbox", { name: "Petty Cash subscription" }));
    expect(on.onTick).toHaveBeenCalledWith("PETTY_CASH");
    expect(screen.queryByRole("button", { name: CONFIRM_CHANGE })).not.toBeInTheDocument();

    // The footer's first sentence carries the company's name in its own span.
    const footer = screen.getAllByText(
      (_, el) => el?.tagName === "P" && /was originally created/.test(el.textContent ?? ""),
    );
    expect(footer[0]).toHaveTextContent(
      `Minty for Nexora Health Limited was originally created ${view.footer.createdOn}.`,
    );
    expect(screen.getByText(/Your next subscription renewal date is/)).toBeInTheDocument();
  });

  it("M11: nothing started - Start Free Trial under each card, no module selected, HK$0 greyed", async () => {
    // No card nominated yet either - the panel has no payment-method column.
    const { on } = show("M11", null);
    const buttons = screen.getAllByRole("button", { name: /^Start Free Trial ·/ });
    expect(buttons).toHaveLength(2);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(panel()).getByText("No module selected")).toBeInTheDocument();
    expect(within(panel()).getByText("HK$0").parentElement).toHaveAttribute("data-greyed", "true");
    expect(within(panel()).queryByText("Payment method")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Start Free Trial · Payment Request" }),
    );
    expect(on.onStartTrial).toHaveBeenCalledWith("PAYMENT_REQUEST");
  });

  it("M21: a trial - the ⓘ line, an unticked box that confirms, Free Trial at HK$0", async () => {
    const { on } = show("M21");
    expect(screen.getByText(TRIAL_NOTICE)).toBeInTheDocument();
    const box = screen.getByRole("checkbox", { name: "Petty Cash subscription" });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(on.onTick).toHaveBeenCalledWith("PETTY_CASH");
    const p = panel();
    expect(within(p).getByText("Petty Cash")).toBeInTheDocument();
    expect(within(p).getByText("(Free Trial)")).toBeInTheDocument();
    expect(within(p).getByText("HK$0")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Petty Cash" })).toHaveAttribute(
      "data-ticked",
      "false",
    );
  });

  it("M45: current and future blocks, the singles' sum struck, the survivor 'only'", () => {
    show("M45");
    const p = panel();
    expect(within(p).getByText(/Current Subscription/)).toBeInTheDocument();
    expect(within(p).getByText("(Active)")).toBeInTheDocument();
    expect(within(p).getByText("(Cancellation in progress)")).toBeInTheDocument();
    expect(within(p).getByText("HK$560")).toBeInTheDocument();
    expect(within(p).getByText("HK$400")).toBeInTheDocument();
    expect(within(p).getByText(/Future Subscription/)).toBeInTheDocument();
    expect(within(p).getByText("only")).toBeInTheDocument();
    expect(within(p).getByText("HK$280")).toBeInTheDocument();
    expect(within(p).queryByText("No pending changes")).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Payment Request subscription" }),
    ).not.toBeChecked();
  });

  it("M61: suspended - unticked, reactivate on press", async () => {
    const { on } = show("M61");
    expect(
      within(screen.getByRole("article", { name: "Petty Cash" })).getByText(
        "Subscription Suspended",
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Petty Cash subscription" }));
    expect(on.onTick).toHaveBeenCalledWith("PETTY_CASH");
  });

  it("V44: a tick pending - the chip, the future the tick says, Confirm Subscription Change", async () => {
    const { on, view } = show("M44", WALLET, { PETTY_CASH: false });
    const pc = screen.getByRole("article", { name: "Petty Cash" });
    expect(pc).toHaveAttribute("data-ticked", "false");
    expect(within(pc).getByText("Removing")).toHaveAttribute("data-chip", "Removing");
    expect(screen.getByRole("checkbox", { name: "Petty Cash subscription" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Petty Cash subscription" })).toHaveAttribute(
      "data-changed",
      "true",
    );
    expect(screen.getByRole("article", { name: "Payment Request" })).toHaveAttribute(
      "data-ticked",
      "true",
    );
    const p = panel();
    expect(within(p).getByText(/Current Subscription/)).toBeInTheDocument();
    expect(within(p).getByText("HK$560")).toBeInTheDocument();
    expect(within(p).getByText(/Future Subscription/)).toBeInTheDocument();
    expect(within(p).getByText("only")).toBeInTheDocument();

    await userEvent.click(within(p).getByRole("button", { name: CONFIRM_CHANGE }));
    expect(on.onConfirmChange).toHaveBeenCalledWith(view.pendingChange);
    expect(view.pendingChange).toMatchObject({ code: "PETTY_CASH", seam: "cancel" });
  });

  it("V21: ticking a trial - Adding, teal; NX21a: unticking a confirmed trial - no chip, no future", () => {
    show("M21", WALLET, { PETTY_CASH: true });
    const pc = screen.getByRole("article", { name: "Petty Cash" });
    expect(pc).toHaveAttribute("data-ticked", "true");
    expect(within(pc).getByText("Adding")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: CONFIRM_CHANGE })).toBeInTheDocument();
  });

  it("NX21a: unticking a confirmed trial - no chip, the trial now and no future block", () => {
    show("N21a", WALLET, { PETTY_CASH: false });
    const pc = screen.getByRole("article", { name: "Petty Cash" });
    expect(pc).toHaveAttribute("data-ticked", "false");
    expect(within(pc).queryByText(/Adding|Removing|Restoring/)).not.toBeInTheDocument();
    const p = panel();
    expect(within(p).getByText("(Free Trial)")).toBeInTheDocument();
    expect(within(p).queryByText(/Future Subscription/)).not.toBeInTheDocument();
    expect(within(p).getByRole("button", { name: CONFIRM_CHANGE })).toBeInTheDocument();
  });

  it("the chevron closes, the ⋮ carries the row's items", async () => {
    const { on } = show("M44");
    await userEvent.click(screen.getByRole("button", { name: "Close Nexora Health Limited" }));
    expect(on.onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Nexora Health Limited" }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Cancel subscription" }));
    expect(on.onMenu).toHaveBeenCalledWith("cancel_subscription");
  });

  it("05·B-C: calculating - the cards stay, the panel says so, nothing to confirm yet", () => {
    const on = handlers();
    const view = buildSummaryView(SUMMARY_FIXTURES.M44, entity, WALLET, TODAY, {
      PETTY_CASH: false,
    });
    render(
      <ul>
        <SubscriptionSummaryRow
          entity={entity}
          status="ready"
          calculating
          view={view}
          error={null}
          menu={[]}
          on={on}
        />
      </ul>,
    );
    const panel = screen.getByRole("region", { name: "Subscription Summary" });
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(within(panel).getByRole("status")).toHaveTextContent("Calculating");
    expect(panel.querySelector("img")).toHaveAttribute("src", "/portal/minty-counting.png");
    expect(screen.queryByRole("button", { name: "Confirm Subscription Change" })).toBeNull();
    // The cards already show the change.
    expect(screen.getByRole("checkbox", { name: "Petty Cash subscription" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Petty Cash subscription" })).toBeEnabled();
  });

  it("05·B-C: loading with the list's cards - drawn, but waiting for the page model", () => {
    const on = handlers();
    const view = buildSummaryView(SUMMARY_FIXTURES.M45, entity, null, TODAY);
    render(
      <ul>
        <SubscriptionSummaryRow
          entity={entity}
          status="loading"
          calculating
          view={view}
          error={null}
          menu={[]}
          on={on}
        />
      </ul>,
    );
    expect(screen.getByRole("checkbox", { name: "Petty Cash subscription" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Calculating");
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  it("says when it is loading and when it could not load, with a retry", async () => {
    const on = handlers();
    const { rerender } = render(
      <ul>
        <SubscriptionSummaryRow
          entity={entity}
          status="loading"
          view={null}
          error={null}
          menu={[]}
          on={on}
        />
      </ul>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    rerender(
      <ul>
        <SubscriptionSummaryRow
          entity={entity}
          status="error"
          view={null}
          error="We couldn’t load this subscription."
          menu={[]}
          on={on}
        />
      </ul>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("We couldn’t load this subscription.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(on.onRetry).toHaveBeenCalledTimes(1);
  });
});
