// My Profile as a person sees it (Figma 10-A / 10-B): the company it was opened from and the
// person's role there, the details card read and edited in place, the slot the subscription
// feature fills, Log Out, and the way back.

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { setAuth } from "@/lib/auth";
import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";
import { _setViewerLoaderForTests } from "@/lib/viewer";

import { SCOPED, SUPERMINTY, UNSCOPED } from "@/features/profile/__fixtures__/profile";
import type { Profile } from "@/features/profile/api/profile";
import { ProfileScreen } from "@/features/profile/routes/ProfileScreen";

const TOKEN = "h.eyJ1c2VyX2lkIjoidTEifQ.s";
const fetchMock = vi.fn<typeof fetch>();
const navigate = vi.fn<(url: string) => void>();

function serve(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

async function show(profile: Profile, { from = null as string | null, slot = null as React.ReactNode } = {}) {
  serve(profile);
  render(
    <ToastProvider>
      <ProfileScreen from={from} subscriptions={slot} />
    </ToastProvider>,
  );
  await screen.findByRole("heading", { level: 2, name: profile.user.name });
}

const details = () => within(screen.getByRole("region", { name: "Your details" }));

describe("ProfileScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    _resetHandoffForTests(navigate);
    setAuth(TOKEN, "e-company-a", "Company A Limited");
    window.history.replaceState({}, "", "/profile");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _resetHandoffForTests();
    _setViewerLoaderForTests(null);
  });

  it("10-A: the company it was opened from, its plan, the person and their role there", async () => {
    await show(SCOPED);

    expect(screen.getByRole("heading", { level: 1, name: "My Profile" })).toBeInTheDocument();
    const who = within(screen.getByRole("region", { name: "Who you are" }));
    expect(who.getByText("Company A Limited")).toBeInTheDocument();
    expect(who.getByText("Payment Request")).toBeInTheDocument();
    expect(who.getByText("JB")).toBeInTheDocument();
    expect(who.getByText("Shop Manager")).toBeInTheDocument();
    // asked about the cookie's company, of Flask
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${env.PETTY_CASH_URL}/api/me/profile?entity=e-company-a`);

    expect(details().getByText("John")).toBeInTheDocument();
    expect(details().getByText("Birmingha")).toBeInTheDocument();
    expect(details().getByText("john.doe@oliveandvinehk.com")).toBeInTheDocument();
    const change = details().getByRole("link", { name: /Change password/ });
    expect(change).toHaveAttribute("href", "https://identity.xero.com/account");
    expect(change).toHaveAttribute("target", "_blank");
  });

  it("10-B's head: a SuperMinty company, with the caped cat", async () => {
    await show(SUPERMINTY);
    const who = screen.getByRole("region", { name: "Who you are" });
    expect(within(who).getByText("SuperMinty")).toBeInTheDocument();
    expect(who.querySelector('img[src*="super-minty"]')).not.toBeNull();
  });

  it("opened from the entity list there is no company: no company line and no role", async () => {
    setAuth(TOKEN, "", "");
    await show(UNSCOPED);

    const who = within(screen.getByRole("region", { name: "Who you are" }));
    expect(who.queryByText("Company A Limited")).toBeNull();
    expect(who.queryByText("Shop Manager")).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${env.PETTY_CASH_URL}/api/me/profile`);
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/entities");
  });

  it("the way back: the payments app when opened from it", async () => {
    await show(SCOPED, { from: "bills" });
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", `${env.PAYMENT_REQUEST_WEB_URL}/`);
  });

  it("edits in place, sends only what changed, and the menu shows the new name at once", async () => {
    _setViewerLoaderForTests(() => Promise.resolve({ name: "John Birmingha", initials: "JB" }));
    await show(SCOPED);
    const user = userEvent.setup();

    await user.click(details().getByRole("button", { name: "Edit" }));
    const first = details().getByRole("textbox", { name: "FIRST NAME" });
    await user.clear(first);
    await user.type(first, "Jonathan");
    const saved: Profile = {
      ...SCOPED,
      user: { ...SCOPED.user, first_name: "Jonathan", name: "Jonathan Birmingha", initials: "JB" },
    };
    serve(saved);
    await user.click(details().getByRole("button", { name: "Save" }));

    expect(await details().findByText("Jonathan")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe(`${env.PETTY_CASH_URL}/api/me/profile?entity=e-company-a`);
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({ first_name: "Jonathan" });
    expect(screen.getByText("Your profile is saved.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Jonathan Birmingha" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open navigation menu" }));
    const menu = within(screen.getByRole("navigation", { name: "Main navigation" }));
    expect(menu.getByRole("link", { name: "Jonathan Birmingha, My Profile" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("a refusal stays in the card, in Flask's words, with what was typed", async () => {
    await show(SCOPED);
    const user = userEvent.setup();
    await user.click(details().getByRole("button", { name: "Edit" }));
    const email = details().getByRole("textbox", { name: "Email" });
    await user.clear(email);
    await user.type(email, "taken@x.com");
    serve({ error: "That email address is already in use." }, 422);
    await user.click(details().getByRole("button", { name: "Save" }));

    expect(await details().findByRole("alert")).toHaveTextContent("That email address is already in use.");
    expect(details().getByRole("textbox", { name: "Email" })).toHaveValue("taken@x.com");
  });

  it("an emptied email is refused before anything is sent; Cancel puts it all back", async () => {
    await show(SCOPED);
    const user = userEvent.setup();
    await user.click(details().getByRole("button", { name: "Edit" }));
    await user.clear(details().getByRole("textbox", { name: "Email" }));
    await user.click(details().getByRole("button", { name: "Save" }));

    expect(details().getByRole("alert")).toHaveTextContent("We'll need an email here.");
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the read
    await user.click(details().getByRole("button", { name: "Cancel" }));
    expect(details().getByText("john.doe@oliveandvinehk.com")).toBeInTheDocument();
  });

  it("the subscription feature's card sits in its slot, above Log Out", async () => {
    await show(SCOPED, { slot: <section aria-label="Subscriptions Overview">figures</section> });
    const slot = screen.getByRole("region", { name: "Subscriptions Overview" });
    const logOut = screen.getByRole("button", { name: "Log Out" });
    expect(slot.compareDocumentPosition(logOut) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Your details" }).compareDocumentPosition(slot) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("Log Out ends the session at Minty, as the menu's Logout does", async () => {
    await show(SCOPED);
    await userEvent.click(screen.getByRole("button", { name: "Log Out" }));
    expect(navigate).toHaveBeenCalledWith(`${env.PETTY_CASH_URL}/logout`);
    expect(document.cookie).not.toContain("minty_token=h.");
  });

  it("a profile that did not load says so, and tries again", async () => {
    serve({ error: "Your profile didn't come through. Mind trying again?" }, 500);
    render(
      <ToastProvider>
        <ProfileScreen />
      </ToastProvider>,
    );
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Your profile didn't come through. Mind trying again?");
    serve(SCOPED);
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 2, name: "John Birmingha" })).toBeInTheDocument());
  });
});
