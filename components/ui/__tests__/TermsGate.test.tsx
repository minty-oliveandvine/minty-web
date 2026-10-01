// The Terms & Conditions gate over every page (Flask's panel, ported): owed, the page is inert
// behind a panel that cannot be dismissed - Accept records the version on screen and the page
// comes back, Cancel logs out; the tick box waits for the end of the document; a 409 reads the
// Terms again. Asked once per token, never on the open pages, and it FAILS OPEN, loudly.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/entities" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

import { TermsGate } from "@/components/ui/TermsGate";
import { TERMS_COPY } from "@/components/ui/TermsModal";
import { getAuth, setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";
import { _resetTermsForTests, type OwedTerms } from "@/lib/terms";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const fetchMock = vi.fn<typeof fetch>();
const navigate = vi.fn<(url: string) => void>();

const OWED: OwedTerms = {
  owed: true,
  document: {
    version: "beta-1",
    effective_date: "18 September 2026",
    html: "<h2>1. Who we are</h2><p>Olive &amp; Vine runs Minty.</p>",
    show_draft_notice: true,
  },
  is_update: false,
  previous_version: null,
  links: { terms: "/legal/terms", privacy: "/legal/privacy", previous: null },
};

function serve(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

function page() {
  return (
    <TermsGate>
      <main>
        <h1>Select Company</h1>
        <a href="/elsewhere">Olive Shop</a>
      </main>
    </TermsGate>
  );
}

async function owed(terms: OwedTerms = OWED) {
  serve(terms);
  const view = render(page());
  const dialog = await screen.findByRole("dialog", { name: TERMS_COPY.title });
  return { ...view, panel: within(dialog), dialog };
}

const tickBox = () => screen.getByRole("checkbox");
const acceptButton = () => screen.getByRole("button", { name: TERMS_COPY.accept });

describe("TermsGate", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    _resetHandoffForTests(navigate);
    _resetTermsForTests();
    setAuth(TOKEN, "", "");
    nav.pathname = "/entities";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _resetHandoffForTests();
  });

  it("owed: Flask's panel over the page, and the page behind out of reach", async () => {
    const { panel, container } = await owed();

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${env.MINTY_URL}/api/me/terms`);
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${TOKEN}`);

    expect(panel.getByText(TERMS_COPY.lead)).toBeInTheDocument();
    expect(panel.getByText(/This wording is not final/)).toBeInTheDocument();
    expect(panel.getByText("Last updated: 18 September 2026")).toBeInTheDocument();
    const doc = panel.getByRole("region", { name: "The Terms & Conditions" });
    expect(within(doc).getByRole("heading", { name: "1. Who we are" })).toBeInTheDocument();
    expect(within(doc).getByText("Olive & Vine runs Minty.")).toBeInTheDocument();
    for (const [name, path] of [
      ["Terms & Conditions", "/legal/terms"],
      ["Privacy Policy", "/legal/privacy"],
    ]) {
      const link = panel.getByRole("link", { name });
      expect(link).toHaveAttribute("href", `${env.MINTY_URL}${path}`);
      expect(link).toHaveAttribute("target", "_blank");
    }
    expect(tickBox()).not.toBeChecked();
    expect(acceptButton()).toBeDisabled();

    // the page is still there, but inert and hidden from assistive technology
    expect(screen.queryByRole("heading", { name: "Select Company" })).toBeNull();
    expect(container.querySelector("[inert]")).toContainElement(screen.getByText("Olive Shop"));
  });

  it("not dismissible: Escape does nothing, and focus stays inside it", async () => {
    const { dialog } = await owed();
    await waitFor(() => expect(dialog).toHaveFocus());
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: TERMS_COPY.title })).toBeInTheDocument();

    // backwards from the start comes round to the last control, forwards from it to the first
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: TERMS_COPY.cancel })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("region", { name: "The Terms & Conditions" })).toHaveFocus();
  });

  it("Accept & Continue: once ticked, it records the version on screen and the page comes back", async () => {
    await owed();
    await waitFor(() => expect(tickBox()).toBeEnabled()); // jsdom's document does not scroll
    await userEvent.click(tickBox());
    expect(acceptButton()).toBeEnabled();

    serve({ ok: true, terms_version: "beta-1" });
    await userEvent.click(acceptButton());

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe(`${env.MINTY_URL}/api/me/terms/accept`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ accepted: true, terms_version: "beta-1" });
    expect(screen.getByRole("heading", { name: "Select Company" })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled(); // they stay on the page they are on

    // and this token is not asked again on the next page
    nav.pathname = "/subscription";
    render(page());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("the tick box waits until the document has been read to its end", async () => {
    let top = 0;
    const onDoc = (el: Element, doc: number, other: number) =>
      el.getAttribute("role") === "region" ? doc : other;
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(function (this: Element) {
      return onDoc(this, 1000, 0);
    });
    vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(function (this: Element) {
      return onDoc(this, 400, 0);
    });
    vi.spyOn(Element.prototype, "scrollTop", "get").mockImplementation(() => top);

    await owed();
    const doc = screen.getByRole("region", { name: "The Terms & Conditions" });
    // locked, and a screen reader is told why
    await new Promise((r) => setTimeout(r, 20));
    expect(tickBox()).toBeDisabled();
    expect(tickBox()).toHaveAccessibleDescription(TERMS_COPY.scrollHint);

    top = 300;
    fireEvent.scroll(doc);
    expect(tickBox()).toBeDisabled();

    top = 597; // within the 4 px of the end
    fireEvent.scroll(doc);
    await waitFor(() => expect(tickBox()).toBeEnabled());
    expect(tickBox()).not.toHaveAccessibleDescription(TERMS_COPY.scrollHint);
  });

  it("409 - the Terms changed while it sat open: they are read again, unticked", async () => {
    await owed();
    await waitFor(() => expect(tickBox()).toBeEnabled());
    await userEvent.click(tickBox());

    serve({ error: "version_changed", terms_version: "beta-2" }, 409);
    serve({ ...OWED, document: { ...OWED.document, version: "beta-2", html: "<p>New wording.</p>" } });
    await userEvent.click(acceptButton());

    expect(await screen.findByText("New wording.")).toBeInTheDocument();
    expect(tickBox()).not.toBeChecked();
    expect(String(fetchMock.mock.calls[2][0])).toBe(`${env.MINTY_URL}/api/me/terms`);
  });

  it("a refusal is said in the panel, and Accept can be tried again", async () => {
    await owed();
    await waitFor(() => expect(tickBox()).toBeEnabled());
    await userEvent.click(tickBox());

    serve({ error: "Could not record your agreement. Please try again." }, 500);
    await userEvent.click(acceptButton());
    expect(await screen.findByText("Could not record your agreement. Please try again.")).toBeInTheDocument();
    expect(acceptButton()).toBeEnabled();

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await userEvent.click(acceptButton());
    expect(await screen.findByText(TERMS_COPY.unreachable)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: TERMS_COPY.title })).toBeInTheDocument();
  });

  it("Cancel logs out - someone who will not agree has nowhere else to go", async () => {
    await owed();
    await userEvent.click(screen.getByRole("button", { name: TERMS_COPY.cancel }));
    expect(navigate).toHaveBeenCalledWith(`${env.MINTY_URL}/logout`);
    expect(getAuth()).toBeNull();
  });

  it("an update names the version agreed before, and links to it", async () => {
    const { panel } = await owed({
      ...OWED,
      is_update: true,
      previous_version: "beta-0",
      links: { ...OWED.links, previous: "/legal/terms/beta-0" },
    });
    expect(panel.getByText(TERMS_COPY.updateLead)).toBeInTheDocument();
    expect(panel.getByText("beta-0")).toBeInTheDocument();
    expect(panel.getByRole("link", { name: "here" })).toHaveAttribute(
      "href",
      `${env.MINTY_URL}/legal/terms/beta-0`,
    );
  });

  it("nothing owed: the page as it is, and this token is not asked again", async () => {
    serve({ owed: false });
    render(page());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Select Company" })).toBeInTheDocument();

    render(page());
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["/landing", "/maintenance"])("asks nothing on %s", async (path) => {
    nav.pathname = path;
    render(page());
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks once the landing has stored a token and moved on without a reload", async () => {
    document.cookie = "minty_token=;path=/;max-age=0";
    nav.pathname = "/landing";
    const { rerender } = render(page());
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();

    setAuth(TOKEN, "", "");
    nav.pathname = "/entities";
    serve(OWED);
    rerender(page());
    expect(await screen.findByRole("dialog", { name: TERMS_COPY.title })).toBeInTheDocument();
  });

  it.each([
    ["the check cannot reach Flask", () => fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"))],
    ["Flask fails", () => serve({ error: "The Terms didn't load. Mind trying again?" }, 500)],
    ["the answer makes no sense", () => serve({ status: "ok" })],
  ])("fails open, loudly, when %s", async (_why, answer) => {
    const loud = vi.spyOn(console, "error").mockImplementation(() => {});
    answer();
    render(page());
    await waitFor(() => expect(loud).toHaveBeenCalled());
    expect(String(loud.mock.calls[0][0])).toContain("WITHOUT the Terms gate");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Select Company" })).toBeInTheDocument();
  });
});
