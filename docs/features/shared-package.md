# `@minty/shared` — the shared TypeScript package

Since **2026-10-12** this app's sidebar, its viewer store and four small modules live in
[`minty-shared-ts`](https://github.com/minty-oliveandvine/minty-shared-ts) instead of here. It is
Part 3 step 4 of the modernisation plan, brought forward: nothing in the plan gated it, and the
same week had produced a third byte-identical copy of the design tokens.

It is for the **Next.js apps only**. Flask keeps its own sidebar and CSS and is not a consumer.

| Consumer | takes |
|---|---|
| `minty-web` (here) | the tokens **and** the components |
| `minty-payment-request-web` | the tokens **and** the components |
| `minty-onboarding-web` | `theme.css` only |
| `minty-www` | nothing — Tailwind v3 / React 18 / Next 14 |

## What came out of this repo

| Was | Now |
|---|---|
| `components/ui/{Sidebar,SideMenu,NavMenu,ViewerBadge}.tsx` | shims re-exporting `@minty/shared/sidebar` |
| `lib/viewer.ts` | a shim over `@minty/shared/viewer` |
| `lib/{safeNext,companyRef,leaveGuard,emailInput}.ts` | **deleted**; ~23 call sites import `@minty/shared/<name>` |
| `formatMoney(symbol, n)` in `features/subscription/lib/subscriptionSummary.ts` ("HK$400") | **deleted** (2026-10-21, the owner's one money rule): prices call `formatPrice(n, code)` from `@minty/shared/money` ("HKD 400", "HKD 400.50"; the space is non-breaking, `CODE_SPACE`) |
| the `@theme` font block in `app/globals.css` | `@import "@minty/shared/theme.css";` |
| the Minty v2 type scale (`--text-*`) and `--color-action-disabled` in `app/globals.css` | `@import "@minty/shared/tokens.css";` (v0.4, 2026-10-15) |

### The shared-code refactor (2026-10-21, the owner: one shared module per rule)

| Was | Now |
|---|---|
| `lib/calendarDays.ts` `hkIsoDate`, `daysFromToday`, `BUSINESS_TIME_ZONE`; the `MONTHS` copies in `entityRows.ts`, `billing.ts`, `breakdown.ts` | `@minty/shared/dates` (`isoDateInTimeZone(HK_TIME_ZONE, d)`, `daysFromToday`, `MONTHS`); `lib/calendarDays.ts` keeps only this app's `TRIAL_SOON_DAYS` |
| `features/subscription/lib/download.ts` | **deleted**; `@minty/shared/download` - `saveBlob(blob, filename)`, `saveTextFile(text, filename, type)` (the argument order flipped; the link is hidden and cleaned up even when the click throws) |
| `lib/env.ts`'s `url()` | `envUrl(name, raw, devFallback)` from `@minty/shared/env`; a production build with a URL unset **throws** (CI and every Vercel environment set all three) |
| `toFlask` in `proxy.ts` | `@minty/shared/proxy` (also escapes `>`) |
| `lib/apiClient.ts`'s request code, `ApiError`, `HOUSE_FALLBACK` | `createBearerClient`, `ApiError`, `HOUSE_FALLBACK` from `@minty/shared/apiClient`; `lib/apiClient.ts` keeps this app's configuration and the names it imports (`apiFetch`, `apiFetchBlob`, `mintyFetch`, `billingJson`, `flaskJson`, `flaskDecorationJson`) |
| `lib/auth.ts`'s cookie code, `decodeJwtPayload`, `secondsUntilExpiry`, `isTokenExpired()` | `createCookieAuth({ prefix: "minty" })` and the JWT reads from `@minty/shared/auth` (`isTokenExpired(token)` takes the token); `lib/auth.ts` keeps the instance, `setAuth(token, id, name)` and `isEntityScoped` |
| `lib/moduleClaims.ts` | **deleted**; `moduleClaims(token)` from `@minty/shared/auth` |
| `lib/handoff.ts`'s URL and redirect code, its `withReturnOrigin` copy; `lib/logout.ts` | `createHandoff({ route: "/handoff/minty-web" })` (no `companyFromNext`: Flask's minty-web hand-off takes a full id only) and `logoutUrl` from `@minty/shared/handoff`; `lib/handoff.ts` keeps the instance and `logOut`; `lib/logout.ts` **deleted** |
| `lib/previewSibling.ts` | **deleted**; `@minty/shared/previewSibling` |
| `app/landing/page.tsx`'s effect | `useLandingHandoff` from `@minty/shared/landing` |
| `features/profile/api/profile.ts` `fetchProfile`/`saveProfile`; the sidebar host's `loadViewer`; `fetchAllPayerSubscriptions`'s page walk | `createProfileApi`, `loadViewer`, `fetchAllSubscriptions` from `@minty/shared/portal`, over this app's clients |
| the sidebar host's inline `body` overflow lock | `pushAppScrollLock` from `@minty/shared/scrollLock` (reference counted) |
| `lib/hubPaths.ts` `companyPath` | `@minty/shared/companyRef` `companyPath` (segments joined with `/`; every caller here passed a leading slash, so no address changed) |
| the inline `useSyncExternalStore(noSubscribe, …)` copies (Header, LoginScreen, PortalChrome, SubscriptionOverviewScreen, ModuleSettingsScreen) | `useClientValue` from `@minty/shared/clientValue` |

**Kept local on purpose:** `lib/mintyEntry.ts` (`mintyEntryUrl`, `pettyCashWebUrl` and friends) -
the package's `mintyEntryUrl` adds `return_origin` to the `/enter` address, which this app's
never has (`pettyCashWebUrl` names it inside `next`), and returns null where this app falls back
to the entity list; `lib/settingsTabs.ts` and the Petty Cash / Payment Request Settings pills -
the package's `settingsSectionUrl`, `pettyCashSettingsUrl`, `paymentRequestSettingsUrl` and
`billsUrl` spell some of those addresses differently, and the navigation must not change.

**Behaviour that changed with it** (each re-pinned in its test, marked "owner 2026-10-21: one
shared module"): a query drops `""` and `null`; `{error: ""}` is the house line; a refusal's
sentence is read from `error`, `detail` or `message` and refused when it is a code, a single
word or markup; no token means no request; `apiFetchBlob` asks `Accept: */*`;
`decodeJwtPayload` reads UTF-8; `daysFromToday` trims and answers null for an impossible day;
`toFlask` escapes `>`; `envUrl` treats `/` as blank; `companyPath` joins segments with `/`.

**The sidebar's look is the package's (v0.4).** The `ui-update` branch restyled this app's sidebar
(Minty v2: 44px rows in `text-title-l`, 76px module icons, a 353px sheet, a 28px header badge);
that restyle moved INTO the package as v0.4 — the shims here stayed shims — so
minty-payment-request-web takes the same look the day it bumps past v0.2.

**This app is on the Part 13 radius and type scales.** `tokens.css` redefines Tailwind's
`--radius-*` (`rounded-md` 8px, `rounded-lg` 12px, `rounded-xl` 16px) and gives `text-display-*`,
`text-title-*` and `text-label` their Part 13 weight and tracking. Every class here was renamed to
keep its size (`lg→md`, `xl→lg`, `2xl→xl`, 2026-10-15), so write new ones on that scale: a button
or input is `rounded-lg`. The `--mv2-*` names in `globals.css` are the same colour values under
this app's older utility names (`bg-card`, `text-ink` ...); only `--shadow-overlay` and
`--shadow-modal` deliberately override the package's.

899 lines of component became 54 lines of shim. Each shim's first line is
`import "@/components/ui/sidebarHost";` — **load-bearing**: it registers this app's host before
anything renders. Keeping the old paths is why no page, feature or test had to change, and why
`eslint.config.mjs`'s boundary rules needed no edit (a package is a package, which a feature folder
may already import).

`lib/handoff.ts`'s `safeNext` stayed this app's (since 2026-10-21 through `createHandoff`'s
`home`), because the hub-home fallback is this app's answer, not the package's;
`lib/__tests__/handoff.test.ts` covers it. The rule itself is tested in the package.

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
  `"reauth"` there), so the package asks for a viewer rather than for a fetcher. Since 2026-10-21
  it is `loadViewer(flaskDecorationJson)` from `@minty/shared/portal` - this app's Flask client
  whose 401 only rejects.

## The two config lines, and the one that fails silently

```css
/* app/globals.css */
@import "tailwindcss";
@import "@minty/shared/theme.css";           /* tokens - a bad specifier fails the build */
@import "@minty/shared/tokens.css";          /* Part 13 colour roles, radius, type, shadows */
@import "material-symbols/rounded.css";
@source "../node_modules/@minty/shared/src"; /* AFTER every @import */
```

**Tailwind v4 never scans `node_modules`.** Without that `@source` line every utility class inside
a packaged component is dropped from the generated CSS — no error, just an unstyled drawer. And
`@source` must come after every `@import`, because CSS requires imports to precede other rules: an
`@source` above one silently invalidates it.

`next.config.ts` gets `transpilePackages: ["@minty/shared"]` from `withMintyDefaults` (the package
ships `.ts` source, so this app compiles it) and `vitest.config.ts` gets `server.deps.inline` from
`mintyVitest`, since Vitest does not read `transpilePackages`.

**The config files extend the package's presets (2026-10-22)**, the same in every Next.js app:
`tsconfig.json` extends `@minty/shared/tsconfig.base.json` (only `paths`, `include` and `exclude`
stay here); `eslint.config.mjs` spreads `@minty/shared/eslint` first and adds the boundary rules;
`package.json`'s `"prettier"` key names `@minty/shared/prettier` (`.prettierignore` stays local -
it protects `lib/legal/documents`); `vitest.config.ts` is `mintyVitest(import.meta.url)`;
`playwright.config.ts` is `mintyPlaywright({ port: 3000, testDir: ".", testMatch })`;
`next.config.ts` wraps its own settings (the `env` block, the pdf.js worker copy) in
`withMintyDefaults`, which adds the security headers, `poweredByHeader: false`, `transpilePackages`
and `allowedDevOrigins`; and `e2e/helpers.ts` re-exports `credentials`, `mintModuleToken`,
`forgedToken` and `reachable` from `@minty/shared/e2e` (its `requireCredentials` stays local because
it skips where the package's throws). `.editorconfig` is the same file in every app. A change to a
shared setting is a package change and a pin bump, never an edit here.

`test/setup.ts` lazy-imports `@/lib/viewer` **inside** its hook. At the top of the file it would
pull in the host and `next/navigation` before any test file's `vi.mock` registers, binding the real
modules for good.

## Guards

| Test | Catches |
|---|---|
| `app/__tests__/packagedStyles.test.ts` | a lost `@import`/`@source`, a local font, radius or type token redeclared, `@source` out of order, and the packaged sidebar's own declarations missing from the compiled CSS |
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
`v0.2`'s `previewSibling` was copied meanwhile (`lib/previewSibling.ts`, `withReturnOrigin` in
`lib/handoff.ts`; both deleted 2026-10-21 for `@minty/shared/previewSibling`). `ProfilePanel` gained `flex-1` the same day: the sheet's `<section>` has only a
min-height, so the panel's `min-h-full` resolved to auto and it stopped at its content.
