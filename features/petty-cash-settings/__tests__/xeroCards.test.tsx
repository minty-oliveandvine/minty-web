// Petty Cash Settings' mapping card for a company keeping its books in Minty (Xero optional,
// 2026-11-10): the API sends `minty: true` and its own five accounts, and the card draws them -
// not the "Xero isn't connected" notice - with lines that don't say "from Xero". Ported from
// minty-petty-cash-web's components/settings/__tests__/XeroCards.test.tsx.

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  AccountCodesCard,
  XeroMappingCard,
} from "@/features/petty-cash-settings/components/XeroCards";
import { mappingProblems, type XeroRead } from "@/features/petty-cash-settings/lib/xeroSettings";

const account = (id: string, name: string, code: string) => ({ id, name, code });

function read(over: Partial<XeroRead> = {}): XeroRead {
  return {
    live: false,
    minty: true,
    organisation: null,
    mapping: [
      {
        key: "main_bank",
        label: "Petty Cash Account",
        kind: "account",
        options: [account("a1", "Petty Cash", "090")],
        selected: "a1",
      },
      {
        key: "deposit_bank",
        label: "Deposit Bank Account",
        kind: "account",
        options: [account("a2", "Bank", "091")],
        selected: null,
      },
      {
        key: "cashsale_account",
        label: "Cash Sales account code",
        kind: "account",
        options: [],
        selected: null,
      },
      {
        key: "owners_account",
        label: "Director Personal Account code",
        kind: "account",
        options: [],
        selected: null,
      },
      {
        key: "discrepancy_account",
        label: "Discrepancy account code",
        kind: "account",
        options: [],
        selected: null,
      },
    ],
    mapping_saved: true,
    account_codes: [{ code: "405", name: "Rent", selected: true }],
    permissions: { edit_mapping: true, edit_account_codes: true },
    ...over,
  };
}

const props = { busy: false, call: vi.fn(), connectHref: "/x", onRetry: vi.fn(), onSaved: vi.fn() };

describe("Minty on its own", () => {
  it("the mapping card draws its own accounts, with no contacts and no Xero wording", () => {
    render(<XeroMappingCard {...props} onAdded={vi.fn()} load={{ kind: "ready", read: read() }} />);
    expect(screen.getByText("Account mapping")).toBeInTheDocument();
    expect(screen.queryByText(/Xero isn.t connected/)).not.toBeInTheDocument();
    expect(screen.getByText("Select Petty Cash bank account")).toBeInTheDocument();
    expect(screen.queryByText(/Select the Customer contact/)).not.toBeInTheDocument();
    // the Xero-only group is not drawn at all (owner, 2026-11-12)
    expect(screen.queryByRole("heading", { name: "Xero contacts" })).not.toBeInTheDocument();
  });

  it("the account codes card draws its own codes", () => {
    render(<AccountCodesCard {...props} load={{ kind: "ready", read: read() }} />);
    expect(screen.getByText(/405/)).toBeInTheDocument();
    expect(screen.queryByText(/Xero isn.t connected/)).not.toBeInTheDocument();
  });

  it("a Xero company whose read has no mapping says Xero isn't connected, linking to the Integration tab", () => {
    render(
      <XeroMappingCard
        {...props}
        onAdded={vi.fn()}
        load={{ kind: "ready", read: read({ minty: false, mapping: null, account_codes: null }) }}
      />,
    );
    expect(screen.getByText("Account mapping")).toBeInTheDocument();
    expect(
      screen.getByText("The accounts daily closing uses, and the Xero contacts a report posts to."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Xero isn.t connected/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Integration" })).toHaveAttribute("href", "/x");
  });
});

describe("a company that banks all its sales (2026-11-10)", () => {
  it("labels the cash-sale account optional and never asks for it", () => {
    const base = read();
    const mapping = base.mapping!.map((f) =>
      f.key === "cashsale_account" ? { ...f, optional: true } : f,
    );
    render(
      <XeroMappingCard
        {...props}
        onAdded={vi.fn()}
        load={{ kind: "ready", read: read({ mapping }) }}
      />,
    );
    expect(screen.getByText("(optional)")).toBeInTheDocument();
    const picked = {
      main_bank: "a1",
      deposit_bank: "a2",
      cashsale_account: "",
      cashsale_contact: "",
      owners_account: "x",
      owners_contact: "",
      discrepancy_account: "y",
      discrepancy_contact: "",
    };
    expect(mappingProblems(mapping, picked, true)).toEqual({});
    expect(mappingProblems(base.mapping!, picked, true)).toEqual({
      cashsale_account: "Choose the Cash Sales account code.",
    });
  });
});

describe("a Xero company: the accounts first, then the Xero-only contacts grouped (owner, 2026-11-12)", () => {
  const contact = (
    key: "cashsale_contact" | "owners_contact" | "discrepancy_contact",
    label: string,
  ) => ({
    key,
    label,
    kind: "contact" as const,
    options: [{ id: `c-${key}`, name: "Olive" }],
    selected: null,
  });
  const xeroRead = () =>
    read({
      live: true,
      minty: false,
      organisation: "Olive Ltd",
      mapping: [
        ...(read().mapping ?? []),
        contact("cashsale_contact", "Cash Sales contact"),
        contact("owners_contact", "Director / Responsible person"),
        contact("discrepancy_contact", "Discrepancy contact"),
      ],
    });

  it("draws the five accounts' groups, then one Xero contacts group holding the three contacts", () => {
    render(
      <XeroMappingCard {...props} onAdded={vi.fn()} load={{ kind: "ready", read: xeroRead() }} />,
    );

    expect(screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual([
      "Petty Cash Account",
      "Deposit Bank Account",
      "Cash Sales",
      "Director Personal Account",
      "Discrepancy - Other Expense",
      "Xero contacts",
    ]);
    const group = within(
      screen
        .getByRole("heading", { name: "Xero contacts" })
        .closest("[data-mapping-group]") as HTMLElement,
    );
    expect(group.getByText("Select the Customer contact for cash sales")).toBeInTheDocument();
    expect(
      group.getByText("Select the Director or Responsible person who pays personally"),
    ).toBeInTheDocument();
    expect(
      group.getByText("Select the Director or Responsible person for the cash difference"),
    ).toBeInTheDocument();
    expect(group.getAllByRole("combobox")).toHaveLength(3);
  });
});

describe("a Xero company without a live connection (owner, 2026-11-12)", () => {
  it("still shows the five accounts to choose; only the Xero contacts group says Xero isn't connected", () => {
    render(
      <XeroMappingCard
        {...props}
        onAdded={vi.fn()}
        load={{ kind: "ready", read: read({ minty: false, live: false }) }}
      />,
    );

    expect(screen.getByText("Account mapping")).toBeInTheDocument();
    expect(
      screen.getByText("The accounts daily closing uses, and the Xero contacts a report posts to."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual([
      "Petty Cash Account",
      "Deposit Bank Account",
      "Cash Sales",
      "Director Personal Account",
      "Discrepancy - Other Expense",
      "Xero contacts",
    ]);
    expect(
      screen.getByRole("combobox", { name: /Select Petty Cash bank account/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/from Xero/)).not.toBeInTheDocument();
    const contacts = within(
      screen
        .getByRole("heading", { name: "Xero contacts" })
        .closest("[data-mapping-group]") as HTMLElement,
    );
    expect(contacts.getByText(/Xero isn.t connected/)).toBeInTheDocument();
    expect(contacts.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Xero isn.t connected/)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });
});
