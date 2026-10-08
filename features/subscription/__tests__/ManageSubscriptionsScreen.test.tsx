// The list as a person sees it, per Figma frame: the banner, the transfer card, the rows and
// their cells, the ⋮ menu's three shapes, the trial dialog, and the empty / no-match / error
// states. Located by role and text.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import { ACCOUNTS } from "@/features/subscription/__fixtures__/billing";
import { SUMMARY_FIXTURES, TODAY, WALLET } from "@/features/subscription/__fixtures__/modulePage";
import {
  ENTITIES,
  INCOMING_TRANSFERS,
  subscriptionsPage,
} from "@/features/subscription/__fixtures__/subscriptions";
import type { PayerSubscriptions } from "@/features/subscription/api/payerPortal";
import { CALCULATING_MS } from "@/features/subscription/hooks/useEntitySummary";
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

/** The list as a trial started on the module settings page arrives at it (RV11). */
async function showStarted(code: string, model = SUMMARY_FIXTURES.M21) {
  serve(subscriptionsPage());
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/transfers")) return reply(200, { transfers: [] });
    if (/^\/api\/entities\/[^/]+\/modules$/.test(url.pathname)) return reply(200, model);
    if (url.pathname === "/api/me/billing/entity-payment-method") return reply(200, WALLET);
    return reply(200, subscriptionsPage());
  });
  render(
    <ToastProvider>
      <ManageSubscriptionsScreen
        today={TODAY}
        focusEntityId={ENTITIES[0].entity_id}
        startedCode={code}
      />
    </ToastProvider>,
  );
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

// The 1.2s "Calculating…" beat goes on top of the usual 2.5s find budget, not inside it: a
// bare 2500 left a loaded CI runner ~1.3s to render and flaked two different tests. Every find
// that waits out a beat uses this; the suite's per-test timeout leaves room for two beats.
// 2500 was still not enough - CI flaked again (run 37582261300, the 06 billing-accounts test),
// because 59 files build their jsdom environments at once on a 2-core runner and the beat is
// real time. A waiting budget costs nothing when the app is quick, so it is generous.
const AFTER_BEAT = { timeout: CALCULATING_MS + 6000 };

const rowOf = (name: string) => within(screen.getByText(name).closest("li") as HTMLElement);

// Two AFTER_BEAT waits plus userEvent's own pacing have to fit inside one test (06 does both).
describe("ManageSubscriptionsScreen", { timeout: 30_000 }, () => {
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

  // A trial establishes no SUBSCRIBER (the user, 2026-10-08), and the list is built from the
  // payer's own rows - so without this a company you just trialled would vanish from the one
  // screen that answers "what am I running?". The API lists it with `has_subscriber: false`.
  it("a company nobody pays for is listed, and the OPEN row offers Activate Subscription", async () => {
    const [first, ...rest] = ENTITIES;
    const unactivated = { ...first, subscriber: null, has_subscriber: false };
    const posts: [string, unknown][] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/transfers")) return reply(200, { transfers: [] });
      if (url.pathname === "/api/me/billing/accounts") return reply(200, ACCOUNTS);
      if (init?.method === "POST") {
        posts.push([url.pathname, JSON.parse(String(init.body ?? "{}"))]);
        return reply(200, { ok: true, charged: false });
      }
      if (/^\/api\/entities\/[^/]+\/modules$/.test(url.pathname))
        return reply(200, SUMMARY_FIXTURES.M44);
      if (url.pathname === "/api/me/billing/entity-payment-method") return reply(200, WALLET);
      return reply(200, subscriptionsPage([unactivated, ...rest]));
    });
    render(
      <ToastProvider>
        <ManageSubscriptionsScreen today={TODAY} />
      </ToastProvider>,
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("status", { name: "Loading your subscriptions" }),
      ).not.toBeInTheDocument(),
    );

    // The CLOSED row offers nothing (the user, 2026-10-08): activating is asked inside.
    expect(
      rowOf(unactivated.entity_name).queryByRole("button", { name: /Activate Subscription/ }),
    ).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: `Open ${unactivated.entity_name}` }),
    );
    const panel = within(
      await screen.findByRole("region", { name: "Subscription Summary" }, AFTER_BEAT),
    );
    // Nothing ticked yet, so the panel offers NO act at all (the user, 2026-10-08: the button
    // must not sit under "No pending changes").
    expect(panel.queryByRole("button", { name: "Activate Subscription" })).toBeNull();
    expect(panel.queryByRole("button", { name: "Confirm Subscription Change" })).toBeNull();

    // Tick a module and it is Activate Subscription that appears - Confirm Subscription
    // Change's slot, since a company with no subscriber has to get one before anything can be
    // confirmed.
    const item = screen.getByRole("region", { name: "Subscription Summary" }).closest("li")!;
    await userEvent.click(
      within(item).getByRole("checkbox", { name: "Petty Cash subscription" }),
    );
    const activate = await within(item).findByRole(
      "button",
      { name: "Activate Subscription" },
      AFTER_BEAT,
    );
    expect(within(item).queryByRole("button", { name: "Confirm Subscription Change" })).toBeNull();
    await userEvent.click(activate);

    // It asks in the SAME section-06 modal a change asks in (the user, 2026-10-08) - the person
    // chose the same modules and reads the same words - and only then opens Billing Accounts.
    const modal = within(await screen.findByRole("dialog"));
    expect(modal.getByRole("button", { name: /^Confirm Change/ })).toBeVisible();
    await userEvent.click(modal.getByRole("button", { name: /^Confirm Change/ }));

    const sheet = within(await screen.findByRole("dialog", { name: "Billing Accounts" }));
    await userEvent.click(sheet.getByRole("button", { name: "Confirm" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    // ONE request: it places the company, records consent and makes the viewer its
    // subscriber. No `codes`, so nothing is charged.
    expect(posts[0][0]).toBe(`/api/entities/${unactivated.entity_id}/modules/activate-subscription`);
    expect(posts[0][1]).toEqual({ account: "acc-company-a" });
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
    // 05·D: Cancel subscription is the tick of every active module - the row opens (M44 for
    // everyone here: both active, so nothing is left) and the modal asks for that change.
    await userEvent.click(screen.getByRole("menuitem", { name: "Cancel subscription" }));
    const ask = await screen.findByRole("dialog");
    expect(ask).toHaveAccessibleName("Cancel Subscription?");
    expect(within(ask).getByText("Solera Group Limited")).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole("button", { name: "Go back" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const opened = (
      await screen.findByRole(
        "region",
        { name: "Subscription Summary", busy: false },
        // Cancel subscription ticked every active module, which arms the 1.2s "Calculating…"
        // beat - half the 2.5s default budget before the row can settle at all. The beat goes
        // on top of the usual budget, not inside it (as useEntitySummary.test.tsx does).
        AFTER_BEAT,
      )
    ).closest("li")!;
    expect(opened).toHaveAttribute("data-entity", "e-solera-group-limited");
    expect(
      within(opened)
        .getAllByRole("checkbox")
        .map((c) => c.getAttribute("aria-checked")),
    ).toEqual(["false", "false"]);
    expect(push).not.toHaveBeenCalled();

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
    // the same lockup as the module page's, with a name short enough for one line
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Start Free Trial for Petty Cash");
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
      `${env.SUBSCRIPTION_API_URL}/api/entities/e-harbour-vine-limited/modules/start-trial`,
    );
    expect(JSON.parse(String(post![1]?.body))).toEqual({ codes: ["PAYMENT_REQUEST"] });
  });

  it("the whole row opens the company, but its own controls do not", async () => {
    await show(subscriptionsPage());

    // The name, not the chevron.
    await userEvent.click(screen.getByText("Kestrel Foods Limited"));
    const open = await screen.findByRole("region", { name: "Subscription Summary", busy: false });
    expect(open.closest("li")).toHaveAttribute("data-entity", "e-kestrel-foods-limited");

    // The ⋮ inside a row does its own job and leaves the row alone.
    await userEvent.click(screen.getByRole("button", { name: "Actions for Solera Group Limited" }));
    expect(screen.getAllByRole("menuitem").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("region", { name: "Subscription Summary" })).toHaveLength(1);
    expect(
      screen.getByRole("region", { name: "Subscription Summary" }).closest("li"),
    ).toHaveAttribute("data-entity", "e-kestrel-foods-limited");
  });

  it("a cell's Start Trial asks, and does not open the row behind it", async () => {
    await show(subscriptionsPage());

    await userEvent.click(
      screen.getByRole("button", { name: "Start Trial · Petty Cash · Harbour & Vine Limited" }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Subscription Summary" })).toBeNull();
  });

  it("05·A: a row's chevron opens it in place, one at a time; the column arrows sort", async () => {
    await show(subscriptionsPage());
    await userEvent.click(screen.getByRole("button", { name: "Open Kestrel Foods Limited" }));
    expect(push).not.toHaveBeenCalled();
    const open = await screen.findByRole("region", { name: "Subscription Summary", busy: false });
    const row = open.closest("li") as HTMLElement;
    expect(row).toHaveAttribute("data-entity", "e-kestrel-foods-limited");
    expect(
      within(row).getByRole("button", { name: "Close Kestrel Foods Limited" }),
    ).toBeInTheDocument();
    // The list's other rows keep their cells; only the open one grows.
    expect(screen.getAllByRole("region", { name: "Subscription Summary" })).toHaveLength(1);

    // Opened, it is what the person looks at: scrolled to and focused, from the chevron...
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toContain(row);
    expect(within(row).getByRole("button", { name: "Close Kestrel Foods Limited" })).toHaveFocus();

    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Open Mino Market Limited" }));
    const opened = await screen.findByRole("region", { name: "Subscription Summary", busy: false });
    expect(opened.closest("li")).toHaveAttribute("data-entity", "e-mino-market-limited");
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toContain(
      opened.closest("li"),
    );
    expect(
      screen.queryByRole("button", { name: "Close Kestrel Foods Limited" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Close Mino Market Limited" }));
    expect(screen.queryByRole("region", { name: "Subscription Summary" })).not.toBeInTheDocument();

    // ...and from a click anywhere on the row.
    await userEvent.click(screen.getByText("Kestrel Foods Limited"));
    const clicked = await screen.findByRole("region", { name: "Subscription Summary", busy: false });
    const clickedRow = clicked.closest("li") as HTMLElement;
    expect(clickedRow).toHaveAttribute("data-entity", "e-kestrel-foods-limited");
    expect(
      within(clickedRow).getByRole("button", { name: "Close Kestrel Foods Limited" }),
    ).toHaveFocus();
    await userEvent.click(within(clickedRow).getByRole("button", { name: "Close Kestrel Foods Limited" }));

    await userEvent.click(screen.getByRole("button", { name: "Sort by Entity Name" }));
    const names = screen.getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent);
    expect(names[0]).toBe("Aetheria Capital Limited");
  });

  it("opens the company from ?entity= and brings it into view", async () => {
    await show(subscriptionsPage(), [], "e-solera-group-limited");
    const open = await screen.findByRole("region", { name: "Subscription Summary", busy: false });
    expect(open.closest("li")).toHaveAttribute("data-entity", "e-solera-group-limited");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("04-B: nothing paid for", async () => {
    await show(subscriptionsPage([]));
    expect(screen.getByText("You're not paying for anything yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to entity list" })).toHaveAttribute(
      "href",
      "/entities",
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
    // Back leaves for the portal's landing (08-A), as every 05·C frame's hotspot says.
    await userEvent.click(
      within(item).getByRole("button", { name: "Back to Manage Subscriptions" }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/subscription"));
  });

  it("06: Confirm Subscription Change asks in the change's modal; Go back keeps the tick", async () => {
    serve(subscriptionsPage());
    render(
      <ToastProvider>
        <ManageSubscriptionsScreen today={TODAY} focusEntityId={ENTITIES[0].entity_id} />
      </ToastProvider>,
    );
    const row = await screen.findByRole("region", { name: "Subscription Summary", busy: false });
    const item = row.closest("li")!;
    // M44 for everyone: untick Petty Cash - a removal while Payment Request stays.
    await userEvent.click(within(item).getByRole("checkbox", { name: "Petty Cash subscription" }));
    // The panel calculates for a beat (05·B-C) before the change and its button appear.
    expect(within(item).getByRole("status")).toHaveTextContent("Calculating");
    await userEvent.click(
      await within(item).findByRole(
        "button",
        { name: "Confirm Subscription Change" },
        AFTER_BEAT,
      ),
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

  it("the panel's Change opens Billing Accounts as a move: where it is billed now says so, another account takes it, the card follows", async () => {
    // Lantern Bay is on Vine Consulting (Amex 1007) in the accounts fixture.
    const lantern = ENTITIES.find((e) => e.entity_name === "Lantern Bay Limited")!;
    const posts: [string, unknown][] = [];
    const moved = {
      ...ACCOUNTS,
      accounts: ACCOUNTS.accounts.map((a) =>
        a.id === "acc-vine"
          ? { ...a, companies: a.companies.filter((c) => c.entity_id !== lantern.entity_id) }
          : a.id === "acc-company-a"
            ? {
                ...a,
                companies: [
                  ...a.companies,
                  { entity_id: lantern.entity_id, entity_name: lantern.entity_name, past_due: false },
                ],
              }
            : a,
      ),
      moved: null,
    };
    // The card is the ACCOUNT's: once moved, the company's read answers Company A's Visa.
    const onAmex = {
      ...WALLET,
      nominated_id: "pm_amex1007",
      methods: [
        {
          ...WALLET.methods[0],
          id: "pm_amex1007",
          brand: "amex",
          brand_label: "Amex",
          last4: "1007",
          label: "Amex •••• 1007",
        },
      ],
    };
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/transfers")) return reply(200, { transfers: [] });
      if (url.pathname === "/api/me/billing/accounts") return reply(200, ACCOUNTS);
      if (init?.method === "POST") {
        posts.push([url.pathname, JSON.parse(String(init.body ?? "{}"))]);
        return reply(200, moved);
      }
      if (url.pathname === "/api/me/billing/entity-payment-method")
        return reply(200, posts.length ? WALLET : onAmex);
      if (/^\/api\/entities\/[^/]+\/modules$/.test(url.pathname))
        return reply(200, SUMMARY_FIXTURES.M44);
      return reply(200, subscriptionsPage());
    });
    render(
      <ToastProvider>
        <ManageSubscriptionsScreen today={TODAY} focusEntityId={lantern.entity_id} />
      </ToastProvider>,
    );
    const panel = await screen.findByRole("region", { name: "Subscription Summary", busy: false });
    expect(panel).toHaveTextContent("Amex 1007");
    await userEvent.click(within(panel).getByRole("button", { name: "Change" }));

    // The same sheet Confirm Subscription Change opens - with no change behind it: nothing is
    // posted, nothing is preselected, and the account the company is on is not a choice.
    const sheet = await screen.findByRole("dialog", { name: "Billing Accounts" });
    expect(
      within(sheet).getByText(`Choose the account that pays for ${lantern.entity_name}.`),
    ).toBeInTheDocument();
    expect(posts).toEqual([]);
    expect(push).not.toHaveBeenCalled();
    const radios = within(sheet).getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => [r.value, r.checked, r.disabled])).toEqual([
      ["acc-company-a", false, false],
      ["acc-vine", false, true],
      ["acc-legacy", false, true],
    ]);
    expect(radios[1].closest("label")).toHaveTextContent("Billed here now");
    expect(radios[2].closest("label")).toHaveTextContent("Payment failed");
    expect(within(sheet).getByRole("button", { name: "Confirm" })).toBeDisabled();

    await userEvent.click(radios[0]);
    await userEvent.click(within(sheet).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // The move, and ONLY the move: a change of account applies nothing and charges nothing.
    expect(posts).toEqual([
      ["/api/me/billing/accounts/move", { entity: lantern.entity_id, account: "acc-company-a" }],
    ]);
    expect(
      await screen.findByText("Lantern Bay Limited is now billed to Company A Limited."),
    ).toBeInTheDocument();
    // The row read its card again, and the card is the account's.
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Subscription Summary" })).toHaveTextContent(
        "Visa 4121",
      ),
    );
    expect(screen.getByRole("region", { name: "Subscription Summary" })).not.toHaveTextContent(
      "Amex 1007",
    );
  });

  it("06 → Billing Accounts → payment: a change that bills asks in its modal, then which account pays", async () => {
    const posts: [string, unknown][] = [];
    // The payment is held until released: the sheet must say it is working meanwhile.
    let pay!: () => void;
    const paid = new Promise<void>((resolve) => (pay = resolve));
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/transfers")) return reply(200, { transfers: [] });
      if (url.pathname === "/api/me/billing/entity-payment-method") return reply(200, WALLET);
      if (url.pathname === "/api/me/billing/accounts") return reply(200, ACCOUNTS);
      if (init?.method === "POST") {
        posts.push([url.pathname, JSON.parse(String(init.body ?? "{}"))]);
        if (url.pathname.endsWith("/accounts/move")) return reply(200, { ...ACCOUNTS, moved: null });
        await paid;
        return reply(200, { ok: true });
      }
      // M45 (Payment Request's cancellation pending) until it is renewed, M44 after.
      if (/^\/api\/entities\/[^/]+\/modules$/.test(url.pathname))
        return reply(
          200,
          posts.some(([p]) => p.endsWith("/renew")) ? SUMMARY_FIXTURES.M44 : SUMMARY_FIXTURES.M45,
        );
      return reply(200, subscriptionsPage());
    });
    render(
      <ToastProvider>
        <ManageSubscriptionsScreen today={TODAY} focusEntityId={ENTITIES[0].entity_id} />
      </ToastProvider>,
    );
    const row = await screen.findByRole("region", { name: "Subscription Summary", busy: false });
    const item = row.closest("li")!;
    await userEvent.click(
      within(item).getByRole("checkbox", { name: "Payment Request subscription" }),
    );
    await userEvent.click(
      await within(item).findByRole(
        "button",
        { name: "Confirm Subscription Change" },
        AFTER_BEAT,
      ),
    );

    // The change's modal asks first; nothing is read about accounts or posted yet.
    const unlocked = await screen.findByRole("dialog", { name: "You have unlocked Super Minty" });
    expect(within(unlocked).getByText("You’ve activated both modules.")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/billing/accounts"))).toBe(
      false,
    );
    // It bills: its Confirm opens "Billing Accounts" in its place. Nothing is posted until an
    // account is chosen.
    await userEvent.click(within(unlocked).getByRole("button", { name: "Confirm" }));
    const sheet = await screen.findByRole("dialog", { name: "Billing Accounts" });
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      within(sheet).getByText(`Choose the account that pays for ${ENTITIES[0].entity_name}.`),
    ).toBeInTheDocument();
    expect(posts).toEqual([]);
    // The company is on no account: the first that can take it is picked; the account whose
    // collection is failing cannot, and says so.
    const radios = within(sheet).getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => [r.value, r.checked, r.disabled])).toEqual([
      ["acc-company-a", true, false],
      ["acc-vine", false, false],
      ["acc-legacy", false, true],
    ]);
    expect(radios[2].closest("label")).toHaveTextContent("Payment failed");

    await userEvent.click(radios[1]);
    await userEvent.click(within(sheet).getByRole("button", { name: "Confirm" }));
    await waitFor(() =>
      expect(posts.map(([path]) => path)).toEqual([
        "/api/me/billing/accounts/move",
        `/api/entities/${ENTITIES[0].entity_id}/modules/renew`,
      ]),
    );
    expect(posts[0][1]).toEqual({ entity: ENTITIES[0].entity_id, account: "acc-vine" });

    // Moved, and the payment is on its way: the sheet stays up - the only dialog - and says it
    // is working; nothing in it can be pressed, and Escape does not close it.
    const confirming = within(sheet).getByRole("button", { name: "Confirming…" });
    expect(confirming).toBeDisabled();
    expect(confirming).toHaveAttribute("aria-busy", "true");
    expect(within(sheet).getByRole("button", { name: "Close" })).toBeDisabled();
    expect(radios.every((r) => r.disabled)).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(screen.getAllByRole("dialog")).toEqual([sheet]);

    // Paid: the sheet goes and the row lands on its result - no second modal - brought into
    // view, so nobody has to scroll to find it.
    vi.mocked(Element.prototype.scrollIntoView).mockClear();
    pay();
    const landed = await screen.findByText("Congratulations!", {}, AFTER_BEAT);
    expect(screen.queryByRole("dialog")).toBeNull();
    const resultRow = landed.closest("li[data-result]")!;
    // The row's own effect scrolls it, so it lands a commit after the text findByText saw.
    await waitFor(() =>
      expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toContain(resultRow),
    );
  });

  it("05·C: a cancellation retitles the banner and stands alone", async () => {
    await showResult("RV41");
    // The result screen lands after the row's own reads and the calculating beat: under a full
    // file run the default second is not always enough.
    const page = await screen.findByRole(
      "region",
      { name: "Cancellation Scheduled" },
      AFTER_BEAT,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cancellation Scheduled");
    expect(within(page).getByRole("heading", { level: 2 })).toHaveTextContent(
      "Thank you for being part of Minty",
    );
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("RV11: arriving from a trial started on the module page lands on Congratulations", async () => {
    await showStarted("PETTY_CASH");

    const headline = await screen.findByRole("heading", { level: 4, name: "Congratulations!" });
    const row = headline.closest("li")!;
    expect(row).toHaveAttribute("data-result", "celebrate");
    expect(row).toHaveAttribute("data-entity", ENTITIES[0].entity_id);
    // the module's name is its own coloured span inside the line
    const line = within(row).getByText(/free trial has started/);
    expect(line).toHaveTextContent("Petty Cash free trial has started — 30 days, free.");
    expect(within(line).getByText("Petty Cash")).toHaveClass("text-[#ea9713]");
    // M21 has nothing else running, so nothing bills - RV11's own money line.
    expect(within(row).getByText("Nothing is being charged.")).toBeVisible();
    // the other companies are still listed around it
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(1);

    await userEvent.click(
      within(row).getByRole("button", { name: "Back to Manage Subscriptions" }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/subscription"));
  });

  it("a module that is not on trial gets no celebration, just its row", async () => {
    await showStarted("PETTY_CASH", SUMMARY_FIXTURES.M44);

    await screen.findByRole("region", { name: "Subscription Summary", busy: false });
    expect(screen.queryByText("Congratulations!")).toBeNull();
  });
});
