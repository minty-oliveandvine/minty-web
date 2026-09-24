// Section 08's screens, rendered from the fixtures: the billing page in each state the design
// draws (08-B two cards, 08-H none, 08-I expired, 08-J all of them, 08-K a payment failed), the
// "Update card" menu and what it opens (08-W/08-X, 08-R), the card that just arrived (08-N /
// 08-S), the edit screen (08-D), the add screen around Stripe's form (08-Y), and the portal's
// landing (08-A).

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import { TODAY } from "@/features/subscription/__fixtures__/modulePage";
import { LIST_FIXTURES } from "@/features/subscription/__fixtures__/subscriptions";
import { ADDED_CARD, WALLET_ADDED, WALLET_TWO } from "@/features/subscription/__fixtures__/billing";
import { BillingPageScreen } from "@/features/subscription/routes/BillingPageScreen";
import { AddCardScreen, EditCardScreen } from "@/features/subscription/routes/CardScreens";
import { SubscriptionOverviewScreen } from "@/features/subscription/routes/SubscriptionOverviewScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

// Stripe's own fields are an iframe: jsdom cannot mount them, and what this suite is about is
// the screen around the form (the e2e specs leave the card capture alone for the same reason).
vi.mock("@/features/subscription/components/CardCaptureForm", () => ({
  CardCaptureForm: ({ firstCard }: { firstCard: boolean }) => (
    <div data-testid="card-form">{firstCard ? "first card" : "another card"}</div>
  ),
  // The loading/error/form triad around it, which the screen now delegates to. Mocked at the
  // same boundary: what this suite is about is still the screen, not Stripe's iframe.
  CardCapturePanel: ({
    setup,
  }: {
    setup: { status: string; error: string | null; firstCard: boolean };
  }) =>
    setup.status === "error" ? (
      <p role="alert">{setup.error}</p>
    ) : setup.status === "loading" ? (
      <p role="status">Opening the card form…</p>
    ) : (
      <div data-testid="card-form">{setup.firstCard ? "first card" : "another card"}</div>
    ),
}));

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("the billing page", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async () => reply(200, { ok: true }));
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("08-B: the next bill, the default card first, and the invoices", async () => {
    render(<BillingPageScreen fixture="B" />);
    // The blocks are drawn while the reads are in flight, so wait for the answer itself.
    await screen.findByText("Olive Vine");

    const next = screen.getByRole("region", { name: "Next billing" });
    expect(next).toHaveAttribute("data-state", "failed"); // the list fixture has a past-due company
    expect(next).toHaveTextContent("Olive Vine");
    expect(next).toHaveTextContent("28 Sep 2026");

    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("Visa ending in 4121")).toBeInTheDocument();
    expect(rows[0]).toHaveAttribute("data-chip", "default");
    expect(within(rows[0]).getByText("Sep 2026")).toBeInTheDocument();
    expect(rows[1]).toHaveAttribute("data-chip", "saved");

    const invoices = screen.getByRole("region", { name: "Invoice History" });
    expect(
      within(invoices).getByRole("columnheader", { name: "Amount (HK$)" }),
    ).toBeInTheDocument();
    expect(within(invoices).getByText("#11241234113")).toBeInTheDocument();
    expect(
      within(invoices).getByRole("link", { name: "Invoice #11241234113 (PDF)" }),
    ).toHaveAttribute("target", "_blank");
  });

  it("08-H: no card saved, and the way to add one", async () => {
    const user = userEvent.setup();
    render(<BillingPageScreen fixture="H" />);
    expect(await screen.findByText("No card saved")).toBeInTheDocument();
    expect(screen.getByText(/Trials keep running without one/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add a payment method" }));
    expect(push).toHaveBeenCalledWith("/subscription/billing/add");
  });

  it("08-I: the card being charged has expired", async () => {
    render(<BillingPageScreen fixture="I" />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your card expired on Aug 2026.");
    expect(within(alert).getByRole("button", { name: /Update your payment method/ })).toBeVisible();
    expect(screen.getAllByRole("listitem")[0]).toHaveAttribute("data-chip", "expired");
  });

  it("08-J: Show more opens all of them, Show less puts them back", async () => {
    const user = userEvent.setup();
    render(<BillingPageScreen fixture="J" />);
    await screen.findByRole("region", { name: "Payment Methods" });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Show more (6)" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByText(/All 8 saved cards/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("08-W / 08-X: the menu offers Set as default only on a card that is not the default", async () => {
    const user = userEvent.setup();
    render(<BillingPageScreen fixture="B" />);
    await screen.findByRole("region", { name: "Payment Methods" });

    await user.click(screen.getByRole("button", { name: "Update card · Visa ending in 4121" }));
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Edit", "Delete"]);
    await user.keyboard("{Escape}");

    await user.click(
      screen.getByRole("button", { name: "Update card · Mastercard ending in 4651" }),
    );
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Set as default",
      "Edit",
      "Delete",
    ]);
    await user.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(push).toHaveBeenCalledWith("/subscription/billing/edit?card=pm_master4651");
  });

  it("08-R: the default card cannot be removed, and says which one to promote first", async () => {
    const user = userEvent.setup();
    render(<BillingPageScreen fixture="B" />);
    await screen.findByRole("region", { name: "Payment Methods" });
    await user.click(screen.getByRole("button", { name: "Update card · Visa ending in 4121" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog", { name: "Remove default card?" });
    expect(dialog).toHaveTextContent("Visa 4121");
    expect(dialog).toHaveTextContent(/currently your default payment method/);
    expect(within(dialog).queryByRole("button", { name: "Remove" })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Go back" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("08-N: a card that just arrived can be made the default; 08-S says it is", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/me/billing/payment-methods" && init?.method !== "POST") {
        return reply(200, WALLET_ADDED);
      }
      if (url.pathname === "/api/me/billing/payment-methods/default") {
        return reply(200, { ...WALLET_ADDED, default_id: ADDED_CARD.id });
      }
      return reply(200, { invoices: [], entities: [], total: 0, page: 1, pages: 1, per_page: 10 });
    });
    render(<BillingPageScreen addedId={ADDED_CARD.id} />);

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("New Card added Successfully");
    expect(dialog).toHaveTextContent("Mastercard 8842 is added successfully.");
    expect(dialog).toHaveTextContent("This card is not your default payment method.");
    await user.click(within(dialog).getByRole("button", { name: "Set as default" }));
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveTextContent(
        "This card is set as the default payment method.",
      ),
    );
    expect(
      within(screen.getByRole("dialog")).queryByRole("button", { name: "Set as default" }),
    ).toBeNull();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("the card screens", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation(async () => reply(200, WALLET_TWO));
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("08-Y: the banner, Stripe's note, and the form once the intent is open", async () => {
    render(<AddCardScreen fixture="B" />);
    expect(await screen.findByTestId("card-form")).toHaveTextContent("another card");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Add Card Details");
    expect(screen.getByText(/never stored by Minty/)).toBeInTheDocument();
  });

  it("08-D: the number is shown and locked; the name and expiry are not", async () => {
    const user = userEvent.setup();
    render(<EditCardScreen cardId="pm_visa4121" fixture="B" />);
    const number = await screen.findByLabelText("Card number");
    expect(number).toBeDisabled();
    expect(number).toHaveValue("•••• •••• •••• 4121");
    expect(screen.getByLabelText("Name on card")).toHaveValue("Rebecca Park");
    expect(screen.getByText(/Only the name on the card and its expiry date/)).toBeInTheDocument();

    const save = screen.getByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled(); // nothing changed yet
    await user.clear(screen.getByLabelText("Expiry year"));
    await user.type(screen.getByLabelText("Expiry year"), "30");
    expect(save).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(push).toHaveBeenCalledWith("/subscription/billing");
  });
});

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";

describe("08-A, the portal's landing", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("the bill, the two figures, the updates and the two ways on", async () => {
    const user = userEvent.setup();
    render(<SubscriptionOverviewScreen fixture="A" today={TODAY} />);

    const payment = await screen.findByRole("region", { name: "Payment Method" });
    expect(payment).toHaveTextContent("Olive Vine");
    expect(payment).toHaveTextContent("28 Sep 2026");

    const overview = screen.getByRole("region", { name: "Subscription Overview" });
    expect(within(overview).getByText("Active subscriptions")).toBeInTheDocument();
    expect(within(overview).getByText("Trial ending")).toBeInTheDocument();
    expect(within(overview).getAllByText("entities").length).toBeGreaterThan(0);
    // A failure is what needs acting on, so those lines come first - and only a few print
    // before the rest are counted (the 04-A fixture holds six failures and seven trials).
    expect(within(overview).getAllByText("Payment failed").length).toBe(5);
    expect(within(overview).getByText(/^and \d+ more$/)).toBeInTheDocument();

    await user.click(within(payment).getByRole("button", { name: /Go to payment details/ }));
    expect(push).toHaveBeenCalledWith("/subscription/billing");
    await user.click(within(overview).getByRole("button", { name: "Manage Subscription" }));
    expect(push).toHaveBeenCalledWith("/subscription/subscriptions");
    // With no company scoped, the way back can only be Minty's entity list.
    expect(screen.getByRole("link", { name: "Back to the entity dashboard" })).toHaveAttribute(
      "href",
      `${env.MINTY_URL}/entity`,
    );
  });

  it("07-I: a declined handover is told once, over the landing, and marked seen", async () => {
    // The gap this closes: every other read filters on the OPEN statuses, so the payer who
    // ASKED learned by email or not at all.
    const user = userEvent.setup();
    const posts: { path: string; body: unknown }[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "POST") {
        posts.push({ path: url.pathname, body: JSON.parse(String(init.body)) });
        return reply(200, { ok: true, message: "Done." });
      }
      return reply(200, {
        ...LIST_FIXTURES.A.page,
        transfer_outcomes: [
          {
            id: "t-9",
            entity_id: "e-company-b",
            entity_name: "Company B Limited",
            status: "declined",
            who: "Sonia Chan",
            responded_at: null,
          },
        ],
        total: LIST_FIXTURES.A.page.entities.length,
        page: 1,
        pages: 1,
        per_page: 100,
        sort: "entity",
        direction: "asc",
        query: "",
      });
    });

    render(<SubscriptionOverviewScreen today={TODAY} />);

    const dialog = await screen.findByRole("dialog");
    // The accessible name is the WHOLE title, so the coloured name must stay contiguous with
    // the rest of the sentence - the same trap the <br/> in section 06's titles has.
    expect(dialog).toHaveAccessibleName("Sonia Chan declined the transfer");
    // The design's colours: the person in orange, the company in teal, "Entity" neither.
    expect(within(dialog).getByText("Sonia Chan")).toHaveClass("text-[#ea9713]");
    const company = within(dialog).getByText("Company B Limited");
    expect(company).toBeInTheDocument();
    expect(company).toHaveClass("text-[#18c4c7]");
    expect(
      within(dialog).getByText("You can send a new request to anyone anytime."),
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    // The server marker is what stops it returning tomorrow.
    expect(posts).toEqual([
      { path: "/api/me/subscriptions/transfer/seen", body: { transfer: "t-9" } },
    ]);
  });

  it("nothing is told when there is no unseen outcome", async () => {
    render(<SubscriptionOverviewScreen fixture="A" today={TODAY} />);
    await screen.findByRole("region", { name: "Payment Method" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the way back goes to the scoped company's modules, signed in", () => {
    // Everyone here arrived from a company's module settings, so the token names one. Minty's
    // /entity/<id>/modules then routes: one module in, two to the module selection.
    setAuth(TOKEN, "e1", "Olive & Vine Limited");
    render(<SubscriptionOverviewScreen fixture="A" today={TODAY} />);

    const href = screen
      .getByRole("link", { name: "Back to the entity dashboard" })
      .getAttribute("href")!;
    // through /enter, so the Flask session is re-established on the way
    expect(href).toBe(
      `${env.MINTY_URL}/entity/e1/enter?token=${encodeURIComponent(TOKEN)}` +
        `&next=${encodeURIComponent("/entity/e1/modules")}`,
    );
  });
});
