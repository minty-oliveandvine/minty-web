// @minty/shared/eslint (next/core-web-vitals + typescript and the folders no app lints, pdf.js's
// copied worker in public/pdfjs/ among them), plus THE BOUNDARY RULES that keep every feature folder
// extractable - `features/subscription` (Minty/docs/modernisation/modernisation_plan.md, Part 2 -
// "it should be easily extracted"), and since 2026-09-29 `features/entities` (the select-company
// list) and `features/profile` (My Profile), built the same way at the user's word:
//
//   (features/auth - sign-in - and features/company-settings - a company's Users and Entity &
//   Integration tabs - joined them in phase 2, 2026-10-05.)
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
// @/components/ui at @minty/shared. Nothing else has to move because nothing else is allowed to
// reach in - and that held when the first half of it happened on 2026-10-12: the sidebar
// (Sidebar / SideMenu / NavMenu / ViewerBadge), lib/viewer and four modules every app had a copy
// of (safeNext, companyRef, leaveGuard, emailInput) went into @minty/shared, and not one feature
// folder had to change. The paths they left behind are shims re-exporting the package, so every
// call site kept its import. What is app-specific lives in ONE new file,
// components/ui/sidebarHost.ts, which the packaged sidebar reads.
//
// Still local, and still this element: lib/{auth,env,apiClient,handoff,hubPaths,moduleClaims,
// logout,mintyEntry,settingsTabs,terms,backLink,companyFromAddress,companyTitle,
// legal} and the rest of components/ui (Toast, Icon, MintySelect, ConfirmDialog, ModalFrame,
// AppHeader, Header, TermsGate/TermsModal, Wordmark, Pagination, RequiredMark, SettingsTabs,
// sheetClasses). No rule changed for any of this: a package is a package, which the rules already
// allow a feature to import.
import { defineConfig } from "eslint/config";
import minty from "@minty/shared/eslint";
import boundaries from "eslint-plugin-boundaries";

const eslintConfig = defineConfig([
  ...minty,
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
        // (the Module tab is a company's settings page since phase 2, mounted under app/entities;
        // listed before app-entities, because the first element a file matches is its type)
        {
          type: "app-subscription",
          pattern: ["app/subscription/**/*", "app/entities/*/*/settings/modules/**/*"],
          mode: "full",
        },
        {
          type: "app-company-settings",
          pattern: ["app/entities/*/*/settings/users/**/*", "app/entities/*/*/settings/integration/**/*"],
          mode: "full",
        },
        { type: "app-entities", pattern: "app/entities/**/*", mode: "full" },
        { type: "app-profile", pattern: "app/profile/**/*", mode: "full" },
        { type: "app-auth", pattern: "app/login/**/*", mode: "full" },
        // the rest of the shell's routes
        { type: "app", pattern: "app/**/*", mode: "full" },
        // one element per feature folder; `name` captures the folder so a feature may import itself
        { type: "feature", pattern: "features/*", mode: "folder", capture: ["name"] },
        // the shell's plumbing and its UI. Since 2026-10-12 this also holds the thin shims over
        // @minty/shared and the one file the packaged sidebar reads of this app
        // (components/ui/sidebarHost.ts) - see the note at the top.
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
              from: "app-company-settings",
              allow: ["shared", "app-company-settings", ["feature", { name: "company-settings" }]],
            },
            {
              from: "app-auth",
              allow: ["shared", "app-auth", ["feature", { name: "auth" }]],
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
                "app-auth",
                "app-company-settings",
                "proxy",
              ],
              allow: "**",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
