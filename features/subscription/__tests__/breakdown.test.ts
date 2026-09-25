// 08-B's "Billing Breakdown · Download csv": the file written to the user's sample, line for line
// - its columns, its dates ("26-Jul-26", a month to the day before the next begins, an extension
// to the day access ended), its numbers (a rate trimmed, a charge to the cent) - and what a
// spreadsheet needs (quoted fields, CRLF) and the file's name.

import { describe, expect, it } from "vitest";

import { BREAKDOWN } from "@/features/subscription/__fixtures__/billing";
import {
  BREAKDOWN_HEADERS,
  breakdownCsv,
  breakdownFilename,
  sheetDate,
} from "@/features/subscription/lib/breakdown";

describe("the billing breakdown CSV", () => {
  it("is the user's sample, line for line", () => {
    expect(breakdownCsv(BREAKDOWN)).toBe(
      [
        "Entity Name,Subscription,Monthly amount,Period start,Period end,Charged for the period",
        "Nexora Health Limited,Super Minty,400,26-Jul-26,25-Aug-26,400.00",
        "Aetheria Capital Limited,Payment Request,280,26-Jul-26,25-Aug-26,280.00",
        "Company E Limited,Petty Cash,280,26-Jul-26,5-Aug-26,90.32",
        "",
      ].join("\r\n"),
    );
    expect(BREAKDOWN_HEADERS).toHaveLength(6);
  });

  it("writes a credit negative, a marginal rate as charged, and leaves out what is not known", () => {
    const csv = breakdownCsv({
      ...BREAKDOWN,
      rows: [
        {
          ...BREAKDOWN.rows[1],
          kind: "unused",
          period_start: "2026-08-12T12:00:00+00:00",
          charged_minor: -15355,
        },
        { ...BREAKDOWN.rows[2], monthly_minor: 12050, period_end: null },
      ],
    });
    const [, credit, extension] = csv.split("\r\n");
    expect(credit).toBe("Aetheria Capital Limited,Payment Request,280,12-Aug-26,25-Aug-26,-153.55");
    expect(extension).toBe("Company E Limited,Petty Cash,120.50,26-Jul-26,,90.32");
  });

  it("quotes a name a spreadsheet would split, and doubles its quotes", () => {
    const csv = breakdownCsv({
      ...BREAKDOWN,
      rows: [{ ...BREAKDOWN.rows[0], entity_name: 'Olive, Vine & "Co" Limited' }],
    });
    expect(csv.split("\r\n")[1]).toMatch(/^"Olive, Vine & ""Co"" Limited",Super Minty,/);
  });

  it("names the file as the sample is named, and writes a day as the sample does", () => {
    expect(breakdownFilename("#11241234113")).toBe("Inv-11241234113 Breakdown by Entity.csv");
    expect(breakdownFilename("in_1UJ9BX")).toBe("Inv-in_1UJ9BX Breakdown by Entity.csv");
    expect(sheetDate(new Date(Date.UTC(2026, 7, 5)))).toBe("5-Aug-26");
    expect(sheetDate(null)).toBe("");
  });
});
