// Stripe's own card form, with Stripe mocked at its package boundary (jsdom cannot mount its
// iframes): the ORDER the submit must keep - our checks, then Stripe's, then confirmSetup, then
// Minty, then the caller - what the confirm carries, the intent remembered once Stripe has the
// card (a second Save must not confirm it again), the busy signal the sheet holds itself open
// on, and the two looks: the billing page's, and onboarding's 01-D in the billing-account sheet.

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";

import { OPENED_ACCOUNT } from "@/features/subscription/__fixtures__/billing";
import {
  CARD_SAVE_FAILED,
  CardCaptureForm,
} from "@/features/subscription/components/CardCaptureForm";

const fake = vi.hoisted(() => ({
  stripe: { confirmSetup: vi.fn() },
  elements: { submit: vi.fn() },
  /** What each <Elements> was mounted with - the sheet's carries onboarding's appearance. */
  options: [] as unknown[],
}));

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(async () => fake.stripe),
}));

vi.mock("@stripe/react-stripe-js", async () => {
  const { useEffect, useRef } = await import("react");
  return {
    Elements: ({ options, children }: { options: unknown; children: ReactNode }) => {
      fake.options.push(options);
      return <>{children}</>;
    },
    useStripe: () => fake.stripe,
    useElements: () => fake.elements,
    // Ready as soon as it mounts, as Stripe's is once its iframe loads.
    PaymentElement: ({ onReady }: { onReady?: () => void }) => {
      const fired = useRef(false);
      useEffect(() => {
        if (fired.current) return;
        fired.current = true;
        onReady?.();
      }, [onReady]);
      return <div data-testid="payment-element" />;
    },
    // A complete billing address, once - what the cardholder typed into Stripe's fields.
    AddressElement: ({ onChange }: { onChange?: (event: unknown) => void }) => {
      const fired = useRef(false);
      useEffect(() => {
        if (fired.current) return;
        fired.current = true;
        onChange?.({
          complete: true,
          value: { name: "Rebecca Park", address: { line1: "1 ABC Street", country: "HK" } },
        });
      }, [onChange]);
      return <div data-testid="address-element" />;
    },
  };
});

const HANDLE = {
  client_secret: "seti_1_secret",
  publishable_key: "pk_test_1",
  setup_intent: "seti_1",
};

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("CardCaptureForm", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const posts: { path: string; body: unknown }[] = [];
  const onSaved = vi.fn<(confirmed: unknown, paymentMethodId: string | null) => void>();
  const onBusy = vi.fn<(busy: boolean) => void>();

  /** The confirm answers each item in turn (the last one repeats). */
  function serve(...answers: { status: number; body: unknown }[]) {
    posts.length = 0;
    let n = 0;
    fetchMock.mockImplementation(async (input, init) => {
      posts.push({
        path: new URL(String(input)).pathname,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      const answer = answers[Math.min(n++, answers.length - 1)];
      return reply(answer.status, answer.body);
    });
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    fake.options.length = 0;
    fake.elements.submit.mockResolvedValue({});
    fake.stripe.confirmSetup.mockResolvedValue({
      setupIntent: { id: "seti_1", payment_method: "pm_visa4242" },
    });
    serve({ status: 200, body: OPENED_ACCOUNT });
  });
  afterEach(() => vi.unstubAllGlobals());

  function sheet(extra: Partial<Parameters<typeof CardCaptureForm>[0]> = {}) {
    return render(
      <CardCaptureForm
        handle={HANDLE}
        firstCard={false}
        look="sheet"
        onSaved={onSaved}
        onCancel={vi.fn()}
        onBusy={onBusy}
        account={{ company: "Acme Ltd", email: "ap@acme.test" }}
        {...extra}
      />,
    );
  }

  async function save(user: ReturnType<typeof userEvent.setup>, name = "Save billing account") {
    const button = await screen.findByRole("button", { name });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
  }

  it("a refused gate reaches neither Stripe nor Minty - the card is never attached", async () => {
    const user = userEvent.setup();
    const beforeConfirm = vi.fn(() => false);
    sheet({ beforeConfirm });
    await save(user);

    expect(beforeConfirm).toHaveBeenCalledTimes(1);
    expect(fake.elements.submit).not.toHaveBeenCalled();
    expect(fake.stripe.confirmSetup).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onBusy).not.toHaveBeenCalled();
  });

  it("our checks, Stripe's, confirmSetup, then Minty with the account's identity, then the caller", async () => {
    const user = userEvent.setup();
    const beforeConfirm = vi.fn(() => true);
    sheet({ beforeConfirm });
    await save(user);

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(OPENED_ACCOUNT, "pm_visa4242"));
    const order = [
      beforeConfirm.mock.invocationCallOrder[0],
      fake.elements.submit.mock.invocationCallOrder[0],
      fake.stripe.confirmSetup.mock.invocationCallOrder[0],
      fetchMock.mock.invocationCallOrder[0],
      onSaved.mock.invocationCallOrder[0],
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));

    const [setup] = fake.stripe.confirmSetup.mock.calls[0];
    expect(setup).toMatchObject({
      elements: fake.elements,
      redirect: "if_required",
      confirmParams: {
        payment_method_data: {
          billing_details: { name: "Rebecca Park", address: { line1: "1 ABC Street" } },
        },
      },
    });
    // The payer-wide default stays where it is: opening an account is not choosing that.
    expect(posts).toEqual([
      {
        path: "/api/me/billing/payment-methods/confirm",
        body: {
          setup_intent: "seti_1",
          make_default: false,
          billing_email: "ap@acme.test",
          billing_company: "Acme Ltd",
        },
      },
    ]);
    expect(onBusy).toHaveBeenCalledWith(true);
  });

  it("Stripe's refusal is shown as written, and nothing reaches Minty", async () => {
    const user = userEvent.setup();
    fake.stripe.confirmSetup.mockResolvedValue({ error: { message: "Your card was declined." } });
    sheet();
    await save(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Your card was declined.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onBusy.mock.calls).toEqual([[true], [false]]);
  });

  it("once Stripe holds the card, a second Save does not confirm the intent again", async () => {
    const user = userEvent.setup();
    serve(
      { status: 500, body: { error: "Stripe went away for a moment." } },
      { status: 200, body: OPENED_ACCOUNT },
    );
    sheet();
    await save(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("Stripe went away for a moment.");
    expect(onBusy.mock.calls).toEqual([[true], [false]]);
    expect(onSaved).not.toHaveBeenCalled();

    await save(user);
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(fake.elements.submit).toHaveBeenCalledTimes(1);
    expect(fake.stripe.confirmSetup).toHaveBeenCalledTimes(1);
    expect(posts).toHaveLength(2); // Minty asked twice about the one intent
  });

  it("a failure in what follows the confirm is shown, not swallowed (onSaved is awaited)", async () => {
    const user = userEvent.setup();
    onSaved.mockRejectedValueOnce(new Error("the move blew up"));
    sheet();
    await save(user);

    expect(await screen.findByRole("alert")).toHaveTextContent(CARD_SAVE_FAILED);
    expect(onBusy.mock.calls).toEqual([[true], [false]]);
  });

  it("the sheet look is onboarding's 01-D - its fields locked while saving, its theme on Stripe's", async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => {};
    fake.stripe.confirmSetup.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const fields = (busy: boolean) => <input aria-label="Email" disabled={busy} />;
    sheet({ fields });

    expect(screen.getByText("Payment method")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByText(/you authorise Minty to charge/)).toBeInTheDocument();
    expect(fake.options.at(-1)).toMatchObject({
      clientSecret: "seti_1_secret",
      appearance: { variables: { colorText: "#16202E", borderRadius: "8px" } },
    });

    await save(user);
    // In flight: what was checked is what is sent - the fields cannot change under it.
    expect(screen.getByLabelText("Email")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    release({ setupIntent: { id: "seti_1", payment_method: "pm_visa4242" } });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("the page look stays the billing page's: Save, the first-card note, Stripe's own theme", async () => {
    render(
      <CardCaptureForm handle={HANDLE} firstCard onSaved={onSaved} onCancel={vi.fn()} />,
    );
    expect(await screen.findByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByText(/first payment method on your billing account/)).toBeInTheDocument();
    expect(screen.queryByText("Payment method")).toBeNull();
    expect(fake.options.at(-1)).toEqual({ clientSecret: "seti_1_secret" });
  });

  it("no publishable key means no form - the Stripe note, not an empty box", () => {
    sheet({ handle: { ...HANDLE, publishable_key: "" } });
    expect(screen.getByRole("status")).toHaveTextContent("never stored by Minty");
    expect(screen.queryByTestId("payment-element")).toBeNull();
  });
});
