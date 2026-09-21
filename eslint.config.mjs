// next/core-web-vitals + typescript, plus THE BOUNDARY RULES that keep `features/subscription`
// extractable (Minty/docs/modernisation/modernisation_plan.md, Part 2 - "minty-web will only
// have the subscription for now and it should be easily extracted"):
//
//   1. features/subscription/** imports only itself, @/lib/**, @/components/ui/** and packages -
//      never @/app/** and never another feature;
//   2. nothing outside imports @/features/subscription/* except app/subscription/**, and it may
//      import only the index (features/subscription/index.ts is the feature's whole public surface);
//   3. app/subscription/**/page.tsx are re-exports only - asserted by
//      features/subscription/__tests__/reexports.test.ts, since ESLint cannot see "only".
//
// Extraction later = `git mv features/subscription app/subscription` into the new repo and point
// @/lib and @/components/ui at @minty/shared (Part 3 step 4). Nothing else has to move because
// nothing else is allowed to reach in.
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
        // the shell's route folder for the feature: allowed to import the feature's index
        { type: "app-subscription", pattern: "app/subscription/**/*", mode: "full" },
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
            // rule 2: only app/subscription reaches the feature (and only its index - see entry-point)
            { from: "app-subscription", allow: ["shared", "feature", "app-subscription"] },
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
            { target: ["shared", "app", "app-subscription", "proxy"], allow: "**" },
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
