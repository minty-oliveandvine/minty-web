// The result screens rendered (Figma 05·C): the row layout (Congratulations / Subscription
// updated, the lines in the modules' colours, the money, the footer, Minty celebrating) and the
// page layout (the headline with the module in colour, the company, the three paragraphs with
// the date bold, Minty with a heart). Located by role and text.

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RESULT_FIXTURES, TODAY } from "@/features/subscription/__fixtures__/modulePage";
import { ENTITIES } from "@/features/subscription/__fixtures__/subscriptions";
import {
  ChangeResultPage,
  ChangeResultRow,
} from "@/features/subscription/components/ChangeResultView";
import { BACK_TO_LIST, buildChangeResult } from "@/features/subscription/lib/changeResult";
import type { MenuItem } from "@/features/subscription/lib/portalRows";

const entity = ENTITIES[0];
const MENU: MenuItem[] = ["request_transfer", "cancel_subscription"];

function result(frame: keyof typeof RESULT_FIXTURES) {
  const { before, asked, after } = RESULT_FIXTURES[frame];
  return buildChangeResult(asked, before, after, entity, TODAY);
}

describe("ChangeResultRow", () => {
  const row = (frame: keyof typeof RESULT_FIXTURES) => {
    render(
      <ul>
        <ChangeResultRow
          entity={entity}
          result={result(frame)}
          menu={MENU}
          onMenu={vi.fn()}
          onBack={vi.fn()}
        />
      </ul>,
    );
    return screen.getByRole("listitem");
  };

  it("the standing terms are under every result row, with or without a renewal date", () => {
    // RU22 bills nothing yet (two confirmed trials), so the date is the soonest trial's end.
    const confirmed = row("RU22");
    expect(within(confirmed).getByText(/Your next subscription renewal date is/)).toHaveTextContent(
      `Your next subscription renewal date is ${result("RU22").footer.renewalOn} and each month after.`,
    );
    expect(
      within(confirmed).getByText(/auto-renew monthly until cancellation is initiated/),
    ).toBeInTheDocument();
    expect(
      within(confirmed).getByText(/1 month notice period required for your cancellation/),
    ).toBeInTheDocument();

    // RNX21a's trial is cancelled: nothing renews, so there is no date - and the terms remain.
    screen.getAllByRole("listitem").forEach((li) => li.remove());
    const stopped = row("RNX21a");
    expect(within(stopped).queryByText(/Your next subscription renewal date is/)).toBeNull();
    expect(
      within(stopped).getByText(/auto-renew monthly until cancellation is initiated/),
    ).toBeInTheDocument();
  });

  it("RU22: Congratulations, a line per module in its colour, the money, the footer, the way back", async () => {
    const onBack = vi.fn();
    const onMenu = vi.fn();
    render(
      <ul>
        <ChangeResultRow
          entity={entity}
          result={result("RU22")}
          menu={MENU}
          onMenu={onMenu}
          onBack={onBack}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row).toHaveAttribute("data-result", "celebrate");
    expect(within(row).getByRole("heading", { level: 3 })).toHaveTextContent(entity.entity_name);
    expect(within(row).getByRole("heading", { level: 4 })).toHaveTextContent("Congratulations!");
    const lines = within(row).getAllByText(
      /is confirmed\. Billing starts the day its trial ends\./,
    );
    expect(lines).toHaveLength(2);
    expect(within(lines[0]).getByText("Petty Cash")).toHaveClass("text-[#ea9713]");
    expect(within(lines[1]).getByText("Payment Request")).toHaveClass("text-[#2e6ff2]");
    expect(
      within(row).getByText("Nothing charged today · HK$400 a month when the trial ends."),
    ).toBeInTheDocument();
    expect(within(row).getByText(/was originally created/)).toBeInTheDocument();
    expect(row.querySelector("img")).toHaveAttribute("src", "/portal/minty-celebrating.png");

    await userEvent.click(within(row).getByRole("button", { name: BACK_TO_LIST }));
    expect(onBack).toHaveBeenCalledTimes(1);
    await userEvent.click(
      within(row).getByRole("button", { name: `Actions for ${entity.entity_name}` }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: /Request transfer/i }));
    expect(onMenu).toHaveBeenCalledWith("request_transfer");
  });

  it("RU24: Subscription updated in the dark headline, what ends and when, what is available", () => {
    render(
      <ul>
        <ChangeResultRow
          entity={entity}
          result={result("RU24")}
          menu={MENU}
          onMenu={vi.fn()}
          onBack={vi.fn()}
        />
      </ul>,
    );
    const row = screen.getByRole("listitem");
    expect(row).toHaveAttribute("data-result", "updated");
    expect(within(row).getByRole("heading", { level: 4 })).toHaveTextContent(
      "Subscription updated",
    );
    expect(within(row).getByRole("heading", { level: 4 })).toHaveClass("text-[#161f2e]");
    expect(within(row).getByText(/is scheduled to end on/)).toBeInTheDocument();
    expect(within(row).getByText(/is available now\./)).toBeInTheDocument();
    expect(within(row).getByText(/^HK\$280 until .*, then HK\$280 a month\.$/)).toBeInTheDocument();
  });
});

describe("ChangeResultPage", () => {
  it("RV44: the module in colour before Cancellation Confirmed, the company, the paragraphs, the heart", async () => {
    const onBack = vi.fn();
    render(
      <ChangeResultPage
        entity={entity}
        result={result("RV44")}
        menu={MENU}
        onMenu={vi.fn()}
        onBack={onBack}
      />,
    );
    const page = screen.getByRole("region", { name: "Module Cancellation Scheduled" });
    expect(page).toHaveAttribute("data-result", "module_cancelled");
    const heading = within(page).getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Petty Cash Cancellation Confirmed");
    expect(within(heading).getByText("Petty Cash")).toHaveClass("text-[#ea9713]");
    expect(within(page).getByText(entity.entity_name)).toHaveClass("text-[#ea9713]");
    expect(
      within(page).getByText(/We've received your cancellation request for/),
    ).toBeInTheDocument();
    const access = within(page).getByText(/You'll still have access until/);
    expect(within(access).getByText(/\d{1,2} \w+ \d{4}/)).toHaveClass("text-[#333]");
    expect(within(page).getByText(/Changed your mind\? You can reactivate/)).toBeInTheDocument();
    expect(page.querySelector("img")).toHaveAttribute("src", "/portal/minty-heart.png");
    await userEvent.click(within(page).getByRole("button", { name: BACK_TO_LIST }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("RV41: Thank you for being part of Minty, the period end in bold", () => {
    render(
      <ChangeResultPage
        entity={entity}
        result={result("RV41")}
        menu={MENU}
        onMenu={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    const page = screen.getByRole("region", { name: "Cancellation Scheduled" });
    expect(page).toHaveAttribute("data-result", "subscription_cancelled");
    expect(within(page).getByRole("heading", { level: 2 })).toHaveTextContent(
      "Thank you for being part of Minty",
    );
    expect(
      within(page).getByText(/Your Minty subscription has been scheduled for cancellation\./),
    ).toBeInTheDocument();
    expect(
      within(page).getByText(/You may reactivate the subscription anytime\./),
    ).toBeInTheDocument();
  });
});
