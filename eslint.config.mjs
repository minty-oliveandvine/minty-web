// next/core-web-vitals + typescript, plus THE BOUNDARY RULES that keep every feature folder
// extractable - `features/subscription` (Minty/docs/modernisation/modernisation_plan.md, Part 2 -
// "it should be easily extracted"), and since 2026-09-29 `features/entities` (the select-company
// list) and `features/profile` (My Profile), built the same way at the user's word:
//
//   1. features/<name>/** imports only itself, @/lib/**, @/components/ui/** and packages -
//      never @/app/** and never another feature;
//   2. nothing outside imports @/features/<name>/* except app/<its folder>/**, and it may import
//      only the index (features/<name>/index.ts is the feature's whole public surface). The TWO
//      exceptions are the places features meet: app/profile may also import the subscription
//      feature's index - My Profile's "Subscriptions Overview" card is that feature's, composed
//      into the profile's slot there - and app/layout.tsx may import both of those indexes, for
//      the same composition in the sidebar's My Profile view (since 2026-09-29);
//   3. app/<folder>/** are re-exports only (app/profile/page.tsx and app/layout.tsx: those two
//      compositions) - asserted by each feature's __tests__/reexports.test.ts, since ESLint
//      cannot see "only".
//
// Extraction later = `git mv features/<name> app/<folder>` into the new repo and point @/lib and
// @/components/ui at @minty/shared (Part 3 step 4). Nothing else has to move because nothing
// else is allowed to reach in.
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { boundaries },
    settings: {
      "boundaries/include": [
        "app/**/*",
        "features/**/*",
        "lib/**/*",
        "components/**/*",
        "proxy.ts",
      ],
      "boundaries/elements": [
        // the root layout: every page's shell, where the sidebar's My Profile view is composed
        { type: "app-layout", pattern: "app/layout.tsx", mode: "full" },
        // the shell's route folder for each feature: allowed to import that feature's index
        { type: "app-subscription", pattern: "app/subscription/**/*", mode: "full" },
        { type: "app-entities", pattern: "app/entities/**/*", mode: "full" },
        { type: "app-profile", pattern: "app/profile/**/*", mode: "full" },
        // the rest of the shell's routes
        { type: "app", pattern: "app/**/*", mode: "full" },
        // one element per feature folder; `name` captures the folder so a feature may import itself
        { type: "feature", pattern: "features/*", mode: "folder", capture: ["name"] },
        // the shell's plumbing and UI seed - Part 3's @minty/shared
        { type: "shared", pattern: ["lib/**/*", "components/ui/**/*"], mode: "full" },
        { type: "proxy", pattern: "proxy.ts", mode: "full" },
      ],
    },
    rules: {
      "boundaries/no-unknown-files": "error",
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            // rule 1: a feature reaches itself and the shared layer, nothing else
            { from: "feature", allow: ["shared", ["feature", { name: "${from.name}" }]] },
            // rule 2: only a feature's own app folder reaches it (and only its index - see entry-point)
            {
              from: "app-subscription",
              allow: ["shared", "app-subscription", ["feature", { name: "subscription" }]],
            },
            {
              from: "app-entities",
              allow: ["shared", "app-entities", ["feature", { name: "entities" }]],
            },
            {
              from: "app-profile",
              allow: [
                "shared",
                "app-profile",
                ["feature", { name: "profile" }],
                // the "Subscriptions Overview" card, composed into the profile's slot
                ["feature", { name: "subscription" }],
              ],
            },
            {
              from: "app-layout",
              allow: [
                "shared",
                "app",
                // the sidebar's My Profile view, with the overview card in its slot
                ["feature", { name: "profile" }],
                ["feature", { name: "subscription" }],
              ],
            },
            { from: "app", allow: ["shared", "app"] },
            { from: "shared", allow: ["shared"] },
            { from: "proxy", allow: ["shared"] },
          ],
        },
      ],
      "boundaries/entry-point": [
        "error",
        {
          default: "disallow",
          rules: [
            // from outside, a feature is its index.ts and nothing deeper
            { target: ["feature"], allow: "index.ts" },
            {
              target: [
                "shared",
                "app",
                "app-layout",
                "app-subscription",
                "app-entities",
                "app-profile",
                "proxy",
              ],
              allow: "**",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
