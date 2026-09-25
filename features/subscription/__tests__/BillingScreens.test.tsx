// Section 08's screens, rendered from the fixtures: the billing page in each state the design
// draws (08-B two cards, 08-H none, 08-I expired, 08-J all of them, 08-K a payment failed), the
// "Update card" menu and what it opens (08-W/08-X, 08-R), the card that just arrived (08-N /
// 08-S), the edit screen (08-D), the add screen around Stripe's form (08-Y), the portal's
// landing (08-A), and the billing-account sheet - onboarding's list → form → 01-J, in place.

import { render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import { TODAY } from "@/features/subscription/__fixtures__/modulePage";
import { LIST_FIXTURES } from "@/features/subscription/__fixtures__/subscriptions";
import {
  ACCOUNTS,
  ACCOUNTS_NONE,
  ACCOUNTS_OPENED,
  ADDED_CARD,
  WALLET_ADDED,
  WALLET_NONE,
  WALLET_TWO,
  accountsFor,
} from "@/features/subscription/__fixtures__/billing";
import { ADDRESS_UNAVAILABLE } from "@/features/subscription/lib/billingAccounts";
import { BillingDetailsScreen } from "@/features/subscription/routes/BillingDetailsScreen";
import { BillingPageScreen } from "@/features/subscription/routes/BillingPageScreen";
import { AddCardScreen, EditCardScreen } from "@/features/subscription/routes/CardScreens";
import { SubscriptionOverviewScreen } from "@/features/subscription/routes/SubscriptionOverviewScreen";

const push = vi.fn();
const replace = vi.fn();
// What would have been handed to the browser to save.
const saved = vi.hoisted(() => [] as { filename: string; text: string }[]);
vi.mock("@/features/subscription/lib/download", () => ({
  saveTextFile: (filename: string, text: string) => saved.push({ filename, text }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace, back: vi.fn() }),
}));

// 08-C's address is Stripe's own AddressElement - an iframe jsdom cannot mount. The stand-in
// records what it was opened with, reports ONE change (the payer moving the company to Central),
// and answers `getValue()` as Stripe does: `complete` and the value, or incomplete.
const stripeForm = vi.hoisted(() => ({
  elementOptions: [] as unknown[],
  addressOptions: [] as Record<string, unknown>[],
  complete: true,
  value: {
    name: "Rebecca Park",
    address: {
      line1: "1 Queen's Road",
      line2: null,
      city: "Central",
      state: null,
      postal_code: null,
      country: "HK",
    },
  },
}));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: vi.fn(async () => ({})) }));
vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ options, children }: { options: unknown; children: ReactNode }) => {
    stripeForm.elementOptions.push(options);
    return <>{children}</>;
  },
  useElements: () => ({
    getElement: () => ({
      getValue: async () => ({ complete: stripeForm.complete, value: stripeForm.value }),
    }),
  }),
  // A click stands in for the payer editing Stripe's fields: one change event.
  AddressElement: ({
    options,
    onChange,
  }: {
    options: Record<string, unknown>;
    onChange?: (event: unknown) => void;
  }) => {
    stripeForm.addressOptions.push(options);
    return (
      <button
        type="button"
        data-testid="address-element"
        onClick={() => onChange?.({ complete: stripeForm.complete, value: stripeForm.value })}
      >
        Stripe&apos;s address form
      </button>
    );
  },
}));

// Stripe's own fields are an iframe: jsdom cannot mount them, and what this suite is about is
// the screen around the form (the e2e specs leave the card capture alone for the same reason;
// the form itself has its own suite, CardCaptureForm.test.tsx, with Stripe mocked instead).
vi.mock("@/features/subscription/components/CardCaptureForm", async () => {
  const { OPENED_ACCOUNT } = await import("@/features/subscription/__fixtures__/billing");
  return {
    CardCaptureForm: ({ firstCard }: { firstCard: boolean }) => (
      <div data-testid="card-form">{firstCard ? "first card" : "another card"}</div>
    ),
    // The loading/error/form triad around it, which the screens delegate to. With a gate (the
    // new billing account form), Save keeps the real form's order - the gate first, and only a
    // yes reaches "Stripe", which here answers with an account opened on a Visa 4242.
    CardCapturePanel: ({
      setup,
      fields,
      beforeConfirm,
      onSaved,
      onCancel,
    }: {
      setup: { status: string; error: string | null; firstCard: boolean };
      fields?: (busy: boolean) => ReactNode;
      beforeConfirm?: () => boolean;
      onSaved: (confirmed: unknown, paymentMethodId: string | null) => void | Promise<void>;
      onCancel: () => void;
    }) =>
      setup.status === "error" ? (
        <p role="alert">{setup.error}</p>
      ) : setup.status === "loading" ? (
        <p role="status">Opening the card form…</p>
      ) : (
        <div data-testid="card-form">
          {fields?.(false)}
          {setup.firstCard ? "first card" : "another card"}
          {beforeConfirm && (
            <>
              <button type="button" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (beforeConfirm()) void onSaved(OPENED_ACCOUNT, "pm_visa4242");
                }}
              >
                Save billing account
              </button>
            </>
          )}
        </div>
      ),
  };
});

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

  it("08-B: one account - its name, address and email, the card it charges first, its invoices", async () => {
    const user = userEvent.setup();
    render(<BillingPageScreen fixture="B" />);
    // The blocks are drawn while the reads are in flight, so wait for the answer itself.
    await screen.findByText("Company A Limited");

    const next = screen.getByRole("region", { name: "Next billing" });
    expect(next).toHaveAttribute("data-state", "failed"); // a company on this account is past due
    expect(next).toHaveTextContent("Company A Limited");
    expect(next).toHaveTextContent("Unit 10, 1/F, ABC Building");
    expect(next).toHaveTextContent("Quarry Bay, Hong Kong");
    expect(next).toHaveTextContent("billing@companyalimited.com");
    expect(next).toHaveTextContent("28 Sep 2026");
    // What the account's next renewal will charge, estimated - the API prices it.
    expect(next).toHaveTextContent(/Amount\s*HKD 960\s*\(estimated\)/);
    await user.click(within(next).getByRole("button", { name: "Change billing details" }));
    expect(push).toHaveBeenCalledWith("/subscription/billing/details?account=acc-company-a");

    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("Visa ending in 4121")).toBeInTheDocument();
    expect(rows[0]).toHaveAttribute("data-chip", "default");
    expect(within(rows[0]).getByText("Sep 2026")).toBeInTheDocument();
    expect(rows[1]).toHaveAttribute("data-chip", "saved");

    const invoices = screen.getByRole("region", { name: "Invoice History" });
    // The invoices are their own read, after the account's.
    expect(await within(invoices).findByText("#11241234113")).toBeInTheDocument();
    expect(
      within(invoices).getByRole("columnheader", { name: "Amount (HK$)" }),
    ).toBeInTheDocument();
    expect(
      within(invoices).getByRole("link", { name: "Invoice #11241234113 (PDF)" }),
    ).toHaveAttribute("target", "_blank");
    // Ten to a page until the payer picks 50 or 100; one page here, so no way on.
    const pages = within(invoices).getByRole("navigation", { name: "Invoice pages" });
    expect(within(pages).getByLabelText("Rows per page")).toHaveValue("10");
    expect(
      within(within(pages).getByLabelText("Rows per page")).getAllByRole("option").map((o) => o.textContent),
    ).toEqual(["10", "50", "100"]);
    expect(pages).toHaveTextContent(/1–\d+ of \d+/);
    expect(within(pages).getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(within(pages).getByRole("button", { name: "Previous page" })).toBeDisabled();

    // The two downloads, centred as the design sets them; the breakdown is saved as a CSV.
    for (const header of ["Invoice PDF", "Billing Breakdown"]) {
      expect(within(invoices).getByRole("columnheader", { name: header })).toHaveClass("text-center");
    }
    saved.length = 0;
    await user.click(
      within(invoices).getByRole("button", { name: /billing breakdown of invoice #11241234113/ }),
    );
    await waitFor(() =>
      expect(saved.at(-1)?.filename).toBe("Inv-11241234113 Breakdown by Entity.csv"),
    );
    expect(saved.at(-1)?.text).toMatch(/^Entity Name,Subscription,Monthly amount,/);
  });

  it("08-H: no card saved, and the way to add one", async () => {
    const user = userEvent.setup();
    render(<BillingPageScreen fixture="H" />);
    expect(await screen.findByText("No card saved")).toBeInTheDocument();
    expect(screen.getByText(/Trials keep running without one/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add a payment method" }));
    // ON this account: the card lands on Company A's shelf.
    expect(push).toHaveBeenCalledWith("/subscription/billing/add?account=acc-company-a");
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
    expect(push).toHaveBeenCalledWith(
      "/subscription/billing/edit?card=pm_master4651&account=acc-company-a",
    );
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

  it("08-N: a card that just arrived can be made the one the account charges; 08-S says it is", async () => {
    const user = userEvent.setup();
    const before = accountsFor(WALLET_ADDED);
    const after = accountsFor({ ...WALLET_ADDED, default_id: ADDED_CARD.id });
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/api/me/billing/accounts" && init?.method !== "POST") {
        return reply(200, before);
      }
      if (url.pathname === "/api/me/billing/accounts/default-card") return reply(200, after);
      return reply(200, {
        invoices: [],
        entity_options: [],
        total: 0,
        page: 1,
        pages: 1,
        per_page: 10,
      });
    });
    render(<BillingPageScreen accountId="acc-company-a" addedId={ADDED_CARD.id} />);

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

  it("08-C with no Stripe here: our two fields, and the address says it cannot change", async () => {
    const user = userEvent.setup();
    render(<BillingDetailsScreen accountId="acc-company-a" fixture="A" />);
    const form = await screen.findByRole("form", { name: "Billing information" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Update Billing Information",
    );
    expect(within(form).getByLabelText("Billing Company")).toHaveValue("Company A Limited");
    expect(within(form).getByLabelText("Billing email")).toHaveValue("billing@companyalimited.com");
    // The fixture carries no publishable key: no form is drawn rather than an empty one.
    expect(within(form).getByRole("status")).toHaveTextContent(ADDRESS_UNAVAILABLE);
    expect(within(form).queryByTestId("address-element")).toBeNull();

    const save = within(form).getByRole("button", { name: "Save billing account" });
    expect(save).toBeDisabled(); // nothing changed yet
    await user.type(within(form).getByLabelText("Billing Company"), " Holdings");
    expect(save).toBeEnabled();
    await user.click(within(form).getByRole("button", { name: "Go Back" }));
    expect(push).toHaveBeenCalledWith("/subscription/billing?account=acc-company-a");
  });

  it("08-C: the address is Stripe's own form, opened on the card, in 08-C's look - and what it checked is sent", async () => {
    const user = userEvent.setup();
    const posts: unknown[] = [];
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return reply(200, ACCOUNTS);
      }
      return reply(200, { ...ACCOUNTS, publishable_key: "pk_test_1" });
    });
    stripeForm.addressOptions.length = 0;
    stripeForm.elementOptions.length = 0;
    render(<BillingDetailsScreen accountId="acc-company-a" />);

    const address = await screen.findByRole("region", { name: "Address (Stripe)" });
    const stripe = within(address).getByTestId("address-element");
    // Billing mode with the cardholder's name, the registry's countries, the card's address.
    expect(stripeForm.addressOptions.at(-1)).toEqual({
      mode: "billing",
      display: { name: "full" },
      allowedCountries: ["HK", "PH", "SG"],
      defaultValues: {
        name: "Rebecca Park",
        address: {
          line1: "Unit 10, 1/F, ABC Building",
          line2: "2 ABC Street",
          city: "Quarry Bay",
          state: "",
          postal_code: "",
          country: "HK",
        },
      },
    });
    // Themed to 08-C's own fields: the 1.5px edge, the 10px corner, the teal focus.
    expect(stripeForm.elementOptions.at(-1)).toMatchObject({
      appearance: {
        variables: { borderRadius: "10px", colorPrimary: "#4fc7c7" },
        rules: { ".Input": { border: "1.5px solid #d6dae0" } },
      },
    });

    const form = screen.getByRole("form", { name: "Billing information" });
    const save = within(form).getByRole("button", { name: "Save billing account" });
    expect(save).toBeDisabled();
    await user.click(stripe); // the payer moves the company to Central
    expect(save).toBeEnabled();
    await user.click(save);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/subscription/billing?account=acc-company-a"));
    expect(posts).toEqual([
      {
        account: "acc-company-a",
        address: {
          line1: "1 Queen's Road",
          line2: "",
          city: "Central",
          state: "",
          postal_code: "",
          country: "HK",
        },
      },
    ]);
  });

  it("08-C: an address Stripe marks as incomplete is not sent", async () => {
    const user = userEvent.setup();
    const posts: unknown[] = [];
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === "POST") posts.push(JSON.parse(String(init.body)));
      return reply(200, { ...ACCOUNTS, publishable_key: "pk_test_1" });
    });
    stripeForm.complete = false;
    try {
      render(<BillingDetailsScreen accountId="acc-company-a" />);
      const address = await screen.findByRole("region", { name: "Address (Stripe)" });
      await user.click(within(address).getByTestId("address-element"));
      await user.click(screen.getByRole("button", { name: "Save billing account" }));
      expect(screen.getByRole("button", { name: "Save billing account" })).toBeEnabled();
      expect(posts).toEqual([]);
      expect(push).not.toHaveBeenCalled();
    } finally {
      stripeForm.complete = true;
    }
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

  it("one billing account's bill, the two figures, the updates and the ways on", async () => {
    const user = userEvent.setup();
    render(<SubscriptionOverviewScreen fixture="A" today={TODAY} />);

    const payment = await screen.findByRole("region", { name: "Billing account" });
    // The eyebrow is gone; "Bill to" is the ACCOUNT's name, the oldest when none is asked for.
    expect(within(payment).queryByText("Payment Method")).toBeNull();
    expect(payment).toHaveTextContent("Company A Limited");
    // The payer's NEXT billing date - the fixture's anchor is 28 Jul, which is never printed.
    expect(payment).toHaveTextContent("28 Sep 2026");
    expect(payment).not.toHaveTextContent("28 Jul 2026");

    const overview = screen.getByRole("region", { name: "Subscription Overview" });
    expect(within(overview).getByText("Active subscriptions")).toBeInTheDocument();
    expect(within(overview).getByText("Trial ending")).toBeInTheDocument();
    expect(within(overview).getAllByText("entities").length).toBeGreaterThan(0);
    // A failure is what needs acting on, so those lines come first - and five show until Show
    // more opens the rest (the 04-A fixture holds six failures and trials besides).
    const lines = () => within(overview).getAllByRole("listitem");
    expect(lines()).toHaveLength(5);
    expect(within(overview).getAllByText("Payment failed").length).toBe(5);
    const more = within(overview).getByRole("button", { name: /^Show more \(\d+\)$/ });
    expect(more).toHaveAttribute("aria-expanded", "false");
    const hidden = Number(/\((\d+)\)/.exec(more.textContent ?? "")?.[1]);
    await user.click(more);
    expect(lines()).toHaveLength(5 + hidden);
    expect(within(overview).getAllByText("Payment failed").length).toBe(6);
    await user.click(within(overview).getByRole("button", { name: "Show less" }));
    expect(lines()).toHaveLength(5);
    expect(push).not.toHaveBeenCalled(); // opening the list is not leaving the page

    await user.click(within(payment).getByRole("button", { name: /Go to payment details/ }));
    // The link is a control of its own: it goes to THIS account's page, and no picker opens.
    expect(push).toHaveBeenCalledWith("/subscription/billing?account=acc-company-a");
    expect(screen.queryByRole("dialog")).toBeNull();
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
    // The same rule wherever the name appears - the title here, the body on 07-L.
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

  it("closing without pressing Done does NOT record it as seen", async () => {
    // The marker is once-ever, so a stray backdrop click or an Escape must not consume the
    // only in-app telling of a declined handover. It closes for this visit and comes back.
    const user = userEvent.setup();
    const posts: string[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "POST") {
        posts.push(url.pathname);
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
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(posts).toEqual([]);
  });

  it("07-L: an accepted handover names the person in the body, in the same orange", async () => {
    fetchMock.mockImplementation(async (input, init) => {
      if (init?.method === "POST") return reply(200, { ok: true, message: "Done." });
      void input;
      return reply(200, {
        ...LIST_FIXTURES.A.page,
        transfer_outcomes: [
          {
            id: "t-8",
            entity_id: "e-company-b",
            entity_name: "Company B Limited",
            status: "accepted",
            who: "Angelika Lifecycle",
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
    expect(dialog).toHaveAccessibleName("Transfer has been successful");
    // The sentence stays whole around the coloured run.
    expect(dialog).toHaveTextContent("Angelika Lifecycle has accepted the transfer.");
    expect(within(dialog).getByText("Angelika Lifecycle")).toHaveClass("text-[#ea9713]");
  });

  it("nothing is told when there is no unseen outcome", async () => {
    render(<SubscriptionOverviewScreen fixture="A" today={TODAY} />);
    await screen.findByRole("region", { name: "Billing account" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clicking the card picks which account it shows - and only rewrites the URL", async () => {
    const user = userEvent.setup();
    replace.mockReset();
    render(<SubscriptionOverviewScreen fixture="A" today={TODAY} />);
    const card = await screen.findByRole("region", { name: "Billing account" });

    // Anywhere on the card that is not one of its controls.
    await user.click(within(card).getByText("Next Billing Date"));
    const picker = await screen.findByRole("dialog", { name: "Billing Accounts" });
    const rows = within(picker).getAllByRole("radio");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toBeChecked(); // the one on show
    // Onboarding's row: the name, the card it charges, what it pays for.
    expect(rows[0]).toHaveAccessibleName(/Company A Limited.*Visa ending in 4121.*3 companies/);
    // An account that was never named reads as the payer; its failing collection says so.
    expect(picker).toHaveTextContent("Olive Vine");
    expect(within(picker).getAllByText("Payment failed").length).toBe(2);

    await user.click(within(picker).getByText("Vine Consulting Limited"));
    await user.click(within(picker).getByRole("button", { name: "Confirm" }));
    expect(replace).toHaveBeenCalledWith("/subscription?account=acc-vine", { scroll: false });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetchMock).not.toHaveBeenCalled(); // choosing what to look at writes nothing
  });

  it("the account's name is Change billing account; the keyboard reaches the sheet by its own button", async () => {
    const user = userEvent.setup();
    render(<SubscriptionOverviewScreen accountId="acc-vine" fixture="A" today={TODAY} />);
    const card = await screen.findByRole("region", { name: "Billing account" });
    expect(card).toHaveTextContent("Vine Consulting Limited");
    // No button of its own for the move any more: the account's name is it.
    expect(within(card).getAllByRole("button", { name: /Change billing account/ })).toHaveLength(1);

    const name = within(card).getByRole("button", { name: /Vine Consulting Limited/ });
    expect(name).toHaveAttribute("aria-haspopup", "dialog");
    await user.click(name);
    // The name is a control: the move opens, not the sheet behind it.
    expect(await screen.findByRole("dialog", { name: "Change billing account" })).toBeVisible();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // What a click on the card does, for the keyboard - out of sight until it is focused.
    const choose = within(card).getByRole("button", { name: "Choose which billing account to show" });
    choose.focus();
    await user.keyboard("{Enter}");
    const picker = await screen.findByRole("dialog", { name: "Billing Accounts" });
    expect(within(picker).getByRole("radio", { name: /Vine Consulting Limited/ })).toBeChecked();
    // Focus lands inside the sheet (its X), not behind it on the page.
    expect(within(picker).getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("New billing account turns the picker itself into onboarding's form - nothing navigates", async () => {
    const user = userEvent.setup();
    render(<SubscriptionOverviewScreen fixture="A" today={TODAY} />);
    const card = await screen.findByRole("region", { name: "Billing account" });
    await user.click(within(card).getByText("Next Billing Date"));
    const sheet = await screen.findByRole("dialog", { name: "Billing Accounts" });
    await user.click(within(sheet).getByRole("button", { name: "New billing account" }));

    // The SAME dialog, now 01-D: onboarding's title, its Stripe note, its two fields.
    expect(sheet).toHaveAccessibleName("New billing account");
    expect(within(sheet).getByRole("heading", { name: "New billing account" })).toBeVisible();
    expect(sheet).toHaveTextContent("never stored by Minty");
    expect(within(sheet).getByLabelText("Billing Email")).toHaveAttribute("type", "email");
    expect(within(sheet).getByLabelText("Billing company")).toBeRequired();
    expect(push).not.toHaveBeenCalled();

    // Nothing reaches Stripe without both - in onboarding's words.
    await user.click(within(sheet).getByRole("button", { name: "Save billing account" }));
    expect(within(sheet).getByText("Enter the email address invoices should go to.")).toBeVisible();
    expect(within(sheet).getByText("Enter the company name to invoice.")).toBeVisible();
    expect(within(sheet).getByLabelText("Billing Email")).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalled();

    // Cancel is 01-D's arrow back to the list.
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    expect(sheet).toHaveAccessibleName("Billing Accounts");
    expect(within(sheet).getAllByRole("radio")).toHaveLength(3);
  });

  it("a saved account is 01-J in the same sheet, and Done shows it on the card", async () => {
    const user = userEvent.setup();
    replace.mockReset();
    fetchMock.mockImplementation(async (input) =>
      new URL(String(input)).pathname === "/api/me/billing/accounts"
        ? reply(200, ACCOUNTS_OPENED)
        : reply(404, { error: "not_found" }),
    );
    const { rerender } = render(<SubscriptionOverviewScreen fixture="A" today={TODAY} />);
    const card = await screen.findByRole("region", { name: "Billing account" });
    await user.click(within(card).getByText("Next Billing Date"));
    const sheet = await screen.findByRole("dialog", { name: "Billing Accounts" });
    await user.click(within(sheet).getByRole("button", { name: "New billing account" }));
    await user.type(within(sheet).getByLabelText("Billing Email"), "ap@acme.test");
    await user.type(within(sheet).getByLabelText("Billing company"), "Acme Ltd");
    await user.click(within(sheet).getByRole("button", { name: "Save billing account" }));

    await waitFor(() => expect(sheet).toHaveAccessibleName("Card added"));
    expect(sheet).toHaveTextContent(/New Card added\s*Successfully/);
    expect(sheet).toHaveTextContent("Visa 4242 is added successfully.");
    // True of this card: it is the one the new account charges.
    expect(sheet).toHaveTextContent("This card is set as the default payment method.");
    expect(within(sheet).queryByRole("button", { name: "Close" })).toBeNull();
    const done = within(sheet).getByRole("button", { name: "Done" });
    expect(done).toHaveFocus();

    await user.click(done);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(replace).toHaveBeenCalledWith("/subscription?account=acc-acme", { scroll: false });
    // The page took the accounts the sheet came back with; the URL now names the new one.
    rerender(<SubscriptionOverviewScreen accountId="acc-acme" fixture="A" today={TODAY} />);
    expect(within(card).getByRole("button", { name: /Acme Ltd/ })).toBeInTheDocument();
  });

  it("Change billing account can open the account it moves the company to, in the same sheet", async () => {
    const user = userEvent.setup();
    replace.mockReset();
    const nexora = {
      entity_id: "e-nexora-health-limited",
      entity_name: "Nexora Health Limited",
      past_due: false,
    };
    const moved = {
      ...ACCOUNTS_OPENED,
      accounts: ACCOUNTS_OPENED.accounts.map((a) =>
        a.id === "acc-company-a"
          ? { ...a, companies: a.companies.filter((c) => c.entity_id !== nexora.entity_id) }
          : a.id === "acc-acme"
            ? { ...a, companies: [nexora] }
            : a,
      ),
      moved: {
        entity_id: nexora.entity_id,
        entity_name: nexora.entity_name,
        from_account: { id: "acc-company-a", name: "Company A Limited" },
        to_account: { id: "acc-acme", name: "Acme Ltd" },
      },
    };
    const posts: { path: string; body: unknown }[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (init?.method === "POST") {
        posts.push({ path, body: JSON.parse(String(init.body)) });
        return reply(200, moved);
      }
      return reply(404, { error: "not_found" });
    });
    render(<SubscriptionOverviewScreen fixture="A" today={TODAY} />);
    const card = await screen.findByRole("region", { name: "Billing account" });
    await user.click(within(card).getByRole("button", { name: /Change billing account/ }));
    const sheet = await screen.findByRole("dialog", { name: "Change billing account" });
    await user.click(within(sheet).getByText("Nexora Health Limited"));
    await user.click(within(sheet).getByRole("button", { name: "Next" }));
    expect(sheet).toHaveAccessibleName("Move Nexora Health Limited to");

    await user.click(within(sheet).getByRole("button", { name: "New billing account" }));
    expect(sheet).toHaveAccessibleName("New billing account");
    // Cancel goes back to where the form was opened from: step 2.
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    expect(sheet).toHaveAccessibleName("Move Nexora Health Limited to");

    await user.click(within(sheet).getByRole("button", { name: "New billing account" }));
    await user.type(within(sheet).getByLabelText("Billing Email"), "ap@acme.test");
    await user.type(within(sheet).getByLabelText("Billing company"), "Acme Ltd");
    await user.click(within(sheet).getByRole("button", { name: "Save billing account" }));

    await waitFor(() => expect(sheet).toHaveAccessibleName("Card added"));
    expect(posts).toEqual([
      {
        path: "/api/me/billing/accounts/move",
        body: { entity: "e-nexora-health-limited", account: "acc-acme" },
      },
    ]);
    // On 01-J, closing IS Done: the account exists.
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(replace).toHaveBeenCalledWith("/subscription?account=acc-acme", { scroll: false });
    expect(within(card).getByRole("status")).toHaveTextContent(
      "Nexora Health Limited is now billed to Acme Ltd.",
    );
  });

  it("a move refused after the account opened leaves it open, and the card says the company stayed", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (input, init) => {
      if (init?.method === "POST") return reply(409, { error: "Settle it there first." });
      return new URL(String(input)).pathname === "/api/me/billing/accounts"
        ? reply(200, ACCOUNTS_OPENED)
        : reply(404, { error: "not_found" });
    });
    render(<SubscriptionOverviewScreen fixture="A" today={TODAY} />);
    const card = await screen.findByRole("region", { name: "Billing account" });
    await user.click(within(card).getByRole("button", { name: /Change billing account/ }));
    const sheet = await screen.findByRole("dialog", { name: "Change billing account" });
    await user.click(within(sheet).getByText("Nexora Health Limited"));
    await user.click(within(sheet).getByRole("button", { name: "Next" }));
    await user.click(within(sheet).getByRole("button", { name: "New billing account" }));
    await user.type(within(sheet).getByLabelText("Billing Email"), "ap@acme.test");
    await user.type(within(sheet).getByLabelText("Billing company"), "Acme Ltd");
    await user.click(within(sheet).getByRole("button", { name: "Save billing account" }));
    await user.click(await within(sheet).findByRole("button", { name: "Done" }));

    // An alert, not a status: the company the payer asked to move did not.
    expect(within(card).getByRole("alert")).toHaveTextContent(
      "Your new billing account is ready, but Nexora Health Limited is still billed to Company A Limited.",
    );
  });

  it("08-B with no account opens onboarding's form straight away, and Cancel closes it", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/api/me/billing/accounts") return reply(200, ACCOUNTS_NONE);
      if (init?.method === "POST" && path.endsWith("/setup-intent")) {
        return reply(200, {
          client_secret: "seti_1_secret",
          publishable_key: "pk_test_1",
          setup_intent: "seti_1",
        });
      }
      if (path === "/api/me/billing/payment-methods") return reply(200, WALLET_NONE);
      return reply(404, { error: "not_found" });
    });
    render(<BillingPageScreen />);
    await user.click(await screen.findByRole("button", { name: "Open a billing account" }));

    // No list to pick from: the sheet opens on the form, as onboarding's does on an empty wallet.
    const sheet = await screen.findByRole("dialog", { name: "New billing account" });
    expect(await within(sheet).findByLabelText("Billing company")).toBeInTheDocument();
    await user.click(within(sheet).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("Change billing account moves a company in two steps, and says where it went", async () => {
    const user = userEvent.setup();
    const moved = {
      ...ACCOUNTS,
      accounts: [
        {
          ...ACCOUNTS.accounts[0],
          companies: ACCOUNTS.accounts[0].companies.filter(
            (c) => c.entity_id !== "e-nexora-health-limited",
          ),
        },
        {
          ...ACCOUNTS.accounts[1],
          companies: [
            ...ACCOUNTS.accounts[1].companies,
            {
              entity_id: "e-nexora-health-limited",
              entity_name: "Nexora Health Limited",
              past_due: false,
            },
          ],
        },
        ACCOUNTS.accounts[2],
      ],
      moved: {
        entity_id: "e-nexora-health-limited",
        entity_name: "Nexora Health Limited",
        from_account: { id: "acc-company-a", name: "Company A Limited" },
        to_account: { id: "acc-vine", name: "Vine Consulting Limited" },
      },
    };
    const posts: { path: string; body: unknown }[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      posts.push({ path: new URL(String(input)).pathname, body: JSON.parse(String(init?.body)) });
      return reply(200, moved);
    });
    render(<SubscriptionOverviewScreen fixture="A" today={TODAY} />);
    const card = await screen.findByRole("region", { name: "Billing account" });

    await user.click(within(card).getByRole("button", { name: /Change billing account/ }));
    // The button is a control: the move opens, not the picker.
    const step1 = await screen.findByRole("dialog", { name: "Change billing account" });
    // A company whose payment failed cannot move: its debt follows the account it is on.
    expect(within(step1).getByRole("radio", { name: /Willow Court Limited/ })).toBeDisabled();
    expect(within(step1).getByRole("button", { name: "Next" })).toBeDisabled();
    await user.click(within(step1).getByText("Nexora Health Limited"));
    await user.click(within(step1).getByRole("button", { name: "Next" }));

    const step2 = await screen.findByRole("dialog", { name: "Move Nexora Health Limited to" });
    expect(within(step2).getByRole("radio", { name: /Company A Limited/ })).toBeDisabled();
    // The never-named account is in dunning: nothing moves onto a failing collection.
    expect(within(step2).getByRole("radio", { name: /Olive Vine/ })).toBeDisabled();
    expect(step2).not.toHaveTextContent("Nothing is charged now."); // the note was taken out
    await user.click(within(step2).getByText("Vine Consulting Limited"));
    await user.click(within(step2).getByRole("button", { name: "Confirm" }));

    expect(posts).toEqual([
      {
        path: "/api/me/billing/accounts/move",
        body: { entity: "e-nexora-health-limited", account: "acc-vine" },
      },
    ]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(card).getByRole("status")).toHaveTextContent(
      "Nexora Health Limited is now billed to Vine Consulting Limited.",
    );
  });

  it("a refused move stays open on the API's own words", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async () =>
      reply(409, {
        error: "Vine Consulting Limited has no card it can charge. Add a card to it first.",
      }),
    );
    render(<SubscriptionOverviewScreen fixture="A" today={TODAY} />);
    const card = await screen.findByRole("region", { name: "Billing account" });
    await user.click(within(card).getByRole("button", { name: /Change billing account/ }));
    await user.click(within(await screen.findByRole("dialog")).getByText("Solera Group Limited"));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(within(screen.getByRole("dialog")).getByText("Vine Consulting Limited"));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent(
      "has no card it can charge",
    );
  });

  it("the accounts failing to load leave the card on the payer, with a retry, and the page up", async () => {
    // Every GET answers the list page - so the accounts read gets the wrong shape and fails.
    fetchMock.mockImplementation(async () =>
      reply(200, {
        ...LIST_FIXTURES.A.page,
        total: LIST_FIXTURES.A.page.entities.length,
        page: 1,
        pages: 1,
        per_page: 100,
        sort: "entity",
        direction: "asc",
        query: "",
      }),
    );
    render(<SubscriptionOverviewScreen today={TODAY} />);
    const card = await screen.findByRole("region", { name: "Billing account" });
    expect(card).toHaveTextContent("Olive Vine");
    expect(card).toHaveTextContent("I couldn't load your billing accounts.");
    expect(within(card).getByRole("button", { name: "Try again" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Subscription Overview" })).toBeVisible();
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
