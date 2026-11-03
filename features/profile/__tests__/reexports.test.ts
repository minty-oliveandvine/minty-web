// Boundary rule 3 for My Profile (eslint.config.mjs cannot express "only"): app/layout.tsx is
// the ONE composition, putting the subscription feature's overview card into the sidebar's My
// Profile - the only place the two features meet (there is no app/profile: the `/profile` page
// went 2026-11-03). And rule 2 from the other side: nothing outside the feature reaches past its
// index.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
const code = (file: string) =>
  readFileSync(file, "utf8")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && line.trim() !== "")
    .join("\n");

describe("My Profile has no page of its own", () => {
  it("app/profile does not exist - the sidebar's sheet is the only way in", () => {
    expect(existsSync(join(ROOT, "app", "profile"))).toBe(false);
  });
});

describe("app/layout.tsx composes the sidebar's My Profile, and nothing else of a feature", () => {
  const layout = code(join(ROOT, "app", "layout.tsx"));

  it("imports exactly the two feature indexes, one name from each", () => {
    expect(layout.match(/^import .* from "@\/features\/.*";$/gm)).toEqual([
      'import { ProfilePanel } from "@/features/profile";',
      'import { SubscriptionsOverviewCard } from "@/features/subscription";',
    ]);
  });

  it("puts the overview card into the panel and the panel into the sidebar, over the Terms gate", () => {
    // One element however Prettier wraps it: whitespace collapsed, none before a closing `>`.
    const flat = layout.replace(/\s+/g, " ").replace(/ >/g, ">");
    expect(flat).toContain(
      // main draws the original design (the owner, 2026-10-20)
      '<SidebarProvider look="classic" profile={<ProfilePanel subscriptions={<SubscriptionsOverviewCard />} />}>',
    );
    expect(layout).toContain("<TermsGate>{children}</TermsGate>");
  });
});

describe("nothing outside the feature reaches past its index", () => {
  const outside = [
    ...walk(join(ROOT, "app")),
    ...walk(join(ROOT, "lib")),
    ...walk(join(ROOT, "components")),
    ...walk(join(ROOT, "features")).filter((f) => !rel(f).startsWith("features/profile/")),
    join(ROOT, "proxy.ts"),
  ];

  it.each(outside.map((f) => [rel(f), f]))("%s", (_n, file) => {
    const source = readFileSync(file, "utf8");
    expect(source.match(/["']@\/features\/profile\/[^"']+["']/g) ?? []).toEqual([]);
  });
});
