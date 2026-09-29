// Section 08's rules: how a card is named and dated, the default pinned first, what its menu
// offers, the expired line, who the bill goes to and when it turns amber, the invoice table's
// header and which rows have a PDF, and the overview's two figures and update lines.

import { describe, expect, it } from "vitest";

import { TODAY } from "@/features/subscription/__fixtures__/modulePage";
import {
  FAILED_INVOICES,
  INVOICES,
  WALLET_EXPIRED,
  WALLET_MANY,
  WALLET_NONE,
  WALLET_TWO,
  card,
} from "@/features/subscription/__fixtures__/billing";
import { ENTITIES, subscriptionsPage } from "@/features/subscription/__fixtures__/subscriptions";
import type { InvoiceRow } from "@/features/subscription/api/payerPortal";
import {
  CARDS_SHOWN,
  TRIAL_ENDING_DAYS,
  amountHeader,
  cardExpiry,
  cardMenu,
  cardNeedsUpdate,
  cardRows,
  cardTitle,
  entityCount,
  expiredNotice,
  failedLabel,
  UPDATES_SHOWN,
  invoiceLines,
  moreUpdatesLabel,
  nextBilling,
  overview,
  showMoreLabel,
  visibleCards,
  visibleUpdates,
} from "@/features/subscription/lib/billing";

describe("a saved card, as the page names it", () => {
  it("is the brand and the last four, and a month - never a day", () => {
    const visa = WALLET_TWO.methods[0];
    expect(cardTitle(visa)).toBe("Visa ending in 4121");
    expect(cardExpiry(visa)).toBe("Sep 2026");
    // A wallet (Apple Pay, a bank) has no digits of its own: the API's label stands.
    const wallet = card("pm_wallet", "Apple Pay", "", 0, 0, { last4: null, label: "Apple Pay" });
    expect(cardTitle({ ...wallet, last4: null })).toBe("Apple Pay");
    expect(cardExpiry({ ...wallet, exp_month: null, exp_year: null, expiry: null })).toBeNull();
  });

  it("pins the default first whatever order the API sent, and chips each row", () => {
    const rows = cardRows({
      ...WALLET_MANY,
      methods: [...WALLET_MANY.methods].reverse(),
    });
    expect(rows[0].card.id).toBe("pm_visa4121");
    expect(rows[0].chip).toBe("default");
    expect(rows.find((r) => r.card.id === "pm_visa0341")?.chip).toBe("expired");
    expect(rows.find((r) => r.card.id === "pm_master4651")?.chip).toBe("saved");
    expect(cardRows(null)).toEqual([]);
  });

  it("offers Set as default only where it means something", () => {
    const rows = cardRows(WALLET_TWO);
    expect(cardMenu(rows[0])).toEqual(["edit", "delete"]);
    expect(cardMenu(rows[1])).toEqual(["set_default", "edit", "delete"]);
  });

  // 08-K: the charged card is the one to fix when the account's payment failed - red like an
  // expired card; a spare card on the same account is not the problem.
  it("draws Update card red on the card to fix: expired, or charged while the payment fails", () => {
    const [charged, spare] = cardRows(WALLET_TWO);
    expect(cardNeedsUpdate(charged, true)).toBe(true);
    expect(cardNeedsUpdate(spare, true)).toBe(false);
    expect(cardNeedsUpdate(charged, false)).toBe(false);
    const expired = cardRows(WALLET_EXPIRED).find((r) => r.chip === "expired")!;
    expect(cardNeedsUpdate(expired, false)).toBe(true);
  });

  it("shows the default and one other until Show more says how many are left", () => {
    const rows = cardRows(WALLET_MANY);
    expect(visibleCards(rows, false)).toHaveLength(CARDS_SHOWN);
    expect(showMoreLabel(rows)).toBe("Show more (6)");
    expect(visibleCards(rows, true)).toHaveLength(8);
    expect(showMoreLabel(cardRows(WALLET_TWO))).toBeNull();
  });

  it("says so when the card being charged has expired - and only then", () => {
    expect(expiredNotice(cardRows(WALLET_EXPIRED))).toBe(
      "Your card expired on Aug 2026. Update your payment method here.",
    );
    // An expired card that is NOT the default stops nothing, so the banner stays away.
    expect(expiredNotice(cardRows(WALLET_MANY))).toBeNull();
    expect(expiredNotice(cardRows(WALLET_NONE))).toBeNull();
  });
});

describe("the next bill, when the accounts could not be read", () => {
  it("names the payer and the NEXT billing date - never the anchor - and turns amber when a company is past due", () => {
    const page = subscriptionsPage();
    const next = nextBilling(page);
    expect(next.billTo).toBe("Olive Vine");
    expect(next.email).toBe("olive@example.com");
    // The fixture's anchor is 28 Jul: the cycle's start, which 08-A used to print as "next".
    expect(page.billing.anchor).toBe("28 Jul 2026");
    expect(next.date).toBe("28 Sep 2026");
    expect(next.failed).toBe(true);
    expect(next.failedNames).toEqual(
      ENTITIES.filter((e) => e.modules.some((m) => m.status === "past_due")).map(
        (e) => e.entity_name,
      ),
    );

    const paid = nextBilling(
      subscriptionsPage(ENTITIES.filter((e) => !e.modules.some((m) => m.status === "past_due"))),
    );
    expect(paid.failed).toBe(false);
    expect(paid.failedNames).toEqual([]);
    expect(nextBilling(null)).toEqual({
      billTo: "",
      email: null,
      addressLines: [],
      date: null,
      // The payer-level fallback has no account to price.
      amount: null,
      failed: false,
      failedNames: [],
    });
  });
});

describe("the invoice table", () => {
  it("takes the API's own money and dates, and names the currency in its header", () => {
    const lines = invoiceLines(INVOICES);
    expect(lines[0]).toMatchObject({ reference: "#11241234113", amount: "HK$19,383" });
    expect(amountHeader(INVOICES)).toBe("Amount (HK$)");
    expect(amountHeader([])).toBe("Amount");
  });

  // The Invoice PDF is our own document, offered where the API says there is one - never read
  // off Stripe's hosted page, which the third invoice lacks while still having its PDF.
  it("offers the PDF the API says there is, and none where it says nothing", () => {
    expect(invoiceLines(INVOICES).map((line) => line.hasPdf)).toEqual([true, true, true]);
    expect(INVOICES[2].hosted_invoice_url).toBeNull();
    const draft: InvoiceRow = { ...INVOICES[0], status: "draft", has_pdf: false };
    expect(invoiceLines([draft])[0].hasPdf).toBe(false);
    // An API older than the field: no PDF, rather than a button that can only fail.
    const older: InvoiceRow = { ...INVOICES[0] };
    delete older.has_pdf;
    expect(invoiceLines([older])[0].hasPdf).toBe(false);
  });

  // The column is headed "Paid date". It once read `date`, the day the invoice was RAISED,
  // and so printed a plausible wrong date on every row instead of failing.
  it("reads the settlement date, not the day the invoice was raised", () => {
    const lines = invoiceLines(INVOICES);
    expect(lines[0].paid).toBe(INVOICES[0].paid);
    expect(lines[0].paid).not.toBe(INVOICES[0].date);
  });

  it("leaves an invoice not yet settled with no date rather than borrowing one", () => {
    const draft = { ...INVOICES[0], status: "draft", paid: null, paid_iso: null };
    expect(invoiceLines([draft])[0]).toMatchObject({ paid: null, failed: false });
  });

  // 08-K: "Failed 26 Jul" under Paid date, the whole row red, and Retry payment only where a
  // retry would charge - the API's `retryable`, never assumed from the status alone.
  it("says a declined charge failed, on the day it was raised, and offers the retry the API allows", () => {
    const [current, abandoned] = invoiceLines(FAILED_INVOICES, new Date(TODAY));
    expect(current).toMatchObject({ failed: true, retryable: true });
    expect(current.paid).toBe(failedLabel(FAILED_INVOICES[0].date, new Date(TODAY)));
    expect(current.paid).toMatch(/^Failed \d{2} [A-Z][a-z]{2}$/);
    expect(abandoned).toMatchObject({ failed: true, retryable: false });
    // A paid invoice never offers one, whatever the API says.
    expect(invoiceLines([{ ...INVOICES[0], retryable: true }])[0].retryable).toBe(false);
  });

  it("names the year of a failure only when it is not this one", () => {
    const today = new Date("2026-09-28T00:00:00Z");
    expect(failedLabel("26 Jul 2026", today)).toBe("Failed 26 Jul");
    expect(failedLabel("26 Dec 2025", today)).toBe("Failed 26 Dec 2025");
    expect(failedLabel(null, today)).toBe("Failed");
  });
});

describe("the overview (08-A)", () => {
  it("shows five update lines, and Show more opens every one", () => {
    const { updates } = overview(subscriptionsPage(), TODAY);
    expect(UPDATES_SHOWN).toBe(5);
    expect(updates.length).toBeGreaterThan(UPDATES_SHOWN);
    expect(visibleUpdates(updates, false)).toEqual(updates.slice(0, 5));
    expect(visibleUpdates(updates, true)).toEqual(updates);
    expect(moreUpdatesLabel(updates)).toBe(`Show more (${updates.length - 5})`);
    // Five or fewer need no button at all.
    expect(moreUpdatesLabel(updates.slice(0, 5))).toBeNull();
    expect(visibleUpdates(updates.slice(0, 3), false)).toHaveLength(3);
  });

  it("counts COMPANIES: paying, and on a trial about to end", () => {
    const o = overview(subscriptionsPage(), TODAY);
    // A trial is not an active subscription - nothing is being charged for it yet.
    const paying = ENTITIES.filter((e) =>
      e.modules.some((m) => m.status === "active" || m.status === "cancelled"),
    ).length;
    expect(o.active).toBe(paying);
    expect(o.trialEnding).toBeGreaterThan(0);
    expect(entityCount(o.trialEnding)).toMatch(/entit(y|ies)$/);
    expect(entityCount(1)).toBe("1 entity");
  });

  it("writes a line per trial ending and per payment failed, failures first", () => {
    const o = overview(subscriptionsPage(), TODAY);
    expect(o.updates[0].tone).toBe("failed");
    expect(o.updates[0].text).toBe("Payment failed");
    const trial = o.updates.find((u) => u.tone === "trial")!;
    expect(trial.module).toMatch(/Petty Cash|Payment Request/);
    expect(trial.text).toBe("trial ends in");
    expect(trial.emphasis).toMatch(/^\d+ days?$/);
  });

  it("counts and lists every trial ending within 30 days - a trial's whole length", () => {
    // A payer whose trials all ended more than a week out read "Trial ending 0" over "Nothing
    // needs your attention" - with seven trials running. Frame 08-A: two trials, "2".
    const endingIn = (days: number) =>
      subscriptionsPage([
        {
          ...ENTITIES[1],
          modules: ENTITIES[1].modules.map((m) =>
            m.status === "trialing"
              ? { ...m, date_iso: new Date(TODAY.getTime() + days * 86_400_000).toISOString() }
              : m,
          ),
        },
      ]);
    expect(TRIAL_ENDING_DAYS).toBe(30);
    const month = overview(endingIn(30), TODAY);
    expect(month.trialEnding).toBe(1);
    expect(month.updates.length).toBeGreaterThan(0);
    expect(month.updates.every((u) => u.tone === "trial" && u.emphasis === "30 days")).toBe(true);
    // Past the window it is neither counted nor listed: figure and lines agree.
    expect(overview(endingIn(31), TODAY)).toMatchObject({ trialEnding: 0, updates: [] });
    expect(overview(null, TODAY)).toEqual({ active: 0, trialEnding: 0, updates: [] });
  });

  it("lists the trials soonest first, under every payment that failed", () => {
    const at = (days: number) => new Date(TODAY.getTime() + days * 86_400_000).toISOString();
    const [base] = ENTITIES;
    const trial = (id: string, name: string, days: number) => ({
      ...base,
      entity_id: id,
      entity_name: name,
      modules: [{ ...base.modules[0], status: "trialing" as const, date_iso: at(days) }],
    });
    const failing = {
      ...base,
      entity_id: "e-failing",
      entity_name: "Failing Limited",
      modules: [{ ...base.modules[0], status: "past_due" as const, date_iso: at(3) }],
    };
    const o = overview(
      subscriptionsPage([
        trial("e-late", "Late Limited", 28),
        failing,
        trial("e-soon", "Soon Limited", 2),
        trial("e-today", "Today Limited", 0),
      ]),
      TODAY,
    );
    expect(o.updates.map((u) => `${u.entityName}: ${u.text} ${u.emphasis ?? ""}`.trim())).toEqual([
      "Failing Limited: Payment failed",
      "Today Limited: trial ends today",
      "Soon Limited: trial ends in 2 days",
      "Late Limited: trial ends in 28 days",
    ]);
    expect(o.trialEnding).toBe(3);
  });

  it("does not count a trial that has lapsed or never started", () => {
    const over = subscriptionsPage([
      {
        ...ENTITIES[1],
        modules: ENTITIES[1].modules.map((m) =>
          m.status === "trialing" ? { ...m, status: "trial_expired" as const } : m,
        ),
      },
    ]);
    expect(overview(over, TODAY).trialEnding).toBe(0);
  });
});
