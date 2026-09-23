// Section 07's screens as a person sees them, per Figma frame: the picker (07-A) with the
// current payer tagged and the quote under the pick, Request transfer landing on Transfer
// requested (07-B), the request waiting (07-C) and its withdrawal told by 07-K's modal, the
// empty requests page (07-F), a request under review (07-D) with Change → the card picker
// (07-E) → back, and the list's row landing on Subscription Transfer Completed (07-M).

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";

import { SUMMARY_FIXTURES, TODAY, WALLET } from "@/features/subscription/__fixtures__/modulePage";
import { ENTITIES, subscriptionsPage } from "@/features/subscription/__fixtures__/subscriptions";
import {
  INCOMING_REQUEST,
  RECIPIENT_CARDS,
  SUBSCRIBER_OPTIONS,
  SUBSCRIBER_OPTIONS_PENDING,
} from "@/features/subscription/__fixtures__/transfers";
import { ManageSubscriptionsScreen } from "@/features/subscription/routes/ManageSubscriptionsScreen";
import { SubscriptionRequestsScreen } from "@/features/subscription/routes/SubscriptionRequestsScreen";
import { TransferSubscriptionScreen } from "@/features/subscription/routes/TransferSubscriptionScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

const fetchMock = vi.fn<typeof fetch>();

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function serve(handlers: Record<string, unknown>) {
  fetchMock.mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const key = `${init?.method ?? "GET"} ${url.pathname}`;
    if (key in handlers) return reply(200, handlers[key]);
    if (/^\/api\/entities\/[^/]+\/modules$/.test(url.pathname))
      return reply(200, SUMMARY_FIXTURES.M24);
    if (init?.method === "POST") return reply(200, { ok: true, message: "Done." });
    return reply(404, { error: "not_found" });
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
  push.mockReset();
  // jsdom has no scrollIntoView; the open row brings itself into view.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe("TransferSubscriptionScreen", () => {
  it("07-A: the picker - the current payer tagged and unpickable, the quote under the pick, Cancel to the row", async () => {
    serve({ "GET /api/me/subscriptions/subscriber-options": SUBSCRIBER_OPTIONS });
    render(<TransferSubscriptionScreen entityId="e-company-b" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Transfer Subscription");
    await screen.findByRole("heading", { level: 2, name: "Company B Limited" });
    const picker = screen.getByRole("region", { name: "Select new subscriber" });
    expect(within(picker).getByText(/SELECT NEW SUBSCRIBER FOR THIS ENTITY/)).toBeInTheDocument();
    const harry = within(picker).getByRole("radio", { name: /Harry Kim/ });
    expect(harry).toBeDisabled();
    expect(within(picker).getByText("Current")).toBeInTheDocument();
    const request = within(picker).getByRole("button", { name: "Request transfer" });
    expect(request).toBeDisabled();
    await userEvent.click(within(picker).getByRole("radio", { name: /Jiwon Kim/ }));
    expect(request).toBeEnabled();
    expect(within(picker).getByText(/They’ll be charged HKD 88/)).toBeInTheDocument();
    expect(screen.getByText(/You are still responsible for/)).toHaveTextContent(
      /paid up until \d{1,2} \w+ \d{4}\./,
    );
    await userEvent.click(within(picker).getByRole("button", { name: "Cancel" }));
    expect(push).toHaveBeenCalledWith("/subscription/subscriptions?entity=e-company-b");
  });

  it("07-B: Request transfer lands on Transfer requested, Back to the company's row", async () => {
    serve({ "GET /api/me/subscriptions/subscriber-options": SUBSCRIBER_OPTIONS });
    render(<TransferSubscriptionScreen entityId="e-company-b" />);
    const picker = await screen.findByRole("region", { name: "Select new subscriber" });
    await userEvent.click(within(picker).getByRole("radio", { name: /Rebecca Park/ }));
    await userEvent.click(within(picker).getByRole("button", { name: "Request transfer" }));
    const done = await screen.findByRole("region", { name: "Transfer requested" });
    expect(within(done).getByText(/Request has been sent to/)).toHaveTextContent(
      "rebecca.park@oliveandvine.com",
    );
    expect(within(done).getByText(/You are still responsible for/)).toBeInTheDocument();
    expect(done.querySelector("img")).toHaveAttribute("src", "/portal/lemon-approved.png");
    await userEvent.click(
      within(done).getByRole("button", { name: "Back to Manage Subscription" }),
    );
    expect(push).toHaveBeenCalledWith("/subscription/subscriptions?entity=e-company-b");
  });

  it("07-C / 07-K: a request waiting - who and since when, Withdraw tells in a modal, Done reads again", async () => {
    let options = SUBSCRIBER_OPTIONS_PENDING;
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "POST") return reply(200, { ok: true, message: "Withdrawn." });
      if (url.pathname.endsWith("/subscriber-options")) return reply(200, options);
      return reply(404, { error: "not_found" });
    });
    render(<TransferSubscriptionScreen entityId="e-company-b" />);
    const pending = await screen.findByRole("region", { name: "Request pending" });
    expect(within(pending).getByText("A request is already waiting.")).toBeInTheDocument();
    expect(within(pending).getByText(/^Sent .* to Jiwon Kim\./)).toBeInTheDocument();
    expect(within(pending).getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Select new subscriber" })).toBeNull();

    options = SUBSCRIBER_OPTIONS;
    await userEvent.click(within(pending).getByRole("button", { name: "Withdraw request" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName("Transfer request has been withdrawn");
    expect(within(dialog).getByText("Company B Limited")).toBeInTheDocument();
    expect(
      within(dialog).getByText("You can send a new request to anyone anytime."),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Go back" })).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await screen.findByRole("region", { name: "Select new subscriber" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("without a company, says so", () => {
    render(<TransferSubscriptionScreen entityId={null} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No company was picked.");
  });
});

describe("SubscriptionRequestsScreen", () => {
  it("07-F: nothing waiting", async () => {
    serve({ "GET /api/me/subscriptions/transfers": { transfers: [] } });
    render(<SubscriptionRequestsScreen today={TODAY} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Subscription requests");
    const empty = await screen.findByRole("region", { name: "No requests waiting" });
    expect(
      within(empty).getByText(/When someone asks you to take over billing/),
    ).toBeInTheDocument();
    expect(empty.querySelector("img")).toHaveAttribute("src", "/portal/minty-dont.png");
    await userEvent.click(within(empty).getByRole("button", { name: "Back to My Profile" }));
    expect(push).toHaveBeenCalledWith("/subscription/subscriptions");
  });

  it("07-D / 07-E: a request under review, its cards drawn not ticked, the card changed, then accepted", async () => {
    serve({
      "GET /api/me/subscriptions/transfers": { transfers: [INCOMING_REQUEST] },
      "GET /api/me/billing/payment-methods": RECIPIENT_CARDS,
      "POST /api/me/billing/payment-methods/default": {
        ...RECIPIENT_CARDS,
        default_id: "pm_master8842",
      },
    });
    render(<SubscriptionRequestsScreen today={TODAY} />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
        "Transfer Subscription - Choose Modules",
      ),
    );
    const review = await screen.findByRole("region", { name: "Transfer request" });
    await within(review).findByRole("checkbox", { name: "Payment Request subscription" });
    expect(
      within(review).getByRole("checkbox", { name: "Payment Request subscription" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      within(review).getByRole("checkbox", { name: "Petty Cash subscription" }),
    ).toHaveAttribute("aria-disabled", "true");
    const panel = within(review).getByRole("region", { name: "Subscription Summary" });
    expect(within(panel).getByText("Payment Request")).toBeInTheDocument();
    expect(within(panel).getByText("HK$280")).toBeInTheDocument();
    expect(within(panel).getByText("Visa 4121")).toBeInTheDocument();
    expect(within(panel).getByText(/You’ll be charged HK\$88 today/)).toBeInTheDocument();
    expect(screen.getByText(/charged to your selected payment method/)).toBeInTheDocument();

    await userEvent.click(within(panel).getByRole("button", { name: "Change" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Transfer Subscription");
    const cards = screen.getByRole("region", { name: "Payment Methods" });
    expect(within(cards).getByRole("radio", { name: /Visa ending in 4121/ })).toBeChecked();
    await userEvent.click(within(cards).getByRole("radio", { name: /Mastercard ending in 8842/ }));
    expect(within(cards).getByRole("link", { name: "Add New Card" })).toHaveAttribute(
      "href",
      "/subscription/billing",
    );
    await userEvent.click(within(cards).getByRole("button", { name: "Confirm" }));
    const back = await screen.findByRole("region", { name: "Transfer request" });
    expect(within(back).getByText("Mastercard 8842")).toBeInTheDocument();

    await userEvent.click(
      within(back).getByRole("button", { name: "Confirm Subscription Transfer" }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/subscription/subscriptions?entity=e-new-company&transferred=1",
      ),
    );
  });
});

describe("07-M in the list", () => {
  it("arriving transferred lands the company's row on Subscription Transfer Completed", async () => {
    const mine = ENTITIES[3];
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/transfers")) return reply(200, { transfers: [] });
      if (url.pathname === "/api/me/subscriptions") return reply(200, subscriptionsPage());
      if (/^\/api\/entities\/[^/]+\/modules$/.test(url.pathname))
        return reply(200, SUMMARY_FIXTURES.M44);
      if (url.pathname === "/api/me/billing/entity-payment-method") return reply(200, WALLET);
      return reply(404, { error: "not_found" });
    });
    render(
      <ToastProvider>
        <ManageSubscriptionsScreen today={TODAY} focusEntityId={mine.entity_id} transferred />
      </ToastProvider>,
    );
    const heading = await screen.findByRole(
      "heading",
      { level: 4, name: "Subscription Transfer Completed" },
      { timeout: 3000 },
    );
    const row = heading.closest("li")!;
    expect(row).toHaveAttribute("data-result", "transferred");
    expect(row).toHaveAttribute("data-entity", mine.entity_id);
    expect(
      within(row).getByText(/The subscription transfer has been completed successfully\./),
    ).toBeInTheDocument();
    expect(within(row).getByText(/You are now the owner of the/)).toHaveTextContent(
      `You are now the owner of the ${mine.entity_name} subscription and have full control of this Minty.`,
    );
    expect(within(row).getByText(/Your next subscription renewal date/)).toBeInTheDocument();
    // The handover's row shares the result screens' button: it leaves for 08-A too (07-M).
    await userEvent.click(
      within(row).getByRole("button", { name: "Back to Manage Subscriptions" }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/subscription"));
  });
});
