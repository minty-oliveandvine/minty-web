// The page as a person sees it, per Figma frame: what each card says, which buttons exist,
// where the chrome links. Located by role and text - the design pass may change every class.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";

import {
  FIXTURES,
  NON_MANAGER,
  NOT_ADMIN,
  TODAY,
  type FixtureFrame,
} from "@/features/subscription/__fixtures__/modulePage";
import type { ModulePage } from "@/features/subscription/api/moduleSettings";
import { ModuleSettingsScreen } from "@/features/subscription/routes/ModuleSettingsScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

const fetchMock = vi.fn<typeof fetch>();

function serve(page: ModulePage) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(page), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function show(page: ModulePage) {
  serve(page);
  render(
    <ToastProvider>
      <ModuleSettingsScreen entityId="e1" today={TODAY} />
    </ToastProvider>,
  );
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
}

const card = (name: string) => within(screen.getByRole("article", { name }));
/** A card's list item: the card and what is drawn under it. */
const under = (name: string) => within(screen.getByRole("article", { name }).closest("li")!);

/** The lines of a modal title, as its hard breaks divide them. */
const titleLines = (heading: HTMLElement) =>
  heading.innerHTML
    .split(/<br\s*\/?>/)
    .map((line) => line.replace(/<[^>]*>/g, "").trim())
    .filter(Boolean);

describe("ModuleSettingsScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "e1", "Olive & Vine Limited");
    window.history.replaceState({}, "", "/subscription/entities/e1/modules");
    push.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("draws the settings chrome: the way back, the company, the viewer, the tabs", async () => {
    await show(FIXTURES.A);

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    // "Back" goes where the person came from; its href is the new-tab fallback
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      `${env.PETTY_CASH_URL}/entity/e1/petty-cash`,
    );
    expect(screen.getByText("Olive & Vine Limited")).toBeInTheDocument();
    // the initials: My Profile (a link to the page here - no sidebar around a lone screen)
    expect(screen.getByRole("link", { name: "Olive Vine, My Profile" })).toHaveTextContent("OV");
    // the side menu (Figma 02-D, inside a company): the person first - the way to My Profile -
    // then Select Entity, the sections the company has, and Settings (this page) above Logout
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const drawer = within(screen.getByRole("navigation", { name: "Main navigation" }));
    expect(drawer.getByRole("link", { name: "Olive Vine, My Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(drawer.getByRole("link", { name: "Select Entity" })).toHaveAttribute("href", "/entities");
    expect(drawer.getByRole("group", { name: "Petty Cash" })).toBeInTheDocument();
    expect(drawer.queryByRole("group", { name: "Payment Request" })).toBeNull(); // billing off in A
    expect(drawer.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    expect(drawer.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    const tabs = within(screen.getByRole("navigation", { name: "Settings sections" }));
    expect(tabs.getByRole("link", { name: "Users" })).toHaveAttribute(
      "href",
      `${env.PETTY_CASH_URL}/entity/e1/settings/users`,
    );
    expect(tabs.getByText("Module")).toHaveAttribute("aria-current", "page");
  });

  it("Payment Settings hides when billing is off", async () => {
    await show(FIXTURES.A);
    const tabs = within(screen.getByRole("navigation", { name: "Settings sections" }));
    expect(tabs.getByRole("link", { name: "Petty Cash Settings" })).toBeInTheDocument();
    expect(tabs.queryByRole("link", { name: "Payment Settings" })).toBeNull();
  });

  it("before the page model answers, the pills and the drawer follow the token's claims", async () => {
    // Flask mints petty_cash_enabled / billing_enabled into the token; the API is a 501 stub
    const b64 = (v: string) => Buffer.from(v).toString("base64url");
    const token = `${b64(JSON.stringify({ alg: "HS256" }))}.${b64(
      JSON.stringify({ user_id: "u1", petty_cash_enabled: false, billing_enabled: true }),
    )}.sig`;
    setAuth(token, "e1", "Olive & Vine Limited");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "not_implemented" }), { status: 501 }),
    );
    render(
      <ToastProvider>
        <ModuleSettingsScreen entityId="e1" today={TODAY} />
      </ToastProvider>,
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    const tabs = within(screen.getByRole("navigation", { name: "Settings sections" }));
    expect(tabs.getByRole("link", { name: "Payment Settings" })).toHaveAttribute(
      "href",
      `${env.PETTY_CASH_URL}/entity/e1/settings/payment-request`,
    );
    expect(tabs.queryByRole("link", { name: "Petty Cash Settings" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const drawer = within(screen.getByRole("navigation", { name: "Main navigation" }));
    expect(drawer.getByRole("group", { name: "Payment Request" })).toBeInTheDocument();
    expect(drawer.queryByRole("group", { name: "Petty Cash" })).toBeNull();
  });

  it("03-A: one in trial, one never started", async () => {
    await show(FIXTURES.A);

    expect(screen.getByRole("heading", { level: 2, name: "Modules" })).toBeInTheDocument();
    expect(card("Petty Cash").getByText("3 days remaining")).toBeInTheDocument();
    expect(card("Payment Request").getByText("30 days trial available")).toBeInTheDocument();
    // the onboarding card holds no control: each CTA is under its own card, in its list item
    expect(card("Petty Cash").queryByRole("button")).toBeNull();
    expect(
      under("Petty Cash").getByRole("button", { name: "Manage Subscription" }),
    ).toBeInTheDocument();
    expect(
      under("Payment Request").getByRole("button", { name: "Start Free Trial" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Subscription|Trial/ })).toHaveLength(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("03-B and 03-C: both cards share one CTA, drawn outside the cards", async () => {
    await show(FIXTURES.B);
    expect(screen.getAllByRole("button", { name: "Manage Subscription" })).toHaveLength(1);
    expect(card("Petty Cash").queryByRole("button")).toBeNull();
    expect(card("Payment Request").queryByRole("button")).toBeNull();
    expect(card("Petty Cash").getByText("Trial")).toBeInTheDocument();
    expect(card("Payment Request").getByText("Trial Active")).toBeInTheDocument();
    expect(card("Payment Request").getByText("15 days remaining")).toBeInTheDocument();
  });

  it("03-C: active modules, one link", async () => {
    await show(FIXTURES.C);
    expect(screen.getAllByText("Currently Active")).toHaveLength(2);
    const buttons = screen.getAllByRole("button", { name: "Manage Subscription" });
    expect(buttons).toHaveLength(1);
    await userEvent.click(buttons[0]);
    expect(push).toHaveBeenCalledWith("/subscription/subscriptions?entity=e1");
  });

  it("03-D: an expired trial next to an active module", async () => {
    await show(FIXTURES.D);
    expect(card("Petty Cash").getByText("Trial Expired")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Activate Subscription" }));
    // Activating is one module's pending change: the list, this row, Petty Cash ticked.
    expect(push).toHaveBeenCalledWith("/subscription/subscriptions?entity=e1&tick=PETTY_CASH");
    expect(screen.getByRole("button", { name: "Manage Subscription" })).toBeInTheDocument();
  });

  it("03-E: a cancellation pending", async () => {
    await show(FIXTURES.E);
    expect(card("Petty Cash").getByText("Cancellation pending")).toBeInTheDocument();
    expect(card("Petty Cash").getByText("Ends in 15 days")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resume Subscription" }));
    expect(push).toHaveBeenCalledWith("/subscription/subscriptions?entity=e1&tick=PETTY_CASH");
  });

  it("03-F: both suspended, the banner, and 'here' opens the company's billing account", async () => {
    await show(FIXTURES.F);
    expect(screen.getAllByText("Subscription Suspended")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Reactivate Subscription" })).toHaveLength(2);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Payment failed. Update your payment method here.");
    await userEvent.click(within(banner).getByRole("button", { name: "here" }));
    // the failed card is the billing account's, so 08-B by `?entity=` (2026-09-29)
    expect(push).toHaveBeenCalledWith("/subscription/billing?entity=e1");
  });

  it("Start Free Trial asks first (04-G), then posts and lands on the list's row", async () => {
    await show(FIXTURES.A);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ modules: { PAYMENT_REQUEST: true } }), { status: 200 }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Start Free Trial" }));

    const dialog = within(screen.getByRole("dialog"));
    // the design's copy, word for word
    expect(dialog.getByText(/You've activated free trial for Payment Request\./)).toBeVisible();
    expect(
      dialog.getByText(/You can activate the subscription anytime for uninterrupted access/),
    ).toBeVisible();
    // the lockup: "Start" and "Free Trial for" are always the first two lines, the module's
    // name the third - and the spaces around the breaks keep the spoken name readable
    expect(titleLines(dialog.getByRole("heading", { level: 2 }))).toEqual([
      "Start",
      "Free Trial for",
      "Payment Request",
    ]);
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Start Free Trial for Payment Request");
    expect(fetchMock).toHaveBeenCalledTimes(1); // nothing posted yet

    await userEvent.click(dialog.getByRole("button", { name: "Confirm" }));

    // The news is told on the list, in that company's row (RV11) - this page is left behind.
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/subscription/subscriptions?entity=e1&started=PAYMENT_REQUEST",
      ),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe(`${env.SUBSCRIPTION_API_URL}/api/entities/e1/modules/start-trial`);
    expect(JSON.parse(String(init?.body))).toEqual({ codes: ["PAYMENT_REQUEST"] });
  });

  it("Go back from the trial dialog posts nothing", async () => {
    await show(FIXTURES.A);

    await userEvent.click(screen.getByRole("button", { name: "Start Free Trial" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Go back" }),
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(card("Payment Request").getByText("30 days trial available")).toBeInTheDocument();
  });

  it("someone who may not manage sees the cards, no buttons, and who does", async () => {
    await show(NON_MANAGER);
    const main = within(screen.getByRole("main"));
    expect(main.getByRole("article", { name: "Petty Cash" })).toBeInTheDocument();
    expect(main.queryByRole("button")).toBeNull(); // the header's hamburger is not the page's
    expect(
      screen.getByText(/Billing for this company is managed by Priya Chan/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "priya@example.com" })).toHaveAttribute(
      "href",
      "mailto:priya@example.com",
    );
  });

  it("a non-admin on a company with no payer is told only admins can change modules", async () => {
    await show(NOT_ADMIN);
    expect(within(screen.getByRole("main")).queryByRole("button")).toBeNull();
    expect(screen.getByText("Only admins can change modules.")).toBeInTheDocument();
  });

  it.each(["A", "B", "C", "D", "E", "F"] as FixtureFrame[])(
    "frame 03-%s renders both cards",
    async (frame) => {
      await show(FIXTURES[frame]);
      expect(screen.getByRole("article", { name: "Petty Cash" })).toBeInTheDocument();
      expect(screen.getByRole("article", { name: "Payment Request" })).toBeInTheDocument();
    },
  );
});
