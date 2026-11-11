// "Select Company" as a person sees it: the grid of cards (Flask's cards, across the whole
// screen since 2026-09-29), search, the "+" (in the Minty cat's pop-up 2026-11-05 to 2026-11-11),
// the empty and failed states, what Flask flashed on
// the way here, and the header bar - the initials (My Profile) and the side menu.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContactLauncher } from "@/components/ui/ContactLauncher";
import { SidebarProvider } from "@/components/ui/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";
import { _setViewerLoaderForTests } from "@/lib/viewer";

import { ARCHIVED_ROW, EMPTY, LIST, SUPERUSER } from "@/features/entities/__fixtures__/entities";
import type { EntityListAnswer } from "@/features/entities/api/entities";
import { EntityListScreen } from "@/features/entities/routes/EntityListScreen";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace, back: vi.fn() }),
  usePathname: () => "/entities",
}));

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const fetchMock = vi.fn<typeof fetch>();
const navigate = vi.fn<(url: string) => void>();

function serve(answer: EntityListAnswer | { error: string }, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(answer), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function show(flash: string | null = null) {
  render(
    <ToastProvider>
      <SidebarProvider look="classic">
        <EntityListScreen flash={flash} />
        <ContactLauncher />
      </SidebarProvider>
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
    // the cat is drawn only once the person is known; stubbed, so it reaches no network
    _setViewerLoaderForTests(() => Promise.resolve({ name: "Olive Vine", initials: "OV" }));
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
      `${env.ACCOUNTS_API_URL}/entity/e-scenario-5/enter` +
        `?next=${encodeURIComponent("/entity/e-scenario-5/modules")}`,
    );
    const card = within(five);
    expect(card.getByRole("img", { name: "Free trial: Petty Cash" })).toBeInTheDocument();
    expect(card.getByRole("img", { name: "Petty Cash module" })).toBeInTheDocument();
    // the sidebar's Payment Request icon
    expect(
      card.getByRole("img", { name: "Bills module" }).querySelector("img")?.getAttribute("src"),
    ).toBe("/menu/payment-request.svg");
    expect(card.getByRole("img", { name: /^Last opened .+ by Olive Vine$/ })).toBeInTheDocument();

    // setup in progress: the pill over the card, the grey clock of a company nobody opened yet
    expect(list().getByText("Setup in progress")).toBeInTheDocument();
    const scenario = list().getByRole("link", { name: /^Scenario/ });
    expect(within(scenario).getByRole("img", { name: "Not opened yet" })).toBeInTheDocument();
    expect(list().getAllByRole("link")).toHaveLength(LIST.entities.length);

    // the floating "+" is back (owner, 2026-11-11); the cat no longer offers "Create company"
    expect(screen.queryByRole("menuitem", { name: "Create company" })).toBeNull();
    expect(screen.getByRole("link", { name: "Create company" })).toHaveAttribute(
      "href",
      `${env.ACCOUNTS_API_URL}/entity/create`,
    );
    // one read of the list; nothing else went to the network (the viewer is stubbed out)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${env.ACCOUNTS_API_URL}/api/me/entities`);
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
      `${env.ACCOUNTS_API_URL}/entity/create`,
    );
    expect(screen.queryByRole("link", { name: "Create company" })).toBeNull();
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
    serve({
      ...LIST,
      notices: [
        { category: "error", message: "Hmm, I looked everywhere but couldn't find that one." },
      ],
    });
    show("signed-hand-over");

    expect(
      await screen.findByText("Hmm, I looked everywhere but couldn't find that one."),
    ).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      `${env.ACCOUNTS_API_URL}/api/me/entities?flash=signed-hand-over`,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/entities"));
    expect(
      screen.getAllByText("Hmm, I looked everywhere but couldn't find that one."),
    ).toHaveLength(1);
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
    // no sidebar around a screen rendered on its own: the initials fall back to a link to the list,
    // named for it - there is no /profile page (@minty/shared v0.12)
    const badge = await header.findByRole("link", { name: "Select Entity" });
    expect(badge).toHaveAttribute("href", "/entities");
    expect(badge).toHaveAttribute("title", "Olive Vine");
    expect(badge).toHaveTextContent("OV");

    await userEvent.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const menu = within(screen.getByRole("navigation", { name: "Main navigation" }));
    // and the menu's person is plain text: no sheet to open it in
    expect(menu.queryByRole("link", { name: /My Profile/ })).toBeNull();
    expect(menu.getByRole("link", { name: "Select Entity" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(menu.queryByRole("link", { name: "Settings" })).toBeNull();
  });

  describe("Archive (superusers only)", () => {
    const [first, second] = LIST.entities;
    const MINE: EntityListAnswer = {
      ...LIST,
      is_superuser: true,
      entities: [{ ...first, role: "superadmin" }, { ...second, role: "cashier" }, ARCHIVED_ROW],
    };

    it("lives in a superuser's manage mode, on every company not archived yet", async () => {
      serve(MINE);
      show();
      await screen.findByRole("list", { name: "Your companies" });

      // browsing: every row is its way in, and no row has Archive
      expect(screen.queryByRole("button", { name: /^Archive company / })).toBeNull();
      const manage = screen.getByRole("button", { name: "Archive companies" });
      expect(manage).toHaveAttribute("aria-pressed", "false");

      await userEvent.click(manage);
      expect(screen.getByRole("button", { name: "Done" })).toHaveAttribute("aria-pressed", "true");
      expect(
        screen.getByRole("button", { name: `Archive company ${first.name}` }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: `Archive company ${second.name}` }),
      ).toBeInTheDocument();
      // an archived company is restored, never archived again
      expect(
        screen.queryByRole("button", { name: `Archive company ${ARCHIVED_ROW.name}` }),
      ).toBeNull();
      // managing, a row is not a way in
      expect(list().queryAllByRole("link")).toHaveLength(0);

      await userEvent.click(screen.getByRole("button", { name: "Done" }));
      expect(screen.queryByRole("button", { name: /^Archive company / })).toBeNull();
      expect(list().getByRole("link", { name: new RegExp(`^${first.name}`) })).toBeInTheDocument();
    });

    it("is not offered to an admin who is not a superuser", async () => {
      serve({ ...LIST, entities: LIST.entities.map((e) => ({ ...e, role: "admin" })) });
      show();
      await screen.findByRole("list", { name: "Your companies" });

      expect(screen.queryByRole("button", { name: "Archive companies" })).toBeNull();
    });

    it("asks first, then archives, says so and reads the list again", async () => {
      serve(MINE);
      show();
      await screen.findByRole("list", { name: "Your companies" });

      await userEvent.click(screen.getByRole("button", { name: "Archive companies" }));
      await userEvent.click(screen.getByRole("button", { name: `Archive company ${first.name}` }));
      const dialog = within(screen.getByRole("dialog"));
      expect(dialog.getByRole("heading", { name: `Archive ${first.name}?` })).toBeInTheDocument();
      expect(
        dialog.getByText("It disappears for everyone. Only Minty support can bring it back."),
      ).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      serve({ message: `"${first.name}" is archived.` } as unknown as EntityListAnswer);
      serve({ ...MINE, entities: [MINE.entities[1]] });
      await userEvent.click(dialog.getByRole("button", { name: "Archive company" }));

      expect(await screen.findByText(`"${first.name}" is archived.`)).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).toBeNull();
      const archive = new URL(String(fetchMock.mock.calls[1][0]));
      expect(archive.pathname).toBe(`/api/me/entities/${first.id}/archive`);
      expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("POST");
      await waitFor(() => expect(list().queryByText(first.name)).toBeNull());
    });

    it("a refusal (a paid subscription left) stays in the dialog and archives nothing", async () => {
      serve(MINE);
      show();
      await screen.findByRole("list", { name: "Your companies" });

      await userEvent.click(screen.getByRole("button", { name: "Archive companies" }));
      await userEvent.click(screen.getByRole("button", { name: `Archive company ${first.name}` }));
      const sentence =
        "This company still has a paid subscription. Cancel its subscription first, then archive it.";
      serve({ error: sentence }, 409);
      const dialog = within(screen.getByRole("dialog"));
      await userEvent.click(dialog.getByRole("button", { name: "Archive company" }));

      expect(await dialog.findByRole("alert")).toHaveTextContent(sentence);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(list().getByText(first.name)).toBeInTheDocument();
    });
  });

  it("a person who is not a superuser gets no archive filter", async () => {
    serve(LIST);
    show();
    await screen.findByRole("list", { name: "Your companies" });

    expect(screen.queryByRole("group", { name: "Show companies" })).toBeNull();
  });

  describe("a superuser", () => {
    it("sees archived companies last, with a pill and Restore instead of a way in", async () => {
      serve(SUPERUSER);
      show();
      await screen.findByRole("list", { name: "Your companies" });

      const filter = within(screen.getByRole("group", { name: "Show companies" }));
      expect(filter.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
      // never a link into it, and last in the list
      expect(list().queryByRole("link", { name: /Gold Moon/ })).toBeNull();
      const items = list().getAllByRole("listitem");
      const last = within(items[items.length - 1]);
      expect(last.getByText("Gold Moon Company")).toBeInTheDocument();
      expect(last.getByText("Archived")).toBeInTheDocument();
      expect(last.getByRole("button", { name: "Restore Gold Moon Company" })).toBeInTheDocument();
    });

    it("filters by asking the API, and Archived with none says nothing matched", async () => {
      serve(SUPERUSER);
      show();
      await screen.findByRole("list", { name: "Your companies" });

      serve({ entities: [], notices: [], is_superuser: true });
      await userEvent.click(screen.getByRole("button", { name: "Archived" }));

      expect(await screen.findByText("No companies found.")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "No Entity Found" })).toBeNull();
      expect(screen.getByRole("button", { name: "Archived" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const asked = new URL(String(fetchMock.mock.calls[1][0]));
      expect(asked.pathname).toBe("/api/me/entities");
      expect(asked.searchParams.get("archived")).toBe("archived");
      // the first read asked nothing extra: "All" is the API's own default
      expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.has("archived")).toBe(false);
    });

    it("Restore asks first, then reads the list again and says so", async () => {
      serve(SUPERUSER);
      show();
      await screen.findByRole("list", { name: "Your companies" });

      await userEvent.click(screen.getByRole("button", { name: "Restore Gold Moon Company" }));
      const dialog = within(screen.getByRole("dialog"));
      expect(
        dialog.getByRole("heading", { name: "Restore Gold Moon Company?" }),
      ).toBeInTheDocument();
      expect(dialog.getByText("It comes back for everyone who belongs to it.")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      serve({ message: "Gold Moon Company is back." } as unknown as EntityListAnswer);
      serve({
        ...SUPERUSER,
        entities: [...LIST.entities, { ...ARCHIVED_ROW, archived_at: null }],
      });
      await userEvent.click(dialog.getByRole("button", { name: "Restore" }));

      expect(await screen.findByText("Gold Moon Company is back.")).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).toBeNull();
      const restore = fetchMock.mock.calls[1];
      expect(new URL(String(restore[0])).pathname).toBe("/api/me/entities/e-archived/restore");
      expect((restore[1] as RequestInit).method).toBe("POST");
      expect(await list().findByRole("link", { name: /Gold Moon Company/ })).toBeInTheDocument();
    });

    it("a refused Restore stays in the dialog", async () => {
      serve(SUPERUSER);
      show();
      await screen.findByRole("list", { name: "Your companies" });

      await userEvent.click(screen.getByRole("button", { name: "Restore Gold Moon Company" }));
      serve({ error: "You don't have access to that company." }, 403);
      const dialog = within(screen.getByRole("dialog"));
      await userEvent.click(dialog.getByRole("button", { name: "Restore" }));

      expect(await dialog.findByRole("alert")).toHaveTextContent(
        "You don't have access to that company.",
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
