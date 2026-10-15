/**
 * `lib/legal/registry.server.ts` must never reach a client component.
 *
 * It opens files (`node:fs`) and hashes them (`node:crypto`). A `"use client"` file that imports
 * it breaks the browser bundle at build time - but only on the page that pulls that component in,
 * which is exactly the kind of failure that lands on someone else. The `.server.ts` suffix is a
 * convention Next does not enforce and the `server-only` package is not installed here, so this
 * reads the source instead. Same idea as `components/ui/__tests__/requiredFieldsMarked.test.ts`.
 *
 * A client component reads a document through `lib/legal/client.ts` (which asks
 * `app/api/legal/[kind]/[version]`), never through the registry.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const SEARCHED = ["app", "components", "features", "lib"];
const SKIPPED = new Set(["node_modules", ".next", "e2e", "__tests__"]);

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIPPED.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry)) {
      found.push(full);
    }
  }
  return found;
}

describe("the legal registry stays on the server", () => {
  const files = SEARCHED.flatMap((dir) => sourceFiles(join(ROOT, dir)));

  it("finds the source tree", () => {
    // A broken walk would pass every assertion below for the wrong reason.
    expect(files.length).toBeGreaterThan(50);
  });

  it("is imported by no client component", () => {
    // An IMPORT of it, not a mention: a comment naming the module (TermsModal's props say where
    // the document comes from) is documentation, not a dependency.
    const imports =
      /(?:from\s*|require\(\s*|import\(\s*)["'][^"']*lib\/legal\/registry\.server["']/;
    const offenders = files.filter((file) => {
      const text = readFileSync(file, "utf8");
      return /^\s*["']use client["']/m.test(text) && imports.test(text);
    });
    expect(offenders.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it("is imported by no file under components/ui that a client component could pull in", () => {
    // LegalDocumentPage is a server component by omission: it renders the document the pages
    // read. If it ever gains "use client", the test above catches it - this one states the rule.
    const page = readFileSync(join(ROOT, "components/ui/LegalDocumentPage.tsx"), "utf8");
    expect(page).not.toMatch(/^\s*["']use client["']/m);
    expect(page).not.toMatch(/from\s*["'][^"']*lib\/legal\/registry\.server["']/);
  });
});
