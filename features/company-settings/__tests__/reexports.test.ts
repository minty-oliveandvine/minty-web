// Boundary rule 3 for a company's Users and Entity & Integration tabs (eslint.config.mjs cannot
// express "only"): their route files are one-line re-exports from "@/features/company-settings".
// And rule 2 from the other side: nothing outside the feature reaches past its index. Plus the
// shell's spelling of the two tabs' addresses.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { companySettingsPath } from "@/lib/hubPaths";

import { integrationPath, usersPath } from "@/features/company-settings/lib/paths";

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
const REEXPORT = /^export \{ \w+ as default(, \w+ as generateMetadata)? \} from "@\/features\/company-settings";\n?$/;
const TABS = ["users", "integration"].map((tab) => join(ROOT, "app", "entities", "[ref]", "[slug]", "settings", tab));

describe("the two tabs' route files are re-exports only", () => {
  const files = TABS.flatMap((dir) => walk(dir));

  it("has the Users tab and the Entity & Integration tab", () => {
    expect(files.map(rel).sort()).toEqual([
      "app/entities/[ref]/[slug]/settings/integration/page.tsx",
      "app/entities/[ref]/[slug]/settings/users/page.tsx",
    ]);
  });

  it.each(files.map((f) => [rel(f), f]))("%s is a single re-export from the feature index", (_n, file) => {
    const code = readFileSync(file, "utf8")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && line.trim() !== "")
      .join("\n");
    expect(code + "\n").toMatch(REEXPORT);
  });
});

describe("the shell's spelling of the tabs", () => {
  it("agrees with the feature's own", () => {
    expect(usersPath("e 1", "Olive Shop")).toBe(companySettingsPath("e 1", "Olive Shop", "users"));
    expect(integrationPath("e 1", "Olive Shop")).toBe(companySettingsPath("e 1", "Olive Shop", "integration"));
  });
});

describe("nothing outside the feature reaches past its index", () => {
  const outside = [
    ...walk(join(ROOT, "app")),
    ...walk(join(ROOT, "lib")),
    ...walk(join(ROOT, "components")),
    ...walk(join(ROOT, "features")).filter((f) => !rel(f).startsWith("features/company-settings/")),
    join(ROOT, "proxy.ts"),
  ];

  it.each(outside.map((f) => [rel(f), f]))("%s", (_n, file) => {
    const source = readFileSync(file, "utf8");
    expect(source.match(/["']@\/features\/company-settings\/[^"']+["']/g) ?? []).toEqual([]);
  });
});
