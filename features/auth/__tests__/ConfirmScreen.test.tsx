// /login/confirm: the code from the hand-over's address; Flask's answer decides (wrong code, the
// lockout), and a verified code leaves for Flask's hand-off - never for another site.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "@/lib/env";
import { _resetHandoffForTests } from "@/lib/handoff";

import { readConfirmContext, saveConfirmContext, type ConfirmContext } from "@/features/auth/lib/handover";
import { CONFIRM_COPY, ConfirmScreen } from "@/features/auth/routes/ConfirmScreen";

const replace = vi.fn();
// One router for every render, as Next's is - a new object each time would re-run every effect
// that names it.
const router = { push: vi.fn(), replace, back: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const fetchMock = vi.fn<typeof fetch>();
const navigate = vi.fn<(url: string) => void>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const CONTEXT: ConfirmContext = {
  email: "jane@example.com",
  login: true,
  invite: "",
  firstName: "",
  lastName: "",
  termsAccepted: false,
  termsVersion: "",
  next: "/profile",
};

async function typeCode(code: string) {
  for (let i = 0; i < code.length; i += 1) {
    await userEvent.type(screen.getByLabelText(`Digit ${i + 1}`), code[i]);
  }
}

describe("ConfirmScreen", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    _resetHandoffForTests(navigate);
    window.sessionStorage.clear();
    window.history.replaceState({}, "", "/login/confirm");
    replace.mockReset();
    fetchMock.mockReset();
    navigate.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _resetHandoffForTests();
  });

  it("verifies the code with everything handed over, then leaves for Flask's hand-off", async () => {
    saveConfirmContext(CONTEXT);
    fetchMock.mockResolvedValue(json({ status: "success", redirect_url: `${env.PETTY_CASH_URL}/auth/email/handoff?h=x` }));
    render(<ConfirmScreen />);

    expect(await screen.findByText(/j\*\*\*@example\.com/)).toBeInTheDocument();
    await typeCode("123456");
    await userEvent.click(screen.getByRole("button", { name: CONFIRM_COPY.verify }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(`${env.PETTY_CASH_URL}/auth/email/handoff?h=x`));
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ email: "jane@example.com", code: "123456", next: "/profile" });
    expect(readConfirmContext()).toBeNull();
  });

  it("refuses a hand-off that is not Flask's, and says so", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    saveConfirmContext(CONTEXT);
    fetchMock.mockResolvedValue(json({ status: "success", redirect_url: "https://evil.example/x" }));
    render(<ConfirmScreen />);

    await typeCode("123456");
    await userEvent.click(await screen.findByRole("button", { name: CONFIRM_COPY.verify }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith(new URL(env.PETTY_CASH_URL).toString()));
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("a wrong code is told in Flask's words and counts down the tries; the lockout locks the form", async () => {
    saveConfirmContext(CONTEXT);
    fetchMock
      .mockResolvedValueOnce(json({ status: "error", message: "That code doesn't match." }, 400))
      .mockResolvedValueOnce(json({ status: "error", message: "Too many attempts." }, 429));
    render(<ConfirmScreen />);

    await typeCode("111111");
    await userEvent.click(await screen.findByRole("button", { name: CONFIRM_COPY.verify }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That code doesn't match.");
    expect(screen.getByText("4 attempts remaining")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: CONFIRM_COPY.verify }));
    expect(await screen.findByText("Too many attempts.")).toBeInTheDocument();
    expect(screen.getByLabelText("Digit 1")).toBeDisabled();
    expect(screen.getByRole("button", { name: CONFIRM_COPY.verify })).toBeDisabled();
  });

  it("a pasted code fills every box", async () => {
    saveConfirmContext(CONTEXT);
    render(<ConfirmScreen />);
    const first = await screen.findByLabelText("Digit 1");
    first.focus();
    await userEvent.paste("654321");
    expect(screen.getByLabelText("Digit 6")).toHaveValue("1");
    expect(screen.getByRole("button", { name: CONFIRM_COPY.verify })).toBeEnabled();
  });

  it("?email= alone serves a plain log-in; with nothing, back to /login", async () => {
    window.history.replaceState({}, "", "/login/confirm?email=solo%40example.com");
    const { unmount } = render(<ConfirmScreen />);
    expect(await screen.findByText(/s\*\*\*@example\.com/)).toBeInTheDocument();
    unmount();

    window.history.replaceState({}, "", "/login/confirm");
    render(<ConfirmScreen />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  it("an invitation offers no other address", async () => {
    saveConfirmContext({ ...CONTEXT, invite: "secret" });
    render(<ConfirmScreen />);
    await screen.findByRole("button", { name: CONFIRM_COPY.verify });
    expect(screen.queryByRole("link", { name: "Use a different email" })).toBeNull();
  });
});
