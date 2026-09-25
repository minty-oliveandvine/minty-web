// Section 08's rules: how a card is named and dated, the default pinned first, what its menu
// offers, the expired line, who the bill goes to and when it turns amber, the invoice table's
// header, and the overview's two figures and update lines.

import { describe, expect, it } from "vitest";

import { TODAY } from "@/features/subscription/__fixtures__/modulePage";
import {
  INVOICES,
  WALLET_EXPIRED,
  WALLET_MANY,
  WALLET_NONE,
  WALLET_TWO,
  card,
} from "@/features/subscription/__fixtures__/billing";
import { ENTITIES, subscriptionsPage } from "@/features/subscription/__fixtures__/subscriptions";
import {
  CARDS_SHOWN,
  TRIAL_ENDING_DAYS,
  amountHeader,
  cardExpiry,
  cardMenu,
  cardRows,
  cardTitle,
  entityCount,
  expiredNotice,
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
    expect(lines[0].pdf).toBe("https://invoice.stripe.test/in_1");
    expect(lines[2].pdf).toBeNull();
    expect(amountHeader(INVOICES)).toBe("Amount (HK$)");
    expect(amountHeader([])).toBe("Amount");
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
