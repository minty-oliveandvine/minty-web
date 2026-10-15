// The two silent failure modes of consuming @minty/shared, each made loud.
//
// 1. TOKENS: app/globals.css imports @minty/shared/theme.css and tokens.css. Those are loud by
//    themselves (a bad specifier fails the build), but the ASSERTION here is what the tokens must
//    come out as - and
//    that nothing local redeclares them, which would win invisibly.
// 2. CLASSES: Tailwind v4 never scans node_modules, so without the `@source` line every utility
//    class inside the packaged sidebar is dropped from the generated CSS. Nothing errors. The
//    sidebar just renders as unstyled stacked text. This test is the only thing that catches it.
//
// It compiles the app's REAL stylesheet with the app's REAL Tailwind plugin, so it is testing what
// the browser is served, not what the file says.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { beforeAll, describe, expect, it } from "vitest";

const CSS = "app/globals.css";
const PKG_SRC = "node_modules/@minty/shared/src";

let compiled = "";

beforeAll(async () => {
  const source = readFileSync(CSS, "utf8");
  compiled = (await postcss([tailwind()]).process(source, { from: resolve(CSS) })).css;
}, 120_000);

describe("@minty/shared reaches the stylesheet", () => {
  it("declares the source so Tailwind scans the package", () => {
    const source = readFileSync(CSS, "utf8");
    expect(source).toContain('@import "@minty/shared/theme.css";');
    expect(source).toContain('@import "@minty/shared/tokens.css";');
    expect(source).toContain(`@source "../${PKG_SRC}";`);
    // The @source path is only as good as what is behind it.
    expect(existsSync(resolve(PKG_SRC, "sidebar/SideMenu.tsx"))).toBe(true);
  });

  it("has no local font tokens left to override the shared ones", () => {
    const source = readFileSync(CSS, "utf8");
    expect(source).not.toMatch(/^\s*--font-(sans|brand|mono):/m);
  });

  it("takes the Part 13 radius and type scales from tokens.css, with no local copy", () => {
    // minty-web's classes are written on the Part 13 scale (rounded-lg is 12px), so a local
    // --radius-* or --text-* would silently resize every button, input and heading.
    const source = readFileSync(CSS, "utf8");
    expect(source).not.toMatch(/^\s*--(radius|text)-[\w-]+:/m);
    expect(compiled).toMatch(/--radius-lg:\s*12px/);
    expect(compiled).toMatch(/--text-title-l:\s*20px/);
  });

  it("emits the shared faces, with the Minty name in Plus Jakarta Sans", () => {
    // The rule (CLAUDE.md): the Minty name is always Plus Jakarta Sans. --font-brand is how, and
    // --font-jakarta has to come FIRST or the lockup silently renders in Inter.
    expect(compiled).toMatch(/--font-brand:\s*var\(--font-jakarta\),\s*var\(--font-inter\)/);
    expect(compiled).toMatch(/--font-sans:\s*var\(--font-inter\)/);
  });

  it("emits the packaged sidebar's own utilities", () => {
    // Declarations, not class selectors: no escaping to get wrong. Each of these arbitrary values
    // appears in the package's sidebar and nowhere in this app's own source, so if Tailwind stops
    // scanning node_modules they disappear from the output.
    expect(compiled).toMatch(/width:\s*min\(100%,\s*353px\)/); // Sidebar's menu panel
    expect(compiled).toMatch(/padding-top:\s*max\(48px,\s*env\(safe-area-inset-top,\s*0px\)\)/); // SideMenu's nav
    expect(compiled).toMatch(/margin-left:\s*calc\(var\(--spacing\)\s*\*\s*22\)/); // the logo
    // A tokens.css colour role only the packaged sidebar uses here (the app says bg-selected).
    expect(compiled).toMatch(/background-color:\s*var\(--color-state-selected\)/);
  });
});
