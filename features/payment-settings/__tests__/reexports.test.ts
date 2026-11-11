// Boundary rule 3 for the Payment Settings tab (eslint.config.mjs cannot express "only"): its
// route file is a one-line re-export from "@/features/payment-settings". And rule 2 from the
// other side: nothing outside the feature reaches past its index. Plus the shell's spelling of
// the tab's address.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { companySettingsPath } from "@/lib/hubPaths";

import { integrationPath, paymentSettingsPath } from "@/features/payment-settings/lib/paths";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else if (/\.(ts|tsx|mts)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

const rel = (f: string) => relative(ROOT, f).replace(/\\/g, "/");
// the page also carries its tab title (`generateMetadata`, lib/companyTitle.ts) - still one
// statement, however Prettier wraps it
const REEXPORT =
  /^export \{\s*\w+ as default(,\s*\w+ as generateMetadata)?,?\s*\} from "@\/features\/payment-settings";\n?$/;
const TAB = join(ROOT, "app", "entity", "[ref]", "[slug]", "settings", "payment");

describe("the tab's route files are re-exports only", () => {
  const files = walk(TAB);

  it("is the one page", () => {
    expect(files.map(rel)).toEqual(["app/entity/[ref]/[slug]/settings/payment/page.tsx"]);
  });

  it.each(files.map((f) => [rel(f), f]))(
    "%s is a single re-export from the feature index",
    (_n, file) => {
      const code = readFileSync(file, "utf8")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && line.trim() !== "")
        .join("\n");
      expect(code + "\n").toMatch(REEXPORT);
    },
  );
});

describe("the shell's spelling of the tab", () => {
  it("agrees with the feature's own", () => {
    expect(paymentSettingsPath("e 1", "Olive Shop")).toBe(
      companySettingsPath("e 1", "Olive Shop", "payment"),
    );
    expect(integrationPath("e 1", "Olive Shop")).toBe(
      companySettingsPath("e 1", "Olive Shop", "integration"),
    );
  });
});

describe("nothing outside the feature reaches past its index", () => {
  const outside = [
    ...walk(join(ROOT, "app")),
    ...walk(join(ROOT, "lib")),
    ...walk(join(ROOT, "components")),
    ...walk(join(ROOT, "features")).filter((f) => !rel(f).startsWith("features/payment-settings/")),
    join(ROOT, "proxy.ts"),
  ];

  it.each(outside.map((f) => [rel(f), f]))("%s", (_n, file) => {
    const source = readFileSync(file, "utf8");
    expect(source.match(/["']@\/features\/payment-settings\/[^"']+["']/g) ?? []).toEqual([]);
  });
});
