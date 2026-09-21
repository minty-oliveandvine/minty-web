# minty-web

Minty's Next.js hub — port **3002**. Born in Part 2 of `Minty/docs/modernisation/modernisation_plan.md`
with one feature, **subscriptions** (the payer portal from billing-frontend and the module
settings page from Flask's Jinja), talking to `minty-billing-api` (:8004). Part 3 brings login,
the dashboard, profile and settings here; the subscription feature is built so it can be lifted
into its own app if that is ever wanted (`features/subscription/README.md`).

**Status: the shell (Part 2 step 1).** Landing, the two gates, the plumbing, the UI seed, the
bounded feature folder with its three typed API clients and a skeletal index. Step 4 ports the
portal screens and builds the module settings page. Verified 2026-09-21 on this workstation (Node
22.21): `npm run typecheck`, `lint` (a planted feature→app import and an outside→deep import both
fail the boundary rules), `test` (29 passed, 00:34), `build` (00:09) green; `test:e2e` against
`next dev` — 5 passed live (00:07) and 3 passed dark (00:06), the rest skipped by mode.

**Skeletal by decision** (2026-09-21): functional screens, minimal styling; a new frontend design
is created later. Data (`api/`, `hooks/`) and presentation (`components/`) are kept apart so the
design pass swaps the second without touching the first, and tests locate by role and text,
never by class.

## How a person gets in

Only through Minty. Flask mints a 30-minute module JWT and sends the browser to
`/landing?token=…&next=…&entity_id=…&entity_name=…`; the landing stores it in the `minty_token`
cookie (lifetime = the token's `exp`) and forwards to `next`. No cookie → `proxy.ts` sends
the browser to Flask's login-gated `GET /handoff/minty-web?next=<page>` (Minty, Part 2 step 5),
which mints a fresh token and comes back. A 401 from the API does the same (`lib/apiClient.ts`).
This app never mints or refreshes a token (cross-cutting rule 1). `docs/features/authentication.md`.

## The switch

`NEXT_PUBLIC_SUBSCRIPTION_ENABLED` — **on unless `0`** (the opposite default to the backends, so
`next dev` with no env file works). Off, `proxy.ts` sends `/subscription/*` and `/` to the
static `/not-available` page. The backends are the real guard (404 while dark); this only keeps
the doors out of sight. The deployed app is switched off at the cutover with minty-billing-api
and switched on at launch **after** the API (Part 2 step 7, 8b).

## Layout

```
app/                    shell routes only: layout · globals.css · page (→ /subscription) · landing · maintenance · not-available
app/subscription/       one-line re-exports from "@/features/subscription" (layout, page; the rest arrive in step 4)
features/subscription/  THE bounded folder — index.ts is its whole public surface; README.md has the extraction recipe
lib/                    env (the four NEXT_PUBLIC_*) · auth (the cookie) · apiClient (bearer, X-Entity-Id opt-in, 401 → handoff) · handoff
components/ui/          Header · Toast · Icon · MintySelect · Pagination — Part 3's @minty/shared seed
proxy.ts                cookie gate + dark redirect (Next 16's name for middleware.ts)
e2e/                    the shell's Playwright specs + helpers (JWT mint); features/*/e2e is picked up by the same config
eslint.config.mjs       next + typescript + the BOUNDARY RULES (eslint-plugin-boundaries)
```

### The boundary (enforced by `npm run lint` and `npm test`)

1. `features/subscription/**` imports only itself, `@/lib/**`, `@/components/ui/**` and packages.
2. Nothing outside imports `@/features/subscription/*` except `app/subscription/**`, and only the index.
3. `app/subscription/**/page.tsx` and `layout.tsx` are one-line re-exports (`__tests__/reexports.test.ts`).

## Run it

```bash
npm ci
copy .env.example .env.local
npm run dev                       # http://localhost:3002 → /subscription
```

The four variables are `NEXT_PUBLIC_BILLING_API_URL` (8004), `NEXT_PUBLIC_MINTY_URL` (5001),
`NEXT_PUBLIC_PAYMENTS_WEB_URL` (3000) and `NEXT_PUBLIC_SUBSCRIPTION_ENABLED`. In the docker stack
(`Minty/docker/stack`) this is the `minty-web` service on host port 3002.

## Test it

```bash
npm run typecheck && npm run lint      # tsc; eslint with the boundary rules on
npm test                               # Vitest: lib/apiClient from the feature's side, paths, the re-export guard
npm run build
npm run test:e2e                       # Playwright, against a RUNNING stack — e2e/README.md
```

Report the run time (mm:ss) of every suite with its result.

## Verifying the shell (done 2026-09-21; rerun after any change)

`npm ci`; `npm run typecheck`, `npm run lint` (a deliberate `import "@/app/page"` inside
`features/subscription` must fail), `npm test`, `npm run build` green; `npm run dev` on 3002 →
`/` redirects to `/subscription`, `/landing?token=…` sets the cookie; with
`NEXT_PUBLIC_SUBSCRIPTION_ENABLED=0` `/subscription` shows the not-available page;
`npm run test:e2e` (01_landing) green against it. Two Windows notes: open the dev server as
`localhost` in a browser (`allowedDevOrigins` in `next.config.ts` also admits `127.0.0.1`, which a
Node test runner prefers because `localhost` resolves to `::1` first and stalls); and the lockfile
`package-lock.json` is committed - `npm ci` needs it.

## Cross-cutting rules (from the plan; every repo carries them)

1. Flask is the only minter — this app stores and forwards the token, never mints or refreshes it.
2. Ports: `300d` for the `-web` — the hub is `d = 2`: this app 3002; its API, billing, is 8004.
3. One cutover map per app, never inline base URLs — `lib/env.ts` is that map for the four hosts.
4. `MAINTENANCE_MODE` will be honoured from Part 3 step 2 (the shared packages); `app/maintenance` is its page.
