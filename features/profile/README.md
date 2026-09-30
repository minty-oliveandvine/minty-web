# features/profile — the bounded folder

My Profile (Figma 10-A / 10-B, `43YI3MYtTfX5Xzz6dRoRuT` 1410:3314 / 1410:3364), moved from
billing-frontend on 2026-09-29 with the new design and built, at the user's word, "the same way
as subscription is extractable". Drawn twice from one body: the sidebar's My Profile view on
every page of this app (`ProfilePanel`), and the `/profile` page for Minty's `/profile` router
(`ProfilePage`) - `docs/features/profile.md`. billing-frontend carries a COPY of this folder
(without the page) since 2026-09-30, and Flask a Jinja port: change all three until
`@minty/shared` takes it (the same doc says how).

## Layout

```
index.ts        the ONLY public surface: ProfilePage + ProfilePanel (each with its one slot) + PROFILE_BASE_PATH
api/            profile.ts - Flask's GET / PATCH /api/me/profile, typed (mintyFetch)
hooks/          useProfile - the read (with the cookie's company), the details card's edit and save
lib/            profileView (pure: the plan label, the back arrow, what a save sends), paths
components/     ProfileBody (head, card, slot, Log Out - the page's and the panel's), ProfileParts (the two
                titlebars, head, Log Out, states), DetailsCard
routes/         ProfilePage (Suspense + the query string) -> ProfileScreen (the page); ProfilePanel (the sidebar's view)
__fixtures__/   SCOPED / SUPERMINTY / UNSCOPED - Vitest, Playwright and ?fixture=
__tests__/      Vitest: the rules, the screen, the composition guard
e2e/            Playwright: 08_profile.spec.ts, over a stubbed Flask and billing API
```

## The rules (enforced by `npm run lint` and `npm test`)

1. This folder imports only itself, `@/lib/**`, `@/components/ui/**` and packages — never
   `@/app/**`, never another feature.
2. Nothing outside imports `@/features/profile/*` except `app/profile/**` and `app/layout.tsx`,
   and they import the index only.
3. The two composition files: `app/profile/page.tsx` puts the subscription feature's
   `SubscriptionsOverviewCard` into `ProfilePage`'s `subscriptions` slot and does nothing else
   (`__tests__/reexports.test.ts` pins it word for word); `app/layout.tsx` puts the same card
   into `ProfilePanel`'s slot and the panel into the sidebar's (the guard pins those imports and
   that expression). `eslint.config.mjs` lets both import exactly those two indexes. The profile
   never reaches into the subscription feature: features meet only in `app/`.

## Extraction recipe

1. `git mv features/profile <new-repo>/features/profile` and `git mv app/profile
   <new-repo>/app/profile`; delete its line from this app's `lib/hubPaths.ts`.
2. In the new repo, point `@/lib/*` and `@/components/ui/*` at `@minty/shared` (the side menu,
   `mintyFetch`, `lib/viewer`, `lib/logout`) or copy them across.
3. Fill the `subscriptions` slot from wherever the subscription feature lives then — or pass
   nothing, and the profile simply has no overview.
4. Copy `public/profile/*` (the icons and the caped cat).
5. Move `e2e/*.spec.ts` under the new repo's Playwright config, and `npm run lint` in both repos.
