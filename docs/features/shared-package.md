# `@minty/shared` — the shared TypeScript package

Since **2026-10-12** this app's sidebar, its viewer store and four small modules live in
[`minty-shared-ts`](https://github.com/minty-oliveandvine/minty-shared-ts) instead of here. It is
Part 3 step 4 of the modernisation plan, brought forward: nothing in the plan gated it, and the
same week had produced a third byte-identical copy of the design tokens.

It is for the **Next.js apps only**. Flask keeps its own sidebar and CSS and is not a consumer.

**Two designs since v0.6 (the owner, 2026-10-20):** `main` draws the **original** -
`<SidebarProvider look="classic">` in `app/layout.tsx` - and `development` the redesign (`v2`),
from the same code. My Profile and its Subscriptions Overview are `@minty/shared/profile`'s, in
the provider's look, with no PASSWORD row.

| Consumer                    | takes                                      |
| --------------------------- | ------------------------------------------ |
| `minty-web` (here)          | the tokens **and** the components          |
| `minty-payment-request-web` | the tokens **and** the components          |
| `minty-onboarding-web`      | `theme.css` only                           |
| `minty-www`                 | nothing — Tailwind v3 / React 18 / Next 14 |

## What came out of this repo

| Was                                                        | Now                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| `components/ui/{Sidebar,SideMenu,NavMenu,ViewerBadge}.tsx` | shims re-exporting `@minty/shared/sidebar`                |
| `lib/viewer.ts`                                            | a shim over `@minty/shared/viewer`                        |
| `lib/{safeNext,companyRef,leaveGuard,emailInput}.ts`       | **deleted**; ~23 call sites import `@minty/shared/<name>` |
| the `@theme` font block in `app/globals.css`               | `@import "@minty/shared/theme.css";`                      |

899 lines of component became 54 lines of shim. Each shim's first line is
`import "@/components/ui/sidebarHost";` — **load-bearing**: it registers this app's host before
anything renders. Keeping the old paths is why no page, feature or test had to change, and why
`eslint.config.mjs`'s boundary rules needed no edit (a package is a package, which a feature folder
may already import).

`lib/handoff.ts`'s `safeNext` wrapper stayed, because the hub-home fallback is this app's answer,
not the package's; `lib/__tests__/handoff.test.ts` covers it. The rule itself is tested in the
package.

## The host — `components/ui/sidebarHost.ts`

The one file the packaged sidebar reads of this app: the company and its name from the cookie, the
module claims, where each menu item leads, this app's router, how the page's scroll is held
(`body` here), what Logout owes, the current token, and who is looking. An unregistered host
**throws** and names this file — there is no silent default.

Three parts of its shape exist for reasons worth keeping:

- **`app: "minty-web"`.** The "one page, one app" guard keys on this name, not on object identity.
  Next evaluates a module once per bundler layer and again on **every HMR edit**, so this file
  legitimately produces several distinct objects in one page; identity threw on an ordinary dev
  reload. Re-registering the same app replaces the host, which is what HMR needs.
- **`usePathname()`.** `next/navigation` is imported **here**, never in the package, because
  `vi.mock("next/navigation")` in a test **does not reach a module inside `node_modules`** — a
  packaged component read the real hook, got `null` outside an app-router tree, and the sidebar
  stopped closing on a move between pages.
- **`loadViewer()`.** The two apps' fetchers disagree about what a 401 means (`"handoff"` here,
  `"reauth"` there), so the package asks for a viewer rather than for a fetcher.

## The two config lines, and the one that fails silently

```css
/* app/globals.css */
@import "tailwindcss";
@import "@minty/shared/theme.css"; /* tokens - a bad specifier fails the build */
@import "material-symbols/outlined.css";
@source "../node_modules/@minty/shared/src"; /* AFTER every @import */
```

**Tailwind v4 never scans `node_modules`.** Without that `@source` line every utility class inside
a packaged component is dropped from the generated CSS — no error, just an unstyled drawer. And
`@source` must come after every `@import`, because CSS requires imports to precede other rules: an
`@source` above one silently invalidates it.

`next.config.ts` carries `transpilePackages: ["@minty/shared"]` (the package ships `.ts` source, so
this app compiles it) and `vitest.config.ts` carries `server.deps.inline`, since Vitest does not
read `transpilePackages`.

`test/setup.ts` lazy-imports `@/lib/viewer` **inside** its hook. At the top of the file it would
pull in the host and `next/navigation` before any test file's `vi.mock` registers, binding the real
modules for good.

## Guards

| Test                                   | Catches                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/__tests__/packagedStyles.test.ts` | a lost `@import`/`@source`, a local token redeclared, `@source` out of order, and the packaged sidebar's own declarations missing from the compiled CSS    |
| `app/__tests__/packagedAssets.test.ts` | a `/menu/*` file the package renders that this app's `public/` does not serve (Next cannot serve one from `node_modules`) — a broken image is not an error |

## Changing it

Change the package, tag it, bump the pin — never edit `node_modules`:

```
minty-shared-ts: development -> green -> main -> git tag -a vX.Y -> push the tag
here:            npm install "git+https://github.com/minty-oliveandvine/minty-shared-ts.git#vX.Y"
                 -> push a BRANCH, let check / check and the Vercel preview go green -> merge
```

The lockfile will say `git+ssh://` whatever URL you type, and that is fine: npm falls back to
HTTPS for a public repo, so `npm ci` needs no SSH key (verified 2026-10-12). Tags are immutable.
Never push a pin bump straight to `development` — production builds from it.

## Pinned at `v0.1` on purpose (owner, 2026-10-13)

`v0.2` restyles the sidebar to Part 13 and needs `@minty/shared/tokens.css`, which also redefines
Tailwind's radius scale for every page here - so this app stays on `v0.1` until it migrates. Without
the token sheet the v0.2 sheet draws transparent with no scrim (seen 2026-10-13).
`v0.2`'s `previewSibling` is copied meanwhile (`lib/previewSibling.ts`, `withReturnOrigin` in
`lib/handoff.ts`). `ProfilePanel` gained `flex-1` the same day: the sheet's `<section>` has only a
min-height, so the panel's `min-h-full` resolved to auto and it stopped at its content.
