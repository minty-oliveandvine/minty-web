// Boundary rule 3 for My Profile (eslint.config.mjs cannot express "only"): app/profile holds
// ONE file, the composition that puts the subscription feature's overview card into the
// profile's slot, and app/layout.tsx makes the same composition for the sidebar's My Profile -
// the only two places the two features meet. And rule 2 from the other side: nothing outside
// the feature reaches past its index.

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
const code = (file: string) =>
  readFileSync(file, "utf8")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//") && line.trim() !== "")
    .join("\n");

const COMPOSITION = [
  'import { ProfilePage } from "@/features/profile";',
  'import { SubscriptionsOverviewCard } from "@/features/subscription";',
  "export default function Page() {",
  "  return <ProfilePage subscriptions={<SubscriptionsOverviewCard />} />;",
  "}",
].join("\n");

describe("app/profile is the one composition and nothing else", () => {
  const files = walk(join(ROOT, "app", "profile"));

  it("has the profile's page only", () => {
    expect(files.map(rel)).toEqual(["app/profile/page.tsx"]);
  });

  it("app/profile/page.tsx composes the two feature indexes and does nothing else", () => {
    expect(code(files[0])).toBe(COMPOSITION);
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
    expect(layout).toContain(
      "<SidebarProvider profile={<ProfilePanel subscriptions={<SubscriptionsOverviewCard />} />}>",
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
