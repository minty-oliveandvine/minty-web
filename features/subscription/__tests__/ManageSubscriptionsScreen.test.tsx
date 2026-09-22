// The list as a person sees it, per Figma frame: the banner, the transfer card, the rows and
// their cells, the ⋮ menu's three shapes, the trial dialog, and the empty / no-match / error
// states. Located by role and text.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import { SUMMARY_FIXTURES, TODAY, WALLET } from "@/features/subscription/__fixtures__/modulePage";
import {
  ENTITIES,
  INCOMING_TRANSFERS,
  subscriptionsPage,
} from "@/features/subscription/__fixtures__/subscriptions";
import type { PayerSubscriptions } from "@/features/subscription/api/payerPortal";
import { ManageSubscriptionsScreen } from "@/features/subscription/routes/ManageSubscriptionsScreen";

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

function serve(page: PayerSubscriptions | Error, transfers: unknown[] = []) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/transfers")) return reply(200, { transfers });
    // The open row's two reads: the company's page model (05·A's M44 for everyone) and its card.
    if (/^\/api\/entities\/[^/]+\/modules$/.test(url.pathname))
      return reply(200, SUMMARY_FIXTURES.M44);
    if (url.pathname === "/api/me/billing/entity-payment-method") return reply(200, WALLET);
    if (page instanceof Error) return reply(500, { error: page.message });
    return reply(200, page);
  });
}

async function showResult(frame: string) {
  serve(subscriptionsPage());
  const view = render(
    <ToastProvider>
      <ManageSubscriptionsScreen
        today={TODAY}
        focusEntityId={ENTITIES[0].entity_id}
        resultFixture={frame}
      />
    </ToastProvider>,
  );
  return view;
}

async function show(
  page: PayerSubscriptions | Error,
  transfers: unknown[] = [],
  focus: string | null = null,
) {
  serve(page, transfers);
  render(
    <ToastProvider>
      <ManageSubscriptionsScreen today={TODAY} focusEntityId={focus} />
    </ToastProvider>,
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("status", { name: "Loading your subscriptions" }),
    ).not.toBeInTheDocument(),
  );
}

const rowOf = (name: string) => within(screen.getByText(name).closest("li") as HTMLElement);

describe("ManageSubscriptionsScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    push.mockReset();
    window.scrollTo = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("04-A: the banner, the transfer card, the sections and their counts", async () => {
    await show(subscriptionsPage(), INCOMING_TRANSFERS);

    expect(
      screen.getByRole("heading", { level: 1, name: "Manage Subscriptions" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to the previous page" })).toBeInTheDocument();
    const transfers = within(screen.getByRole("region", { name: "Transfer requests" }));
    expect(transfers.getByText("New Company Limited")).toBeInTheDocument();
    await userEvent.click(transfers.getByRole("button", { name: "Review and accept" }));
    expect(push).toHaveBeenCalledWith("/subscription/subscriptions/incoming?transfer=t-1");

    expect(
      screen.getByRole("heading", {
        name: `Active Subscriptions (${ENTITIES.length - 1} entities)`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Suspended Subscriptions (1 entity)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Payment failed."); // a suspended module exists
    expect(
      screen.getByRole("searchbox", { name: "Search subscriptions and trials" }),
    ).toBeInTheDocument();
  });

  it("draws each module state's cell", async () => {
    await show(subscriptionsPage());
    expect(
      rowOf("Harbour & Vine Limited").getAllByRole("button", { name: /^Start Trial ·/ }),
    ).toHaveLength(2);
    expect(rowOf("Kestrel Foods Limited").getByText("3 days remaining")).toBeInTheDocument();
    expect(
      rowOf("Mino Market Limited").getByRole("button", {
        name: "Subscribe · Payment Request · Mino Market Limited",
      }),
    ).toBeInTheDocument();
    expect(rowOf("Lantern Bay Limited").getByText("Active")).toBeInTheDocument();
    expect(rowOf("Orchid Lane Limited").getByText(/^Cancels \d+ \w+$/)).toBeInTheDocument();
    expect(rowOf("Willow Court Limited").getByText("Suspended")).toBeInTheDocument();
  });

  it("the ⋮ menu has the shape the row's states call for", async () => {
    await show(subscriptionsPage());

    await userEvent.click(
      screen.getByRole("button", { name: "Actions for Nexora Health Limited" }),
    );
    let items = within(screen.getByRole("menu"))
      .getAllByRole("menuitem")
      .map((el) => el.textContent);
    expect(items).toEqual(["Request transfer", "Cancel subscription"]);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Actions for Solera Group Limited" }));
    items = within(screen.getByRole("menu"))
      .getAllByRole("menuitem")
      .map((el) => el.textContent);
    expect(items).toEqual(["Request transfer", "Cancel subscription", "Reactivate"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Cancel subscription" }));
    expect(push).toHaveBeenCalledWith(
      "/subscription/entities/e-solera-group-limited/modules/cancel",
    );

    await userEvent.click(screen.getByRole("button", { name: "Actions for Halcyon Labs Limited" }));
    items = within(screen.getByRole("menu"))
      .getAllByRole("menuitem")
      .map((el) => el.textContent);
    expect(items).toEqual(["Request transfer", "Reactivate"]);
    await userEvent.click(screen.getByRole("menuitem", { name: "Request transfer" }));
    expect(push).toHaveBeenCalledWith(
      "/subscription/subscriptions/subscriber?entity=e-halcyon-labs-limited",
    );
  });

  it("04-G: Start Trial asks, Go back closes, Confirm posts", async () => {
    await show(subscriptionsPage());
    await userEvent.click(
      screen.getByRole("button", { name: "Start Trial · Petty Cash · Harbour & Vine Limited" }),
    );

    const dialog = within(screen.getByRole("dialog", { name: /Petty Cash/ }));
    expect(dialog.getByText("Harbour & Vine Limited")).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Go back" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Start Trial · Payment Request · Harbour & Vine Limited",
      }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const post = fetchMock.mock.calls.find((c) => String(c[0]).includes("start-trial"));
    expect(String(post![0])).toBe(
      `${env.BILLING_API_URL}/api/entities/e-harbour-vine-limited/modules/start-trial`,
    );
    expect(JSON.parse(String(post![1]?.body))).toEqual({ codes: ["PAYMENT_REQUEST"] });
  });

  it("05·A: a row's chevron opens it in place, one at a time; the column arrows sort", async () => {
    await show(subscriptionsPage());
    await userEvent.click(screen.getByRole("button", { name: "Open Kestrel Foods Limited" }));
    expect(push).not.toHaveBeenCalled();
    const open = await screen.findByRole("region", { name: "Subscription Summary" });
    const row = open.closest("li") as HTMLElement;
    expect(row).toHaveAttribute("data-entity", "e-kestrel-foods-limited");
    expect(
      within(row).getByRole("button", { name: "Close Kestrel Foods Limited" }),
    ).toBeInTheDocument();
    // The list's other rows keep their cells; only the open one grows.
    expect(screen.getAllByRole("region", { name: "Subscription Summary" })).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Open Mino Market Limited" }));
    const opened = await screen.findByRole("region", { name: "Subscription Summary" });
    expect(opened.closest("li")).toHaveAttribute("data-entity", "e-mino-market-limited");
    expect(
      screen.queryByRole("button", { name: "Close Kestrel Foods Limited" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close Mino Market Limited" }));
    expect(screen.queryByRole("region", { name: "Subscription Summary" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Sort by Entity Name" }));
    const names = screen.getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent);
    expect(names[0]).toBe("Aetheria Capital Limited");
  });

  it("opens the company from ?entity= and brings it into view", async () => {
    await show(subscriptionsPage(), [], "e-solera-group-limited");
    const open = await screen.findByRole("region", { name: "Subscription Summary" });
    expect(open.closest("li")).toHaveAttribute("data-entity", "e-solera-group-limited");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("04-B: nothing paid for", async () => {
    await show(subscriptionsPage([]));
    expect(screen.getByText("You're not paying for anything yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to entity list" })).toHaveAttribute(
      "href",
      `${env.MINTY_URL}/entity`,
    );
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("04-C: a search that matches nothing", async () => {
    await show(subscriptionsPage());
    await userEvent.type(screen.getByRole("searchbox"), "acme holdings");
    await waitFor(() => expect(screen.getByText("Nothing matched that.")).toBeInTheDocument());
    expect(
      screen.getByText("Try a company name, a country, or a status like “free trial”."),
    ).toBeInTheDocument();
  });

  it("04-E: could not load, with a retry", async () => {
    await show(new Error("The database is having a moment."));
    const alert = within(screen.getByRole("alert"));
    expect(alert.getByText("We couldn’t load your subscriptions.")).toBeInTheDocument();
    expect(alert.getByText("The database is having a moment.")).toBeInTheDocument();
    serve(subscriptionsPage());
    await userEvent.click(alert.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Active Subscriptions/ })).toBeInTheDocument(),
    );
  });

  it("05·C: a change lands in the row (Congratulations) or on the page (a cancellation)", async () => {
    await showResult("RU22");
    const congratulations = await screen.findByRole("heading", {
      level: 4,
      name: "Congratulations!",
    });
    const item = congratulations.closest("li")!;
    expect(item).toHaveAttribute("data-result", "celebrate");
    expect(item).toHaveAttribute("data-entity", ENTITIES[0].entity_id);
    expect(within(item).getByText(/Nothing charged today/)).toBeInTheDocument();
    // The other companies are still listed around it.
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Manage Subscriptions");
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(1);
    await userEvent.click(
      within(item).getByRole("button", { name: "Back to Manage Subscriptions" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("heading", { level: 4, name: "Congratulations!" })).toBeNull(),
    );
  });

  it("06: Confirm Subscription Change asks in the change's modal; Go back keeps the tick", async () => {
    serve(subscriptionsPage());
    render(
      <ToastProvider>
        <ManageSubscriptionsScreen today={TODAY} focusEntityId={ENTITIES[0].entity_id} />
      </ToastProvider>,
    );
    const row = await screen.findByRole("region", { name: "Subscription Summary" });
    const item = row.closest("li")!;
    // M44 for everyone: untick Petty Cash - a removal while Payment Request stays.
    await userEvent.click(within(item).getByRole("checkbox", { name: "Petty Cash subscription" }));
    await userEvent.click(
      within(item).getByRole("button", { name: "Confirm Subscription Change" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName("Remove Petty Cash?");
    expect(within(dialog).getByText(ENTITIES[0].entity_name)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm Change" })).toHaveAttribute(
      "data-tone",
      "orange",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Go back" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(item).getByRole("checkbox", { name: "Petty Cash subscription" })).toHaveAttribute(
      "data-changed",
      "true",
    );
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(false);
  });

  it("05·C: a cancellation retitles the banner and stands alone", async () => {
    await showResult("RV41");
    const page = await screen.findByRole("region", { name: "Cancellation Scheduled" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cancellation Scheduled");
    expect(within(page).getByRole("heading", { level: 2 })).toHaveTextContent(
      "Thank you for being part of Minty",
    );
    expect(screen.queryByRole("list")).toBeNull();
  });
});
