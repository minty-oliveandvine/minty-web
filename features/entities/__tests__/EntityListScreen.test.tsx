// "Select Company" as a person sees it: the grid of cards (Flask's cards, across the whole
// screen since 2026-09-29), search, the "+", the empty and failed states, what Flask flashed on
// the way here, and the header bar - the initials (My Profile) and the side menu.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";
import { _setViewerLoaderForTests } from "@/lib/viewer";

import { EMPTY, LIST } from "@/features/entities/__fixtures__/entities";
import type { EntityListAnswer } from "@/features/entities/api/entities";
import { EntityListScreen } from "@/features/entities/routes/EntityListScreen";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn() }),
}));

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const fetchMock = vi.fn<typeof fetch>();
const navigate = vi.fn<(url: string) => void>();

function serve(answer: EntityListAnswer | { error: string }, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(answer), { status, headers: { "Content-Type": "application/json" } }),
  );
}

function show(flash: string | null = null) {
  render(
    <ToastProvider>
      <EntityListScreen flash={flash} />
    </ToastProvider>,
  );
}

const list = () => within(screen.getByRole("list", { name: "Your companies" }));

describe("EntityListScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    _resetHandoffForTests(navigate);
    setAuth(TOKEN, "", "");
    window.history.replaceState({}, "", "/entities");
    replace.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _resetHandoffForTests();
    _setViewerLoaderForTests(null);
  });

  it("draws every company as Flask did, each card leading into it", async () => {
    serve(LIST);
    show();

    expect(screen.getByRole("heading", { level: 1, name: "Select Company" })).toBeInTheDocument();
    const five = await screen.findByRole("link", { name: /Scenario 5 - Free trial \+ Active/ });
    expect(five.getAttribute("href")).toBe(
      `${env.PETTY_CASH_URL}/entity/e-scenario-5/enter?token=${encodeURIComponent(TOKEN)}` +
        `&next=${encodeURIComponent("/entity/e-scenario-5/modules")}`,
    );
    const card = within(five);
    expect(card.getByRole("img", { name: "Free trial: Petty Cash" })).toBeInTheDocument();
    expect(card.getByRole("img", { name: "Petty Cash module" })).toBeInTheDocument();
    expect(card.getByRole("img", { name: "Bills module" })).toBeInTheDocument();
    expect(card.getByRole("img", { name: /^Last opened .+ by Olive Vine$/ })).toBeInTheDocument();

    // setup in progress: the pill over the card, the grey clock of a company nobody opened yet
    expect(list().getByText("Setup in progress")).toBeInTheDocument();
    const scenario = list().getByRole("link", { name: /^Scenario/ });
    expect(within(scenario).getByRole("img", { name: "Not opened yet" })).toBeInTheDocument();
    expect(list().getAllByRole("link")).toHaveLength(LIST.entities.length);

    expect(screen.getByRole("link", { name: "Add a new entity" })).toHaveAttribute(
      "href",
      `${env.PETTY_CASH_URL}/entity/create`,
    );
    // one read of the list; nothing else went to the network (the viewer is stubbed out)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${env.PETTY_CASH_URL}/api/me/entities`);
  });

  it("searches as the person types, and says so when nothing matches", async () => {
    serve(LIST);
    show();
    await screen.findByRole("list", { name: "Your companies" });

    await userEvent.type(screen.getByRole("textbox", { name: "Search company" }), "both active");
    expect(list().getAllByRole("link")).toHaveLength(1);
    expect(list().getByRole("link", { name: /Scenario 8 - Both Active/ })).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "Search company" }), " nope");
    expect(screen.getByText("No companies found.")).toBeInTheDocument();
  });

  it("with no company at all, the empty page and a way to create one - and no +", async () => {
    serve(EMPTY);
    show();

    expect(await screen.findByRole("heading", { name: "No Entity Found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create Entity" })).toHaveAttribute(
      "href",
      `${env.PETTY_CASH_URL}/entity/create`,
    );
    expect(screen.queryByRole("link", { name: "Add a new entity" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Search company" })).toBeNull();
  });

  it("a list that did not load says so, and tries again", async () => {
    serve({ error: "Your companies didn't load. Mind trying again?" }, 500);
    show();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your companies didn't load. Mind trying again?");
    serve(LIST);
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("list", { name: "Your companies" })).toBeInTheDocument();
  });

  it("says what Flask flashed on the way here, once, and drops the spent hand-over", async () => {
    serve({ ...LIST, notices: [{ category: "error", message: "Hmm, I looked everywhere but couldn't find that one." }] });
    show("signed-hand-over");

    expect(
      await screen.findByText("Hmm, I looked everywhere but couldn't find that one."),
    ).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${env.PETTY_CASH_URL}/api/me/entities?flash=signed-hand-over`,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/entities"));
    expect(screen.getAllByText("Hmm, I looked everywhere but couldn't find that one.")).toHaveLength(1);
  });

  it("a token minted inside a company goes back for one that is not, before reading anything", async () => {
    setAuth(TOKEN, "e1", "Olive Shop");
    show();

    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    const target = new URL(navigate.mock.calls[0][0]);
    expect(target.pathname).toBe("/handoff/minty-web");
    expect(target.searchParams.get("next")).toBe("/entities");
    expect(target.searchParams.has("entity_id")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the header bar: the mark and the title; the initials (My Profile) and the side menu without Settings", async () => {
    _setViewerLoaderForTests(() => Promise.resolve({ name: "Olive Vine", initials: "OV" }));
    serve(LIST);
    show();

    const header = within(screen.getByRole("banner"));
    expect(header.getByRole("heading", { level: 1, name: "Select Company" })).toBeInTheDocument();
    expect(screen.getByRole("banner").querySelector('img[src="/minty-mark.png"]')).not.toBeNull();
    // no sidebar around a screen rendered on its own: the initials are the way to the page
    const badge = await header.findByRole("link", { name: "Olive Vine, My Profile" });
    expect(badge).toHaveAttribute("href", "/profile");
    expect(badge).toHaveAttribute("title", "Olive Vine");
    expect(badge).toHaveTextContent("OV");

    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const menu = within(screen.getByRole("navigation", { name: "Main navigation" }));
    expect(menu.getByRole("link", { name: "Olive Vine, My Profile" })).toHaveAttribute("href", "/profile");
    expect(menu.getByRole("link", { name: "Select Entity" })).toHaveAttribute("aria-current", "page");
    expect(menu.queryByRole("link", { name: "Settings" })).toBeNull();
  });
});
