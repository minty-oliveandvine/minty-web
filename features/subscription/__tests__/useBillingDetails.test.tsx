// 08-C over a stubbed fetch, with Stripe.js mocked at its package boundary: the account named and
// nothing else, what the form types and what Stripe's address form opens on, what Save sends
// (only what changed; the address as a whole, and only once Stripe has checked it), what stops
// it, the API's refusal kept on the page, and the two ways the address cannot be edited - no card
// to keep it on, and no Stripe to draw the form.

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setAuth } from "@/lib/auth";

import { ACCOUNTS } from "@/features/subscription/__fixtures__/billing";
import type { BillingAccounts } from "@/features/subscription/api/payerPortal";
import { useBillingDetails } from "@/features/subscription/hooks/useBillingDetails";
import {
  ACCOUNT_NOT_FOUND,
  COMPANY_REQUIRED,
  TOO_LONG,
  addressDefaults,
  type CardAddress,
} from "@/features/subscription/lib/billingAccounts";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn() }),
}));

// `stripeFor` caches per key, so a case that needs Stripe.js to fail uses its own key.
const BLOCKED = "pk_test_blocked";
vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(async (key: string) => (key === BLOCKED ? null : { key })),
}));

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const WITH_KEY: BillingAccounts = { ...ACCOUNTS, publishable_key: "pk_test_1" };
const [COMPANY_A] = ACCOUNTS.accounts;
const CARD = addressDefaults(COMPANY_A)!;
/** What Stripe's form holds after the payer moved the company to Central, postcode and all. */
const MOVED: CardAddress = {
  name: "Rebecca Park",
  address: { ...CARD.address, line1: "1 Queen's Road", city: "Central", postal_code: "999077" },
};

describe("useBillingDetails", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const posts: { path: string; body: unknown }[] = [];
  const reads: string[] = [];

  function serve(
    answer: { status: number; body: unknown } = { status: 200, body: WITH_KEY },
    accounts: BillingAccounts = WITH_KEY,
  ) {
    posts.length = 0;
    reads.length = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (init?.method === "POST") {
        posts.push({ path: url.pathname, body: init.body ? JSON.parse(String(init.body)) : null });
        return reply(answer.status, answer.body);
      }
      reads.push(`${url.pathname}${url.search}`);
      return reply(200, accounts);
    });
  }

  async function opened(accountId = "acc-company-a") {
    const hook = renderHook(() => useBillingDetails({ accountId }));
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    return hook.result;
  }

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    push.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens on the account named - its fields, Stripe's defaults, countries, key - and on nothing else", async () => {
    serve();
    const result = await opened("acc-vine");
    expect(reads).toEqual(["/api/me/billing/accounts?countries=1"]);
    expect(result.current.fields).toEqual({
      company: "Vine Consulting Limited",
      email: "accounts@vineconsulting.test",
    });
    expect(result.current.addressDefaults?.address.state).toBe("Hong Kong Island");
    expect(result.current.allowedCountries).toEqual(["HK", "PH", "SG"]);
    expect(result.current.publishableKey).toBe("pk_test_1");
    expect(result.current.addressUnavailable).toBe(false);
    expect(result.current.dirty).toBe(false);

    const { result: stale } = renderHook(() => useBillingDetails({ accountId: "acc-gone" }));
    await waitFor(() => expect(stale.current.status).toBe("error"));
    expect(stale.current.error).toBe(ACCOUNT_NOT_FOUND);

    const { result: none } = renderHook(() => useBillingDetails({ accountId: null }));
    expect(none.current.status).toBe("error");
  });

  it("sends only what changed - the address whole, as Stripe checked it - then lands on 08-B", async () => {
    serve();
    const result = await opened();
    const readAddress = vi.fn(async () => MOVED);
    act(() => result.current.setField("company", "Company A Holdings Limited"));
    act(() => result.current.setAddress(MOVED));
    expect(result.current.dirty).toBe(true);

    await act(async () => result.current.save(readAddress));

    expect(readAddress).toHaveBeenCalledTimes(1);
    expect(posts).toEqual([
      {
        path: "/api/me/billing/accounts/update",
        body: {
          account: "acc-company-a",
          billing_company: "Company A Holdings Limited",
          address: {
            line1: "1 Queen's Road",
            line2: "2 ABC Street",
            city: "Central",
            state: "",
            postal_code: "999077",
            country: "HK",
          },
        },
      },
    ]);
    expect(push).toHaveBeenCalledWith("/subscription/billing?account=acc-company-a");
  });

  it("an address Stripe will not accept is never sent - nor anything with it", async () => {
    serve();
    const result = await opened();
    act(() => result.current.setField("company", "Company A Holdings Limited"));
    act(() => result.current.setAddress(MOVED));

    await act(async () => result.current.save(async () => null));

    expect(posts).toEqual([]);
    expect(result.current.busy).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("the name alone saves without asking Stripe; a new cardholder goes as the cardholder", async () => {
    serve();
    const result = await opened();
    const readAddress = vi.fn(async () => CARD);
    act(() => result.current.setField("email", "ap@companyalimited.com"));
    await act(async () => result.current.save(readAddress));
    expect(readAddress).not.toHaveBeenCalled();
    expect(posts.map((p) => p.body)).toEqual([
      { account: "acc-company-a", billing_email: "ap@companyalimited.com" },
    ]);

    serve();
    const renamed = await opened();
    const holder = { ...CARD, name: "R. Park" };
    act(() => renamed.current.setAddress(holder));
    await act(async () => renamed.current.save(async () => holder));
    expect(posts.map((p) => p.body)).toEqual([{ account: "acc-company-a", cardholder: "R. Park" }]);
  });

  it("a blanked name, or one past 255 characters, stops Save before anything is sent", async () => {
    serve();
    const result = await opened();
    act(() => result.current.setField("company", " "));
    await act(async () => result.current.save());
    expect(result.current.errors.company).toBe(COMPANY_REQUIRED);

    act(() => result.current.setField("company", "x".repeat(256)));
    await act(async () => result.current.save());
    expect(result.current.errors.company).toBe(TOO_LONG);
    expect(posts).toEqual([]);
  });

  it("the API's refusal stays on the page in its own words", async () => {
    serve({
      status: 409,
      body: { error: "This billing account has no card to keep its address on." },
    });
    const result = await opened();
    act(() => result.current.setAddress(MOVED));
    await act(async () => result.current.save(async () => MOVED));
    expect(result.current.saveError).toBe(
      "This billing account has no card to keep its address on.",
    );
    expect(result.current.busy).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("no card: nowhere to keep an address; Go Back is its page", async () => {
    serve(undefined, {
      ...WITH_KEY,
      accounts: WITH_KEY.accounts.map((a) =>
        a.id === "acc-vine" ? { ...a, card: null, cards: [], address: null } : a,
      ),
    });
    const result = await opened("acc-vine");
    expect(result.current.addressLocked).toBe(true);
    expect(result.current.addressDefaults).toBeNull();
    act(() => result.current.back());
    expect(push).toHaveBeenCalledWith("/subscription/billing?account=acc-vine");
  });

  it("no Stripe to draw the form - no key here, or Stripe.js blocked - and the name still saves", async () => {
    serve(undefined, ACCOUNTS); // the API had no key to give
    const keyless = await opened();
    expect(keyless.current.addressUnavailable).toBe(true);

    serve(undefined, { ...ACCOUNTS, publishable_key: BLOCKED });
    const blocked = await opened();
    await waitFor(() => expect(blocked.current.addressUnavailable).toBe(true));
    act(() => blocked.current.setField("company", "Company A Holdings Limited"));
    await act(async () => blocked.current.save());
    expect(posts.map((p) => p.body)).toEqual([
      { account: "acc-company-a", billing_company: "Company A Holdings Limited" },
    ]);
  });
});
