// Billing accounts' rules: which account a page shows, what its "Bill to" block says (the name,
// the address off its charged card, the payer's ONE next date - never the anchor), which
// companies may move where and why not, and 08-C's form - what stops Save, what Stripe's address
// form opens on and which countries it offers, and what is sent.

import { describe, expect, it } from "vitest";

import { ACCOUNTS, ACCOUNTS_NONE } from "@/features/subscription/__fixtures__/billing";
import type { BillingAccount } from "@/features/subscription/api/payerPortal";
import {
  COMPANY_REQUIRED,
  EMAIL_INVALID,
  EMAIL_REQUIRED,
  TOO_LONG,
  accountBilling,
  accountCardLine,
  accountWallet,
  addressChanged,
  addressDefaults,
  addressLines,
  allowedCountries,
  cardAddress,
  companyCount,
  detailsChanges,
  detailsFields,
  findAccount,
  isEmail,
  moveFailedNotice,
  moveTargets,
  movableCompanies,
  movedNotice,
  pickAccount,
  validateDetails,
  validateIdentity,
} from "@/features/subscription/lib/billingAccounts";
import { cardRows } from "@/features/subscription/lib/billing";

const [COMPANY_A, VINE, UNNAMED] = ACCOUNTS.accounts;

describe("which billing account a page shows", () => {
  it("the one asked for, else the one a company is on, else the oldest", () => {
    expect(pickAccount(ACCOUNTS, { id: "acc-vine" })?.name).toBe("Vine Consulting Limited");
    expect(pickAccount(ACCOUNTS, { entity: "e-halcyon-labs-limited" })?.id).toBe("acc-legacy");
    expect(pickAccount(ACCOUNTS)?.id).toBe("acc-company-a");
    // A stale id still shows something true rather than failing the page.
    expect(pickAccount(ACCOUNTS, { id: "acc-gone" })?.id).toBe("acc-company-a");
    expect(pickAccount(ACCOUNTS_NONE)).toBeNull();
    expect(pickAccount(null)).toBeNull();
  });

  it("but 08-C's form opens on exactly the account named, or on nothing", () => {
    expect(findAccount(ACCOUNTS, "acc-vine")?.id).toBe("acc-vine");
    expect(findAccount(ACCOUNTS, "acc-gone")).toBeNull();
    expect(findAccount(ACCOUNTS, null)).toBeNull();
  });

  it("names the card an account charges, and how many companies it pays for", () => {
    expect(accountCardLine(COMPANY_A)).toBe("Visa ending in 4121");
    expect(accountCardLine({ ...COMPANY_A, card: null })).toBe("No card it can charge");
    expect(companyCount(1)).toBe("1 company");
    expect(companyCount(3)).toBe("3 companies");
  });

  it("feeds the card list with THIS account's card as the default", () => {
    const rows = cardRows(accountWallet(VINE));
    expect(rows.map((r) => [r.card.id, r.chip])).toEqual([["pm_amex1007", "default"]]);
    expect(accountWallet(null)).toBeNull();
  });
});

describe("the Bill to block", () => {
  it("prints the address line by line, the place once", () => {
    expect(addressLines(COMPANY_A.address)).toEqual([
      "Unit 10, 1/F, ABC Building",
      "2 ABC Street",
      "Quarry Bay, Hong Kong",
    ]);
    expect(addressLines(VINE.address)).toEqual([
      "18/F, Harbour Tower",
      "8 Harbour Road",
      "Wan Chai, Hong Kong Island, Hong Kong",
    ]);
    // "Hong Kong, Hong Kong" says it once; blanks drop out.
    expect(
      addressLines({
        line1: "1 Main St",
        line2: " ",
        city: "Hong Kong",
        state: null,
        postal_code: null,
        country: "HK",
        country_name: "Hong Kong",
      }),
    ).toEqual(["1 Main St", "Hong Kong"]);
    expect(addressLines(null)).toEqual([]);
  });

  it("is the account's name, email and address - and the payer's one next date", () => {
    const next = accountBilling(ACCOUNTS, COMPANY_A);
    expect(next).toEqual({
      billTo: "Company A Limited",
      email: "billing@companyalimited.com",
      addressLines: ["Unit 10, 1/F, ABC Building", "2 ABC Street", "Quarry Bay, Hong Kong"],
      date: "28 Sep 2026",
      // Its next renewal, estimated by the API - per ACCOUNT, where the date is the payer's.
      amount: "HKD 960",
      failed: true,
      failedNames: ["Willow Court Limited"],
    });
    // Every account renews on the same anchor: the same date whichever is shown.
    expect(accountBilling(ACCOUNTS, VINE).date).toBe(next.date);
    expect(accountBilling(ACCOUNTS, VINE).failed).toBe(false);
  });

  it("an account never named reads as the payer, email and all", () => {
    const next = accountBilling(ACCOUNTS, UNNAMED);
    expect(next.billTo).toBe("Olive Vine");
    expect(next.email).toBe("olive@example.com");
    expect(next.addressLines).toEqual([]);
    expect(next.failed).toBe(true); // its collection is failing
  });

  it("with no account at all, nothing to name", () => {
    expect(accountBilling(ACCOUNTS_NONE, null)).toMatchObject({ billTo: "", email: null });
  });
});

describe("moving a company - Change billing account", () => {
  it("lists every company on an account, by name, each with where it is now", () => {
    const rows = movableCompanies(ACCOUNTS);
    expect(rows.map((r) => r.entityName)).toEqual([
      "Aetheria Capital Limited",
      "Halcyon Labs Limited",
      "Lantern Bay Limited",
      "Nexora Health Limited",
      "Solera Group Limited",
      "Willow Court Limited",
    ]);
    expect(rows.find((r) => r.entityName === "Lantern Bay Limited")?.accountName).toBe(
      "Vine Consulting Limited",
    );
    // Its debt follows the account it is on - shown, never pickable.
    expect(rows.filter((r) => r.pastDue).map((r) => r.entityName)).toEqual([
      "Halcyon Labs Limited",
      "Willow Court Limited",
    ]);
    expect(movableCompanies(ACCOUNTS_NONE)).toEqual([]);
  });

  it("says why an account cannot take it: already there, a failed payment, no card", () => {
    const nexora = movableCompanies(ACCOUNTS).find(
      (r) => r.entityName === "Nexora Health Limited",
    )!;
    const noCard: BillingAccount = { ...VINE, id: "acc-nocard", card: null };
    const blocks = moveTargets(
      { ...ACCOUNTS, accounts: [...ACCOUNTS.accounts, noCard] },
      nexora,
    ).map((t) => [t.account.id, t.block]);
    expect(blocks).toEqual([
      ["acc-company-a", "current"],
      ["acc-vine", null],
      ["acc-legacy", "in_dunning"],
      ["acc-nocard", "no_card"],
    ]);
  });

  it("tells where a company went, or that the new account is ready without it", () => {
    expect(movedNotice(ACCOUNTS, "e-lantern-bay-limited")).toBe(
      "Lantern Bay Limited is now billed to Vine Consulting Limited.",
    );
    expect(movedNotice(ACCOUNTS, "e-nowhere")).toBeNull();
    expect(moveFailedNotice(ACCOUNTS, "e-nexora-health-limited")).toBe(
      "Your new billing account is ready, but Nexora Health Limited is still billed to Company A Limited. Move it again from Change billing account.",
    );
  });
});

describe("opening an account - its identity", () => {
  it("needs a company and an email that looks like one - onboarding's words", () => {
    expect(validateIdentity({ company: "", email: "" })).toEqual({
      company: COMPANY_REQUIRED,
      email: EMAIL_REQUIRED,
    });
    expect(validateIdentity({ company: "Acme", email: "not-an-email" })).toEqual({
      email: EMAIL_INVALID,
    });
    expect(validateIdentity({ company: " Acme ", email: "ap@acme.test" })).toEqual({});
    expect(isEmail("a+b@sub.domain.museum")).toBe(true);
  });

  it("refuses what the API would: more than 255 characters, counted as the API counts", () => {
    expect(validateIdentity({ company: "x".repeat(256), email: `${"a".repeat(250)}@acme.test` }))
      .toEqual({ company: TOO_LONG, email: TOO_LONG });
    expect(validateIdentity({ company: "x".repeat(255), email: "ap@acme.test" })).toEqual({});
    // 255 emoji are 510 UTF-16 units and still 255 characters to Python's len().
    expect(validateIdentity({ company: "🙂".repeat(255), email: "ap@acme.test" })).toEqual({});
  });
});

describe("08-C, the form", () => {
  const start = detailsFields(COMPANY_A);
  const card = addressDefaults(COMPANY_A)!;

  it("types the raw name and email; Stripe's address form opens on the charged card", () => {
    expect(start).toEqual({ company: "Company A Limited", email: "billing@companyalimited.com" });
    // Never named: an empty field, not the payer's name typed in for them.
    expect(detailsFields(UNNAMED).company).toBe("");
    // The cardholder and the six keys Stripe knows, nulls as blanks.
    expect(card).toEqual({
      name: "Rebecca Park",
      address: {
        line1: "Unit 10, 1/F, ABC Building",
        line2: "2 ABC Street",
        city: "Quarry Bay",
        state: "",
        postal_code: "",
        country: "HK",
      },
    });
    // An account that charges no card has nowhere to keep an address.
    expect(addressDefaults({ ...VINE, card: null })).toBeNull();
  });

  it("reads Stripe's value and the API's alike - trimmed, blanks for nulls, country upper-cased", () => {
    expect(cardAddress(" Rebecca Park ", { line1: " 1 ABC St ", line2: null, country: "hk" })).toEqual(
      {
        name: "Rebecca Park",
        address: { line1: "1 ABC St", line2: "", city: "", state: "", postal_code: "", country: "HK" },
      },
    );
  });

  it("sends only what changed - the address as a whole, the cardholder only when renamed", () => {
    expect(detailsChanges(start, start, { value: card, initial: card })).toEqual({});
    expect(detailsChanges({ ...start, company: " Company A Ltd " }, start)).toEqual({
      billing_company: "Company A Ltd",
    });
    const moved = { ...card, address: { ...card.address, line2: "", postal_code: "999077" } };
    expect(detailsChanges(start, start, { value: moved, initial: card })).toEqual({
      address: {
        line1: "Unit 10, 1/F, ABC Building",
        line2: "", // a blank is how a line is cleared
        city: "Quarry Bay",
        state: "",
        postal_code: "999077",
        country: "HK",
      },
    });
    expect(
      detailsChanges(start, start, { value: { ...card, name: "R. Park" }, initial: card }),
    ).toEqual({ cardholder: "R. Park" });
    expect(addressChanged({ ...card, name: "R. Park" }, card)).toBe(true);
    // No card, nothing to compare: the address never reads as changed.
    expect(addressChanged(card, null)).toBe(false);
  });

  it("stops Save on a name blanked, an email mistyped, and anything past 255 characters", () => {
    expect(validateDetails({ ...start, company: " " }, start)).toEqual({
      company: COMPANY_REQUIRED,
    });
    expect(validateDetails({ ...start, email: "nope" }, start)).toEqual({ email: EMAIL_INVALID });
    expect(validateDetails({ ...start, email: "" }, start)).toEqual({}); // cleared is fine
    expect(
      validateDetails({ company: "x".repeat(256), email: `${"a".repeat(250)}@acme.test` }, start),
    ).toEqual({ company: TOO_LONG, email: TOO_LONG });
    // An account never named may stay so.
    const unnamed = { ...start, company: "" };
    expect(validateDetails(unnamed, unnamed)).toEqual({});
  });

  it("offers the registry's countries, and the card's own when the registry lacks it", () => {
    const list = [{ code: "HK", name: "Hong Kong" }, { code: "SG", name: "Singapore" }];
    expect(allowedCountries(list, "HK")).toEqual(["HK", "SG"]);
    expect(allowedCountries(list, "ZZ")).toEqual(["ZZ", "HK", "SG"]);
    // No registry to go by: Stripe's whole list, and the API still checks what comes back.
    expect(allowedCountries(undefined, "HK")).toBeNull();
  });
});
