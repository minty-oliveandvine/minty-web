# features/subscription — the bounded folder

The subscription feature: the payer portal (subscriptions, change of subscriber, incoming
transfers, billing accounts and cards, invoices) and the module settings page of a company.
Everything the feature is lives in this folder; the rest of the app is a shell around it, and
the ESLint boundary (`eslint.config.mjs`) keeps it that way so the feature can be lifted into
its own app when login, dashboard, profile and settings join `minty-web` in Part 3.

## Layout — data vs. presentation

```
index.ts        the ONLY public surface: route components + SUBSCRIPTION_BASE_PATH
api/            typed clients over the minty-billing-api contracts (payerPortal, moduleSettings, notice)
hooks/          state and orchestration over api/ - what the screens call; tested
lib/            pure helpers (paths, formatting - payerPortalFormat.ts arrives with the port)
components/     the screens' pieces - plain, minimally styled; the design pass replaces these ONE FOR ONE
routes/         the page-level components app/subscription/**/page.tsx re-export
__tests__/      Vitest: api/, hooks/, lib/ and the re-export guard
e2e/            Playwright: the portal and module-page journeys (picked up by the root playwright.config.ts)
```

The split is deliberate (decision 2026-09-21: "frontend design is skeletal, a new design will
be created"): `api/` + `hooks/` hold everything that talks to the API and holds state and are
where the tests are; `components/` are functional screens with minimal styling that a design
pass swaps without touching the contracts, the hooks or the e2e specs (which locate by role
and text, never by class).

## The rules (enforced by `npm run lint` and `npm test`)

1. This folder imports only itself, `@/lib/**`, `@/components/ui/**` and packages — never
   `@/app/**`, never another feature.
2. Nothing outside imports `@/features/subscription/*` except `app/subscription/**`, and it
   imports the index only.
3. `app/subscription/**/page.tsx` and `layout.tsx` are one-line re-exports
   (`__tests__/reexports.test.ts`).
4. Links inside the feature are built with `lib/paths.ts`, never a literal `/subscription/…`.

## Extraction recipe (Part 3 step 4, or whenever subscription becomes its own app)

1. `git mv features/subscription <new-repo>/features/subscription` and
   `git mv app/subscription <new-repo>/app/subscription`; delete `FEATURE_PREFIX` from this
   app's `proxy.ts` and the `/` redirect in `app/page.tsx`.
2. In the new repo, point `@/lib/*` and `@/components/ui/*` at `@minty/shared` (they are its
   seed) or copy `lib/` + `components/ui/` across — nothing in this folder imports anything else.
3. Change `SUBSCRIPTION_BASE_PATH` in `lib/paths.ts` if the new app mounts it elsewhere.
4. Move `features/subscription/e2e/*.spec.ts` under the new repo's Playwright config; the
   helpers they use are `e2e/helpers.ts` (the JWT mint), which travels with `@minty/shared`'s
   e2e package or is copied.
5. `npm run lint` in both repos: the boundary rules must still hold on both sides.

## Status

Step 1 of Part 2: the folder, its index, the three API clients (typed to the contract, methods
mapped to the routes) and two skeletal routes (the index and the layout). Step 4 ports the
portal screens from `billing-frontend/components/profile/*` (behaviour, not look) and builds
the module settings page from Flask's `module_*.html` partials' behaviour.
