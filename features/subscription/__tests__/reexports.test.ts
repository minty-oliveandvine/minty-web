// Boundary rule 3 (eslint.config.mjs cannot express "only"): every route file under
// app/subscription is a one-line re-export from "@/features/subscription" - no JSX, no logic,
// nothing the shell would have to keep when the feature is lifted out (features/subscription/
// README.md, the extraction recipe). And rule 2 from the other side: nothing outside the
// feature folder imports anything deeper than its index.

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

const REEXPORT = /^export \{ \w+ as default \} from "@\/features\/subscription";\n?$/;

describe("app/subscription is re-exports only", () => {
  const files = walk(join(ROOT, "app", "subscription"));

  // The portal pages sit in a route group so their tabbed layout does not wrap the module
  // settings page of a company, which draws Flask's settings chrome instead.
  it("has at least the portal's layout and index, and the module settings page", () => {
    const names = files.map((f) => relative(ROOT, f).replace(/\\/g, "/"));
    expect(names).toContain("app/subscription/(portal)/layout.tsx");
    expect(names).toContain("app/subscription/(portal)/page.tsx");
    expect(names).toContain("app/subscription/(portal)/subscriptions/page.tsx");
    expect(names).toContain("app/subscription/entities/[entityId]/modules/page.tsx");
    // the seams: every not-yet-built flow under the module page and the portal says so
    expect(names).toContain("app/subscription/entities/[entityId]/modules/[...flow]/page.tsx");
    expect(names).toContain("app/subscription/(portal)/[...rest]/page.tsx");
  });

  it.each(files.map((f) => [relative(ROOT, f).replace(/\\/g, "/"), f]))(
    "%s is a single re-export from the feature index",
    (_name, file) => {
      const source = readFileSync(file, "utf8");
      const code = source
        .split("\n")
        .filter((line) => !line.trim().startsWith("//") && line.trim() !== "")
        .join("\n");
      expect(code + "\n").toMatch(REEXPORT);
    },
  );
});

describe("nothing outside the feature reaches past its index", () => {
  const outside = [
    ...walk(join(ROOT, "app")),
    ...walk(join(ROOT, "lib")),
    ...walk(join(ROOT, "components")),
    join(ROOT, "proxy.ts"),
  ];

  it.each(outside.map((f) => [relative(ROOT, f).replace(/\\/g, "/"), f]))("%s", (_name, file) => {
    const source = readFileSync(file, "utf8");
    const deep = source.match(/["']@\/features\/subscription\/[^"']+["']/g) ?? [];
    expect(deep).toEqual([]);
  });
});
