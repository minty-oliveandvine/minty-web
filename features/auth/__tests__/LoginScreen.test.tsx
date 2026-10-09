// /login as a person meets it: log in by code (Flask refusing an address with no account), sign
// up (names and the Terms first - the box ticked only by agreeing at the document's end), an
// invitation (its address fixed, the Terms skipped when Flask says they were agreed), Xero as a
// navigation that keeps `next`, and Flask's messages from the way here.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "@/components/ui/Toast";
import { env } from "@/lib/env";

import { readArrival } from "@/features/auth/lib/arrival";
import { readConfirmContext } from "@/features/auth/lib/handover";
import { LOGIN_COPY, LoginScreen } from "@/features/auth/routes/LoginScreen";

const push = vi.fn();
// One router for every render, as Next's is.
const router = { push, replace: vi.fn(), back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Answers by path; records what was asked. */
function flask(routes: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (input) => {
    const url = new URL(String(input));
    const answer = routes[url.pathname];
    if (!answer) throw new Error(`unexpected call ${url.pathname}`);
    return answer();
  });
}

const calls = (path: string) =>
  fetchMock.mock.calls
    .filter(([input]) => new URL(String(input)).pathname === path)
    .map(([, init]) => JSON.parse(String((init as RequestInit).body ?? "null")));

function show(query = "") {
  render(
    <ToastProvider>
      <LoginScreen arrival={readArrival(new URLSearchParams(query))} />
    </ToastProvider>,
  );
}

const TERMS_DOC = { version: "beta-1", html: "<p>The Terms.</p>", effective_date: "18 September 2026", is_pinned: true };

describe("LoginScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState({}, "", "/login");
    window.sessionStorage.clear();
    push.mockReset();
    fetchMock.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("logs in by code: Flask is asked in log-in mode, the hand-over keeps next, then the code's page", async () => {
    flask({ "/auth/email/request-code": () => json({ status: "success" }) });
    show("next=%2Fprofile");

    expect(screen.getByRole("heading", { name: LOGIN_COPY.loginTitle })).toBeInTheDocument();
    const send = screen.getByRole("button", { name: LOGIN_COPY.sendLogin });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/^Email\s*\*?$/), "jane@example.com{Enter}");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login/confirm"));
    expect(calls("/auth/email/request-code")).toEqual([{ email: "jane@example.com", mode: "login" }]);
    expect(readConfirmContext()).toMatchObject({ email: "jane@example.com", login: true, next: "/profile" });
  });

  it("an address with no account is told so in Flask's words, with the way to sign up", async () => {
    flask({ "/auth/email/request-code": () => json({ status: "error", message: "Please sign up first" }, 404) });
    show();

    await userEvent.type(screen.getByLabelText(/^Email\s*\*?$/), "nobody@example.com");
    await userEvent.click(screen.getByRole("button", { name: LOGIN_COPY.sendLogin }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Please sign up first");
    expect(alert.querySelector("a")).toHaveAttribute("href", "/login?mode=signup");
    expect(push).not.toHaveBeenCalled();
  });

  it("signs up: names, then the Terms - the box opens the document and only agreeing ticks it", async () => {
    flask({
      "/legal/content/terms": () => json(TERMS_DOC),
      "/auth/email/request-code": () => json({ status: "success" }),
    });
    show("mode=signup");

    expect(screen.getByRole("heading", { name: LOGIN_COPY.signupTitle })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^First name\s*\*?$/), "Jane");
    await userEvent.type(screen.getByLabelText(/^Last name\s*\*?$/), "Doe");
    await userEvent.type(screen.getByLabelText(/^Email\s*\*?$/), "jane@example.com");
    const send = screen.getByRole("button", { name: LOGIN_COPY.sendSignup });
    expect(send).toBeDisabled(); // the Terms are owed

    const box = screen.getByRole("checkbox");
    await userEvent.click(box);
    // Clicking opened the document instead of ticking.
    expect(box).not.toBeChecked();
    const dialog = await screen.findByRole("dialog", { name: "Terms & Conditions" });
    expect(dialog).toHaveTextContent("The Terms.");
    // a short document has nothing to scroll: the panel's own box unlocks at once
    const agreeBox = await screen.findByRole("checkbox", { name: /I have read and agree/ });
    await waitFor(() => expect(agreeBox).toBeEnabled());
    await userEvent.click(agreeBox);
    await userEvent.click(screen.getByRole("button", { name: "Accept & Continue" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("checkbox")).toBeChecked();
    await userEvent.click(send);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login/confirm"));
    // sign-up asks without log-in mode: the address is new
    expect(calls("/auth/email/request-code")).toEqual([{ email: "jane@example.com" }]);
    expect(readConfirmContext()).toMatchObject({
      login: false,
      firstName: "Jane",
      lastName: "Doe",
      termsAccepted: true,
      termsVersion: "beta-1",
    });
  });

  it("an invitation fixes the address, and skips the Terms when Flask says they were agreed", async () => {
    flask({
      "/legal/invite-terms-status": () => json({ terms_required: false }),
      "/auth/email/request-code": () => json({ status: "success" }),
    });
    window.history.replaceState({}, "", "/login?invite=secret&email=ivy%40example.com");
    show("invite=secret&email=ivy%40example.com&fn=Ivy&ln=Lee");

    // the secret leaves the address bar at once
    expect(window.location.search).toBe("");
    expect(screen.getByRole("status")).toHaveTextContent("This invitation was sent to ivy@example.com");
    expect(screen.getByLabelText(/^Email\s*\*?$/)).toHaveAttribute("readonly");
    await waitFor(() => expect(screen.queryByRole("checkbox")).toBeNull());
    expect(calls("/legal/invite-terms-status")).toEqual([{ invite: "secret" }]);

    await userEvent.click(screen.getByRole("button", { name: LOGIN_COPY.sendLogin }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(calls("/auth/email/request-code")).toEqual([{ email: "ivy@example.com", invite: "secret" }]);
    expect(readConfirmContext()).toMatchObject({ invite: "secret", firstName: "Ivy", lastName: "Lee", login: false });
  });

  it("keeps the Terms box when Flask cannot say whether an invitee agreed - and says so in the console", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    flask({ "/legal/invite-terms-status": () => json({ error: "boom" }, 500) });
    show("invite=secret&email=ivy%40example.com");

    await waitFor(() => expect(error).toHaveBeenCalled());
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
    error.mockRestore();
  });

  it("Xero is a navigation to Flask that keeps the invitation and next", () => {
    flask({ "/legal/invite-terms-status": () => json({ terms_required: true }) });
    show("invite=secret&email=ivy%40example.com&next=%2Fentity");

    expect(screen.getByRole("link", { name: /Log in with Xero/ })).toHaveAttribute(
      "href",
      `${env.PETTY_CASH_URL}/xero_auth?invite=secret&next=%2Fentity`,
    );
  });

  it("shows what Flask flashed on the way here", async () => {
    flask({
      "/auth/notices": () => json({ notices: [{ category: "info", message: "Please log in to access this page." }] }),
    });
    show("flash=signed.value");

    expect(await screen.findByText("Please log in to access this page.")).toBeInTheDocument();
  });

  it("refuses a next that leaves the site", () => {
    expect(readArrival(new URLSearchParams("next=%2F%2Fevil.example")).next).toBe("");
    expect(readArrival(new URLSearchParams("next=https%3A%2F%2Fevil.example")).next).toBe("");
    expect(readArrival(new URLSearchParams("next=%2Fprofile")).next).toBe("/profile");
  });
});
