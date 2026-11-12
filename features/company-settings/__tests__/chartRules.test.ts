// The checks the chart of accounts and contacts forms run as the person types (owner, 2026-11-12): the API's
// own rules and words (minty_shared.accounts, onboarding-api's contacts), so Save never says
// anything new; an empty field only after a refused Save.

import { describe, expect, it } from "vitest";

import type { Account, Contact } from "@/features/company-settings/api/chart";
import {
  accountProblems,
  contactProblem,
  deleteNote,
} from "@/features/company-settings/lib/chartRules";

const rent: Account = {
  id: "a1",
  code: "469",
  name: "Rent",
  type: "expense",
  type_label: "Expense",
  description: "",
  own: true,
  source: "user",
  in_xero: false,
  used: false,
};
const input = (over = {}) => ({
  code: "470",
  name: "Fuel",
  type: "expense",
  description: "",
  ...over,
});

describe("an account's rules", () => {
  it("passes a clean one", () => {
    expect(accountProblems(input(), [rent], true)).toEqual({});
  });

  it("says an empty field only after a refused Save, and a bank may go without a code", () => {
    const empty = { code: "", name: "", type: "", description: "" };
    expect(accountProblems(empty, [], false)).toEqual({});
    expect(accountProblems(empty, [], true)).toEqual({
      type: "Choose the account type to continue.",
      code: "The code is still empty. Add a code to continue.",
      name: "The name is still empty. Add a name to continue.",
    });
    expect(accountProblems(input({ code: "", type: "bank" }), [], true)).toEqual({});
  });

  it("says a broken rule as it is typed", () => {
    expect(accountProblems(input({ code: "1".repeat(11) }), [], false).code).toBe(
      "The code can be up to 10 characters. Shorten it to continue.",
    );
    expect(accountProblems(input({ code: "4 7" }), [], false).code).toBe(
      "The code can use letters, numbers, dots and dashes. Remove the other characters.",
    );
    expect(accountProblems(input({ name: "n".repeat(81) }), [], false).name).toBe(
      "The name can be up to 80 characters. Shorten it to continue.",
    );
    expect(accountProblems(input({ description: "d".repeat(256) }), [], false).description).toBe(
      "The description can be up to 255 characters. Shorten it to continue.",
    );
  });

  it("names the account already holding a code or a name", () => {
    expect(accountProblems(input({ code: "469", name: " RENT " }), [rent], false)).toEqual({
      code: "The code 469 is already used by Rent. Choose another code.",
      name: "Another account is already called Rent. Choose another name.",
    });
  });
});

describe("a contact's name", () => {
  const kee: Contact = {
    id: "c1",
    name: "Kee Wah",
    own: true,
    source: "user",
    in_xero: false,
    xero_id: null,
    used: false,
  };

  it("refuses a name already there, case and spaces ignored, and an over-long one", () => {
    expect(contactProblem("kee   WAH", [kee], false)).toBe(
      "Kee Wah is already in your contacts. Use that one, or choose another name.",
    );
    expect(contactProblem("x".repeat(151), [], false)).toBe(
      "The name can be up to 150 characters. Shorten it to continue.",
    );
    expect(contactProblem("", [], false)).toBeNull();
    expect(contactProblem(" ", [], true)).toBe(
      "The contact's name is still empty. Add a name to continue.",
    );
  });
});

describe("delete's confirm", () => {
  it("says what happens to records and to Xero", () => {
    expect(deleteNote({ used: false, in_xero: false })).toBe("This can't be undone.");
    expect(deleteNote({ used: true, in_xero: true })).toBe(
      "This can't be undone. Records that already use it keep it, but it leaves every list. It's archived in Xero too.",
    );
  });
});
