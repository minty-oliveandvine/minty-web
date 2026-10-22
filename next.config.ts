import { withMintyDefaults } from "@minty/shared/next";
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
 * withMintyDefaults (@minty/shared/next) supplies what every Minty app sends and needs: the
 * security headers on every path (the URL security round, 2026-10-05), no X-Powered-By,
 * `transpilePackages: ["@minty/shared"]` (the package ships .ts source - without it the build
 * fails on the first .ts file under node_modules) and 127.0.0.1 as an allowed dev origin (Next 16
 * otherwise never hydrates a page opened at http://127.0.0.1:3000, the address a Windows-hosted
 * test runner reaches for). Only this app's own settings are below.
 */
export default withMintyDefaults({
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
});
