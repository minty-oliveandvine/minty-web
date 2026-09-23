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

async function show(page: ModulePage, from: "bills" | null = null) {
  serve(page);
  render(
    <ToastProvider>
      <ModuleSettingsScreen entityId="e1" from={from} today={TODAY} />
    </ToastProvider>,
  );
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
}

const card = (name: string) => within(screen.getByRole("article", { name }));

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
    await show(FIXTURES.A, "bills");

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Payments" })).toHaveAttribute(
      "href",
      env.PAYMENTS_WEB_URL,
    );
    expect(screen.getByText("Olive & Vine Limited")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Olive Vine" })).toHaveTextContent("OV");
    // billing-frontend's header: the hamburger opens the drawer with the sections the company has
    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const drawer = within(screen.getByRole("navigation", { name: "Main navigation" }));
    expect(drawer.getByRole("link", { name: "Select entity" })).toHaveAttribute(
      "href",
      `${env.MINTY_URL}/entity`,
    );
    expect(drawer.getByRole("group", { name: "Petty Cash" })).toBeInTheDocument();
    expect(drawer.queryByRole("group", { name: "Payment Request" })).toBeNull(); // billing off in A
    expect(drawer.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    expect(drawer.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    await userEvent.click(drawer.getByRole("button", { name: "Close menu" }));

    const tabs = within(screen.getByRole("navigation", { name: "Settings sections" }));
    expect(tabs.getByRole("link", { name: "Users" })).toHaveAttribute(
      "href",
      `${env.MINTY_URL}/entity/settings/users/e1`,
    );
    expect(tabs.getByText("Module")).toHaveAttribute("aria-current", "page");
    // the portal's tabs are not this page's
    expect(screen.queryByRole("navigation", { name: "Subscription sections" })).toBeNull();
  });

  it("without from=bills the way back is Petty Cash's Reports, and Payment Settings hides when billing is off", async () => {
    await show(FIXTURES.A);
    expect(screen.getByRole("link", { name: "Reports" })).toHaveAttribute(
      "href",
      `${env.MINTY_URL}/entity/e1`,
    );
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
        <ModuleSettingsScreen entityId="e1" from="bills" today={TODAY} />
      </ToastProvider>,
    );
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    const tabs = within(screen.getByRole("navigation", { name: "Settings sections" }));
    expect(tabs.getByRole("link", { name: "Payment Settings" })).toHaveAttribute(
      "href",
      `${env.MINTY_URL}/entity/settings/payments/e1?from=bills`,
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
    // this frame's redesign draws each CTA inside its card
    expect(
      card("Petty Cash").getByRole("button", { name: "Manage Subscription" }),
    ).toBeInTheDocument();
    expect(
      card("Payment Request").getByRole("button", { name: "Start Free Trial" }),
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
    expect(push).toHaveBeenCalledWith("/subscription/entities/e1/modules/activate/PETTY_CASH");
    expect(screen.getByRole("button", { name: "Manage Subscription" })).toBeInTheDocument();
  });

  it("03-E: a cancellation pending", async () => {
    await show(FIXTURES.E);
    expect(card("Petty Cash").getByText("Cancellation pending")).toBeInTheDocument();
    expect(card("Petty Cash").getByText("Ends in 15 days")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resume Subscription" }));
    expect(push).toHaveBeenCalledWith("/subscription/entities/e1/modules/resume/PETTY_CASH");
  });

  it("03-F: both suspended, the banner, and 'here' opens the payment method", async () => {
    await show(FIXTURES.F);
    expect(screen.getAllByText("Subscription Suspended")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Reactivate Subscription" })).toHaveLength(2);
    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Payment failed. Update your payment method here.");
    await userEvent.click(within(banner).getByRole("button", { name: "here" }));
    expect(push).toHaveBeenCalledWith("/subscription/entities/e1/modules/payment-method");
  });

  it("Start Free Trial asks first (04-G), then posts and the page shows the trial", async () => {
    await show(FIXTURES.A);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ modules: { PAYMENT_REQUEST: true } }), { status: 200 }),
    );
    serve(FIXTURES.B);

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

    await waitFor(() =>
      expect(card("Payment Request").getByText("15 days remaining")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe(`${env.BILLING_API_URL}/api/entities/e1/modules/start-trial`);
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
