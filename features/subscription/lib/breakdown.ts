/**
 * 08-B's "Billing Breakdown · Download csv" - one invoice, company by company, as the file the
 * payer opens in a spreadsheet. Written to the user's sample (`Inv-11241234113 Breakdown by
 * Entity`), column for column:
 *
 *   Entity Name, Subscription, Monthly amount, Period start, Period end, Charged for the period
 *   Nexora Health Limited, Super Minty, 400, 26-Jul-26, 25-Aug-26, 400.00
 *
 * Pure: the API reads each line's days and rate back (`GET /api/me/invoices/{id}/breakdown`);
 * this only writes them down.
 */

import type { BreakdownRow, InvoiceBreakdown } from "@/features/subscription/api/payerPortal";
import { utcDay } from "@/features/subscription/lib/subscriptionSummary";

export const BILLING_BREAKDOWN = "Billing Breakdown";
export const DOWNLOAD_CSV = "Download csv";
export const PREPARING_CSV = "Preparing…";
export const BREAKDOWN_FAILED = "I couldn't prepare that breakdown. Mind trying again?";

export const BREAKDOWN_HEADERS = [
  "Entity Name",
  "Subscription",
  "Monthly amount",
  "Period start",
  "Period end",
  "Charged for the period",
] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86_400_000;

/** "26-Jul-26" - the sample's form, the day unpadded. */
export function sheetDate(day: Date | null): string {
  if (!day) return "";
  const year = String(day.getUTCFullYear()).slice(-2);
  return `${day.getUTCDate()}-${MONTHS[day.getUTCMonth()]}-${year}`;
}

/**
 * The last day a line paid for. A period runs to the day BEFORE the next begins - "26-Jul-26 to
 * 25-Aug-26", as the sample writes a month; an extension ends on the day access did ("to
 * 5-Aug-26").
 */
function lastDay(row: BreakdownRow): Date | null {
  const end = utcDay(row.period_end);
  if (!end) return null;
  return row.kind === "extension" ? end : new Date(end.getTime() - DAY);
}

/** "400", "280.50" - a rate, cents only when it has some. Plain: a spreadsheet cell, no grouping. */
function rateCell(minor: number | null): string {
  if (minor === null) return "";
  const major = minor / 100;
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
}

/** "400.00", "-153.55" - what was charged, always to the cent. */
function chargeCell(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** RFC 4180: a field with a comma, a quote or a line break is quoted, its quotes doubled. */
function cell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The whole file: the header, a line per company line, CRLF as spreadsheets expect. */
export function breakdownCsv(breakdown: InvoiceBreakdown): string {
  const lines = [BREAKDOWN_HEADERS.join(",")];
  for (const row of breakdown.rows) {
    lines.push(
      [
        row.entity_name,
        row.subscription,
        rateCell(row.monthly_minor),
        sheetDate(utcDay(row.period_start)),
        sheetDate(lastDay(row)),
        chargeCell(row.charged_minor),
      ]
        .map(cell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

/** "Inv-11241234113 Breakdown by Entity.csv" - the sample's name, the reference's "#" dropped. */
export function breakdownFilename(reference: string): string {
  return `Inv-${reference.replace(/^#/, "").trim()} Breakdown by Entity.csv`;
}
