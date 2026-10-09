// Boundary rule 3 for sign-in (eslint.config.mjs cannot express "only"): every route file under
// app/login and app/signup is a one-line re-export from "@/features/auth". And rule 2 from the
// other side: nothing outside the feature reaches past its index. Plus the shell's spelling of
// the two mounts.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { OPEN_PATHS } from "@/lib/hubPaths";

import { AUTH_BASE_PATH, AUTH_SIGNUP_PATH } from "@/features/auth";

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
const REEXPORT = /^export \{ \w+ as default \} from "@\/features\/auth";\n?$/;

describe("app/login and app/signup are re-exports only", () => {
  const files = [...walk(join(ROOT, "app", "login")), ...walk(join(ROOT, "app", "signup"))];

  it("has the sign-in page, the code's page and sign-up", () => {
    expect(files.map(rel).sort()).toEqual([
      "app/login/confirm/page.tsx",
      "app/login/page.tsx",
      "app/signup/page.tsx",
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

describe("the shell's spelling of the mounts", () => {
  it("lets log in and sign up through without a person", () => {
    expect(OPEN_PATHS).toContain(AUTH_BASE_PATH);
    expect(OPEN_PATHS).toContain(AUTH_SIGNUP_PATH);
  });
});

describe("nothing outside the feature reaches past its index", () => {
  const outside = [
    ...walk(join(ROOT, "app")),
    ...walk(join(ROOT, "lib")),
    ...walk(join(ROOT, "components")),
    ...walk(join(ROOT, "features")).filter((f) => !rel(f).startsWith("features/auth/")),
    join(ROOT, "proxy.ts"),
  ];

  it.each(outside.map((f) => [rel(f), f]))("%s", (_n, file) => {
    const source = readFileSync(file, "utf8");
    expect(source.match(/["']@\/features\/auth\/[^"']+["']/g) ?? []).toEqual([]);
  });
});
