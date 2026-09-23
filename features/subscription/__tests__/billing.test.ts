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
  amountHeader,
  cardExpiry,
  cardMenu,
  cardRows,
  cardTitle,
  entityCount,
  expiredNotice,
  invoiceLines,
  nextBilling,
  overview,
  showMoreLabel,
  visibleCards,
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

describe("the next bill", () => {
  it("names the payer and the anchor, and turns amber when a company is past due", () => {
    const page = subscriptionsPage();
    const next = nextBilling(page);
    expect(next.billTo).toBe("Olive Vine");
    expect(next.email).toBe("olive@example.com");
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
      date: null,
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

  it("leaves out the trials that are further off than the window", () => {
    const far = subscriptionsPage([
      {
        ...ENTITIES[1],
        modules: ENTITIES[1].modules.map((m) =>
          m.status === "trialing"
            ? { ...m, date_iso: new Date(TODAY.getTime() + 30 * 86_400_000).toISOString() }
            : m,
        ),
      },
    ]);
    const o = overview(far, TODAY);
    expect(o.trialEnding).toBe(0);
    expect(o.updates).toEqual([]);
    expect(overview(null, TODAY)).toEqual({ active: 0, trialEnding: 0, updates: [] });
  });
});
