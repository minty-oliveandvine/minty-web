// My Profile's "Subscriptions Overview" (Figma 10-A / 10-B), which this feature owns: 08-A's own
// figures over the same read, the way into the portal, the quiet empty card - and nothing at
// all while subscriptions are dark.

import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";

import { TODAY } from "@/features/subscription/__fixtures__/modulePage";
import { subscriptionsPage } from "@/features/subscription/__fixtures__/subscriptions";
import { overview } from "@/features/subscription/lib/billing";
import { SubscriptionsOverviewCard } from "@/features/subscription/routes/SubscriptionsOverviewCard";

const fetchMock = vi.fn<typeof fetch>();

function serve(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

const card = () =>
  within(screen.getByRole("region", { name: "Subscriptions Overview" }));

describe("SubscriptionsOverviewCard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("10-A: 08-A's own figures, and Manage Subscription into the portal", async () => {
    const list = subscriptionsPage();
    const expected = overview(list, TODAY);
    serve(list);
    render(<SubscriptionsOverviewCard today={TODAY} />);

    const link = await card().findByRole("link", { name: "Manage Subscription" });
    expect(link).toHaveAttribute("href", "/subscription");
    const active = card().getByText("Active subscriptions").parentElement!;
    const ending = card().getByText("Trial ending").parentElement!;
    expect(active).toHaveTextContent(`Active subscriptions${expected.active}entit`);
    expect(ending).toHaveTextContent(`Trial ending${expected.trialEnding}entit`);
    expect(expected.active).toBeGreaterThan(0); // the fixture is not a trivial zero
  });

  it("10-B: paying for no company, the quiet card and no button", async () => {
    serve(subscriptionsPage([]));
    render(<SubscriptionsOverviewCard today={TODAY} />);

    expect(
      await card().findByText("It looks a little quiet here. No entity subscriptions yet."),
    ).toBeInTheDocument();
    expect(card().queryByRole("link", { name: "Manage Subscription" })).toBeNull();
  });

  it("a read that failed says so in the card", async () => {
    serve({ error: "boom" }, 500);
    render(<SubscriptionsOverviewCard today={TODAY} />);
    expect(await card().findByRole("alert")).toHaveTextContent(
      "Your subscriptions didn't load. Mind trying again?",
    );
  });

  it("a dark API (404) leaves no heading and no card", async () => {
    serve({ error: "not_found" }, 404);
    const { container } = render(<SubscriptionsOverviewCard today={TODAY} />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("switched off, it is not there and reads nothing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUBSCRIPTION_ENABLED", "0");
    vi.resetModules();
    const { SubscriptionsOverviewCard: Dark } = await import(
      "@/features/subscription/routes/SubscriptionsOverviewCard"
    );
    const { container } = render(<Dark today={TODAY} />);
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
