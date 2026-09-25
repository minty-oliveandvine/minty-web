// The billing-account half of the API client, at the wire: what each call SENDS. The screens'
// tests mock Stripe's form, so nothing else exercises the confirm's account fields - and a field
// dropped here would save a card against no account with every screen looking right.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/apiClient";
import { setAuth } from "@/lib/auth";

import { ACCOUNTS, WALLET_TWO, invoicePage } from "@/features/subscription/__fixtures__/billing";
import {
  confirmCardSetup,
  fetchBillingAccounts,
  fetchPayerInvoices,
  removePaymentMethod,
} from "@/features/subscription/api/payerPortal";

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("the billing-account calls", () => {
  const fetchMock = vi.fn<typeof fetch>();
  const sent: { path: string; search: string; body: unknown }[] = [];

  beforeEach(() => {
    sent.length = 0;
    vi.stubGlobal("fetch", fetchMock);
    setAuth("h.eyJ1c2VyX2lkIjoidTEifQ.s", "", "");
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      sent.push({
        path: url.pathname,
        search: url.search,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      if (url.pathname === "/api/me/billing/accounts") return reply(200, ACCOUNTS);
      if (url.pathname === "/api/me/invoices") return reply(200, invoicePage());
      return reply(200, WALLET_TWO);
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("confirm names the account exactly as onboarding does - or nothing at all", async () => {
    await confirmCardSetup("seti_1");
    await confirmCardSetup("seti_2", false, { billingGroupId: "acc-1" });
    await confirmCardSetup("seti_3", false, { company: "Acme Ltd", email: "ap@acme.test" });
    expect(sent.map((s) => s.body)).toEqual([
      { setup_intent: "seti_1", make_default: false },
      { setup_intent: "seti_2", make_default: false, billing_group_id: "acc-1" },
      {
        setup_intent: "seti_3",
        make_default: false,
        billing_email: "ap@acme.test",
        billing_company: "Acme Ltd",
      },
    ]);
  });

  it("a removal names the account whose page asked, when one did", async () => {
    await removePaymentMethod("pm_1");
    await removePaymentMethod("pm_2", "acc-1");
    expect(sent.map((s) => s.body)).toEqual([
      { payment_method: "pm_1" },
      { payment_method: "pm_2", account: "acc-1" },
    ]);
  });

  it("the invoices are ONE account's when one is named", async () => {
    await fetchPayerInvoices({ accountId: "acc-1", perPage: 10 });
    expect(sent[0].search).toBe("?account=acc-1&per_page=10");
  });

  it("the accounts: the country list only when asked, and a wrong shape is an error", async () => {
    await fetchBillingAccounts();
    await fetchBillingAccounts({ countries: true });
    expect(sent.map((s) => s.search)).toEqual(["", "?countries=1"]);

    fetchMock.mockImplementation(async () => reply(200, { entities: [] }));
    await expect(fetchBillingAccounts()).rejects.toBeInstanceOf(ApiError);
  });
});
