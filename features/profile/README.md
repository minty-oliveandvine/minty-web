# features/profile — the bounded folder

My Profile (Figma 10-A / 10-B, `43YI3MYtTfX5Xzz6dRoRuT` 1410:3314 / 1410:3364), moved from
minty-payment-request-web on 2026-09-29 with the new design and built, at the user's word, "the same way
as subscription is extractable". It opens only as the sidebar's My Profile sheet on
every page of this app (`ProfilePanel`); the `/profile` page was removed on 2026-11-03 (owner) and
that address is a 404 - `docs/features/profile.md`. minty-payment-request-web carries a COPY of this
folder since 2026-09-30, and Flask a Jinja port: change all three until
`@minty/shared` takes it (the same doc says how).

## Layout

```
index.ts        the ONLY public surface: ProfilePanel (with its one slot)
api/            profile.ts - Flask's GET / PATCH /api/me/profile (mintyFetch), and profileApi for the package
routes/         ProfilePanel (the package's panel, with this app's api and toast)
(@minty/shared/profile, v0.6, in the original look here: the body - head, details card, Log Out, states -
 useProfile, the panel and its titlebar, the plan label and what a save sends; the Subscriptions Overview card too)
__fixtures__/   SCOPED / SUPERMINTY / UNSCOPED - Vitest and Playwright
__tests__/      Vitest: the panel, the composition guard
e2e/            Playwright: 08_profile.spec.ts, over a stubbed Flask and billing API
```

## The rules (enforced by `npm run lint` and `npm test`)

1. This folder imports only itself, `@/lib/**`, `@/components/ui/**` and packages — never
   `@/app/**`, never another feature.
2. Nothing outside imports `@/features/profile/*` except `app/layout.tsx`, and it imports the
   index only.
3. The one composition: `app/layout.tsx` puts the subscription feature's
   `SubscriptionsOverviewCard` into `ProfilePanel`'s slot and the panel into the sidebar's
   (`__tests__/reexports.test.ts` pins those imports and that expression, and that there is no
   `app/profile`). `eslint.config.mjs` lets it import exactly those two indexes. The profile
   never reaches into the subscription feature: features meet only in `app/`.

## Extraction recipe

1. `git mv features/profile <new-repo>/features/profile` and compose `ProfilePanel` into the new
   repo's sidebar as `app/layout.tsx` does here.
2. In the new repo, point `@/lib/*` and `@/components/ui/*` at `@minty/shared` (the side menu,
   `mintyFetch`, `lib/viewer`, `lib/logout`) or copy them across.
3. Fill the `subscriptions` slot from wherever the subscription feature lives then — or pass
   nothing, and the profile simply has no overview.
4. Copy `public/profile/*` (the icons and the caped cat).
5. Move `e2e/*.spec.ts` under the new repo's Playwright config, and `npm run lint` in both repos.
