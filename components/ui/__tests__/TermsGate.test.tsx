// The Terms & Conditions gate over every page: owed, the page is inert behind a panel that
// cannot be dismissed - Accept records the version on screen and the page comes back, Cancel logs
// out; the tick box waits for the end of the document; a 409 reads the Terms again. Asked once
// per token, never on the open pages, and it FAILS OPEN, loudly.
//
// TWO READS since the documents moved here (2026-10-12): Flask names the owed version and its
// fingerprint, then this app reads that version's text from its own route handler. The panel is
// only drawn when the two agree - the mismatch cases at the foot of this file are the point.

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
import type { LegalDocumentBody } from "@/lib/legal/document";
import { _resetTermsForTests, type OwedTerms } from "@/lib/terms";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const fetchMock = vi.fn<typeof fetch>();
const navigate = vi.fn<(url: string) => void>();

const HASH = "c90a335ed1b5b8cf5d8f5dc6702117418878594053ef3c0720b7816182c7c438";

/** What Flask answers: the version owed and the fingerprint it will record. No wording. */
const OWED: OwedTerms = {
  owed: true,
  document: {
    version: "beta-1",
    effective_date: "18 September 2026",
    sha256: HASH,
    show_draft_notice: true,
  },
  is_update: false,
  previous_version: null,
};

/** What this app holds: the wording, under that same fingerprint. */
const DOCUMENT: LegalDocumentBody = {
  kind: "terms",
  version: "beta-1",
  html: "<h2>1. Who we are</h2><p>Olive &amp; Vine runs Minty.</p>",
  sha256: HASH,
  effective_date: "18 September 2026",
  is_pinned: false,
  is_current: true,
  show_draft_notice: true,
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

async function owed(terms: OwedTerms = OWED, document: LegalDocumentBody = DOCUMENT) {
  serve(terms);
  serve(document);
  const view = render(page());
  const dialog = await screen.findByRole("dialog", { name: TERMS_COPY.title });
  return { ...view, panel: within(dialog), dialog };
}

const tickBox = () => screen.getByRole("checkbox");
const acceptButton = () => screen.getByRole("button", { name: TERMS_COPY.accept });
const calledUrls = () => fetchMock.mock.calls.map(([url]) => String(url));

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

  it("owed: the panel over the page, and the page behind out of reach", async () => {
    const { panel, container } = await owed();

    // Flask for the version (bearer), then this app for that version's text (same origin).
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${env.PETTY_CASH_URL}/api/me/terms`);
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${TOKEN}`);
    const [docUrl, docInit] = fetchMock.mock.calls[1];
    expect(String(docUrl)).toBe("/api/legal/terms/beta-1");
    expect(new Headers(docInit?.headers).get("Authorization")).toBeNull();

    expect(panel.getByText(TERMS_COPY.lead)).toBeInTheDocument();
    expect(panel.getByText(/This wording is not final/)).toBeInTheDocument();
    expect(panel.getByText("Last updated: 18 September 2026")).toBeInTheDocument();
    const doc = panel.getByRole("region", { name: "The Terms & Conditions" });
    expect(within(doc).getByRole("heading", { name: "1. Who we are" })).toBeInTheDocument();
    expect(within(doc).getByText("Olive & Vine runs Minty.")).toBeInTheDocument();

    // This app's own pages, never Flask's - the address stays on the hub.
    for (const [name, path] of [
      ["Terms & Conditions", "/terms"],
      ["Privacy Policy", "/privacy"],
    ]) {
      const link = panel.getByRole("link", { name });
      expect(link).toHaveAttribute("href", path);
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

  it("Accept & Continue: once ticked, it records the version AND the fingerprint on screen", async () => {
    await owed();
    await waitFor(() => expect(tickBox()).toBeEnabled()); // jsdom's document does not scroll
    await userEvent.click(tickBox());
    expect(acceptButton()).toBeEnabled();

    serve({ ok: true, terms_version: "beta-1" });
    await userEvent.click(acceptButton());

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const [url, init] = fetchMock.mock.calls[2];
    expect(String(url)).toBe(`${env.PETTY_CASH_URL}/api/me/terms/accept`);
    expect(init?.method).toBe("POST");
    // The hash of what was shown rides along: Flask compares it to its manifest and refuses a
    // mismatch. It is never the hash Flask stores.
    expect(JSON.parse(String(init?.body))).toEqual({
      accepted: true,
      terms_version: "beta-1",
      document_hash: HASH,
    });
    expect(screen.getByRole("heading", { name: "Select Company" })).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled(); // they stay on the page they are on

    // and this token is not asked again on the next page
    nav.pathname = "/subscription";
    render(page());
    expect(fetchMock).toHaveBeenCalledTimes(3);
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

    const beta2 = "b".repeat(64);
    serve({ error: "version_changed", terms_version: "beta-2" }, 409);
    serve({ ...OWED, document: { ...OWED.document, version: "beta-2", sha256: beta2 } });
    serve({ ...DOCUMENT, version: "beta-2", sha256: beta2, html: "<p>New wording.</p>" });
    await userEvent.click(acceptButton());

    expect(await screen.findByText("New wording.")).toBeInTheDocument();
    expect(tickBox()).not.toBeChecked();
    expect(calledUrls().slice(3)).toEqual([
      `${env.PETTY_CASH_URL}/api/me/terms`,
      "/api/legal/terms/beta-2",
    ]);
  });

  it("a refusal is said in the panel, and Accept can be tried again", async () => {
    await owed();
    await waitFor(() => expect(tickBox()).toBeEnabled());
    await userEvent.click(tickBox());

    serve({ error: "Could not record your agreement. Please try again." }, 500);
    await userEvent.click(acceptButton());
    expect(
      await screen.findByText("Could not record your agreement. Please try again."),
    ).toBeInTheDocument();
    expect(acceptButton()).toBeEnabled();

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await userEvent.click(acceptButton());
    expect(await screen.findByText(TERMS_COPY.unreachable)).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: TERMS_COPY.title })).toBeInTheDocument();
  });

  it("Cancel logs out - someone who will not agree has nowhere else to go", async () => {
    await owed();
    await userEvent.click(screen.getByRole("button", { name: TERMS_COPY.cancel }));
    expect(navigate).toHaveBeenCalledWith(`${env.PETTY_CASH_URL}/logout`);
    expect(getAuth()).toBeNull();
  });

  it("an update names the version agreed before, and links to this app's copy of it", async () => {
    const { panel } = await owed({ ...OWED, is_update: true, previous_version: "beta-0" });
    expect(panel.getByText(TERMS_COPY.updateLead)).toBeInTheDocument();
    expect(panel.getByText("beta-0")).toBeInTheDocument();
    expect(panel.getByRole("link", { name: "here" })).toHaveAttribute("href", "/terms/beta-0");
  });

  it("nothing owed: the page as it is, one call, and this token is not asked again", async () => {
    serve({ owed: false });
    render(page());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Select Company" })).toBeInTheDocument();

    render(page());
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1); // no document fetched when none is owed
  });

  it.each(["/landing", "/maintenance", "/terms", "/privacy", "/terms/beta-1"])(
    "asks nothing on %s",
    async (path) => {
      nav.pathname = path;
      render(page());
      await new Promise((r) => setTimeout(r, 20));
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("asks once the landing has stored a token and moved on without a reload", async () => {
    document.cookie = "minty_token=;path=/;max-age=0";
    nav.pathname = "/landing";
    const { rerender } = render(page());
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();

    setAuth(TOKEN, "", "");
    nav.pathname = "/entities";
    serve(OWED);
    serve(DOCUMENT);
    rerender(page());
    expect(await screen.findByRole("dialog", { name: TERMS_COPY.title })).toBeInTheDocument();
  });

  it.each([
    [
      "the check cannot reach Flask",
      () => fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch")),
    ],
    ["Flask fails", () => serve({ error: "The Terms didn't load. Mind trying again?" }, 500)],
    ["the answer makes no sense", () => serve({ status: "ok" })],
    [
      "Flask names a version this app does not hold",
      () => {
        serve({ ...OWED, document: { ...OWED.document, version: "beta-99" } });
        serve({ error: "No such document." }, 404);
      },
    ],
    [
      "the fingerprints disagree - the two are deployed out of step",
      () => {
        serve(OWED);
        serve({ ...DOCUMENT, sha256: "f".repeat(64) });
      },
    ],
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
