// Boundary rule 3 for the entity list (eslint.config.mjs cannot express "only"): every route
// file under app/entities is a one-line re-export from "@/features/entities" - nothing the
// shell would have to keep when the feature is lifted out (README.md, the extraction recipe).
// And rule 2 from the other side: nothing outside the feature reaches past its index.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

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
// a page may also carry its tab title (`generateMetadata`, lib/companyTitle.ts) - still one line
const REEXPORT = /^export \{ \w+ as default(, \w+ as generateMetadata)? \} from "@\/features\/entities";\n?$/;

// A company's settings tabs sit under app/entities/[ref]/[slug]/settings but belong to the
// features that draw them (the Module tab: subscription) - their guards check them.
const SETTINGS = /^app\/entities\/\[ref\]\/\[slug\]\/settings\//;

describe("app/entities is re-exports only", () => {
  const files = walk(join(ROOT, "app", "entities")).filter((f) => !SETTINGS.test(rel(f)));

  it("has the list's page and a company's module choice", () => {
    expect(files.map(rel).sort()).toEqual(["app/entities/[ref]/[slug]/page.tsx", "app/entities/page.tsx"]);
  });

  it.each(files.map((f) => [rel(f), f]))("%s is a single re-export from the feature index", (_n, file) => {
    // Normalised: a core.autocrlf=true checkout hands the file back with CRLF.
    const code = readFileSync(file, "utf8")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && line.trim() !== "")
      .join("\n");
    expect(code + "\n").toMatch(REEXPORT);
  });
});

describe("nothing outside the feature reaches past its index", () => {
  const outside = [
    ...walk(join(ROOT, "app")),
    ...walk(join(ROOT, "lib")),
    ...walk(join(ROOT, "components")),
    ...walk(join(ROOT, "features")).filter((f) => !rel(f).startsWith("features/entities/")),
    join(ROOT, "proxy.ts"),
  ];

  it.each(outside.map((f) => [rel(f), f]))("%s", (_n, file) => {
    const source = readFileSync(file, "utf8");
    expect(source.match(/["']@\/features\/entities\/[^"']+["']/g) ?? []).toEqual([]);
  });
});
