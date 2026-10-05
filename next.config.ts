import type { NextConfig } from "next";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The invoice preview's pdf.js worker (features/subscription/components/PdfPages.tsx), served by
 * this app at /pdfjs/pdf.worker.min.mjs: same-origin, never a CDN, and always the installed
 * pdfjs-dist's own. Copied here because next.config is what both `next dev` and `next build`
 * evaluate first; public/pdfjs/ is gitignored. The worker ONLY - our invoices embed every font
 * they use (Identity-H), so pdf.js needs neither its cMaps nor its standard fonts.
 *
 * The one file is overwritten, never the folder removed first (on Windows a running dev server
 * may hold it), and left alone when it is already the installed one. A failure does not stop the
 * server, but it is LOUD: without the worker the preview cannot draw a page.
 */
function copyPdfjsWorker(): void {
  const from = join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
  const dir = join(process.cwd(), "public", "pdfjs");
  const to = join(dir, "pdf.worker.min.mjs");
  if (!existsSync(from)) {
    console.error(
      `[next.config] The invoice preview cannot render: ${from} is missing - is pdfjs-dist installed? Run npm ci.`,
    );
    return;
  }
  try {
    if (existsSync(to) && readFileSync(to).equals(readFileSync(from))) return;
    mkdirSync(dir, { recursive: true });
    copyFileSync(from, to);
  } catch (err) {
    console.error(
      "[next.config] The invoice preview cannot render: pdf.js's worker could not be copied to public/pdfjs/.",
      err,
    );
  }
}

copyPdfjsWorker();

/**
 * Sent with every response (the URL security round, 2026-10-05). Same values in minty-web,
 * minty-payment-request-web and minty-onboarding-web, and in Flask (pettycash/core/http_hardening.py).
 * - Referrer-Policy same-origin: another site never sees a path or query from here (tokens).
 * - frame-ancestors / X-Frame-Options: only this app may frame its pages (clickjacking).
 * - HSTS in production builds only; a browser ignores it over plain http anyway.
 */
const securityHeaders = [
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  /** Slightly smaller responses; security-through-obscurity only. */
  poweredByHeader: false,
  /**
   * The sibling URLs lib/env.ts reads. Listing them here is what makes Next inline the literal
   * `process.env.X` reads at build time - in client code, server code and proxy.ts alike - under
   * their plain names (no NEXT_PUBLIC_ prefix). Raw values only: lib/env.ts owns the defaults.
   * A change needs `npm run dev` restarted or `npm run build` rerun.
   */
  env: {
    PETTY_CASH_URL: process.env.PETTY_CASH_URL ?? "",
    SUBSCRIPTION_API_URL: process.env.SUBSCRIPTION_API_URL ?? "",
    PAYMENT_REQUEST_WEB_URL: process.env.PAYMENT_REQUEST_WEB_URL ?? "",
  },
  /**
   * Next 16 refuses dev-only requests (HMR, the hydration payload) from an origin other than the
   * one the dev server was started as; without this, opening http://127.0.0.1:3000 renders the
   * HTML and never hydrates - the landing shows "Loading…" forever. 127.0.0.1 is what a
   * Windows-hosted test runner reaches for, because Node resolves `localhost` to ::1 first and
   * stalls ~2 s per request. Production is unaffected.
   */
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
