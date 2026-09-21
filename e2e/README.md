# minty-web browser tests

```bash
npm install
npx playwright install chromium   # once
npm run test:e2e                  # against a stack that is already running
E2E_SUBSCRIPTIONS=0 npm run test:e2e   # against a stack running dark
```

Real browser, stack already up (this app :3002 `npm run dev`, minty-billing-api :8004, Minty
:5001). **Nothing is started here.** Specs skip with a reason when a service or the credentials
are missing.

Two folders, one runner (`playwright.config.ts`): `e2e/` holds the shell's specs; the feature's
own journeys live in `features/subscription/e2e/` so that lifting the feature out takes its
specs with it.

## Credentials

The specs arrive the way Minty sends people: `/landing?token=<jwt>`. They mint that JWT
themselves with the shared `SECRET_KEY` (see `e2e/helpers.ts` for why nothing is bypassed):

| Variable                                                 | What                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `E2E_JWT_SECRET`                                         | the `SECRET_KEY` shared by Minty and minty-billing-api                                                  |
| `E2E_MINTY_USER` / `E2E_MINTY_ENTITY`                    | the identity `Minty/scripts/e2e_seed.py --print` creates                                                |
| `E2E_MINTY_ENTITY_NAME`                                  | optional, default `E2E Petty Cash Shop`                                                                 |
| `E2E_BASE_URL` / `E2E_BILLING_API_URL` / `E2E_FLASK_URL` | the three hosts; default the local ports (`E2E_FLASK_URL` must equal the app's `NEXT_PUBLIC_MINTY_URL`) |
| `E2E_SUBSCRIPTIONS`                                      | `0` when the app was built with `NEXT_PUBLIC_SUBSCRIPTION_ENABLED=0` and the backends run dark          |

Run the seed in the Minty repo before every run. Never commit any of these values. Report the
run time (mm:ss) with the result.

## Specs

| File                                                        | Journeys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01_landing.spec.ts`                                        | no token → Flask's re-handoff (stubbed: the route exists in Minty since 2026-09-21, but the spec asserts where the browser is sent, not what Flask does); the API is stubbed too (`stubBillingApi`, a 501 like the real routers) so a token for a user the API's database does not hold cannot 401 the browser out of the app · no cookie on a page → the re-handoff for that page · the handoff stores the cookie (lifetime = the token's) and lands on `next` · an unsafe `next` is ignored · `/` is the feature · **dark:** `/subscription` and `/` show the not-available page, the landing still stores the cookie |
| `features/subscription/e2e/02_module_settings.spec.ts`      | the module settings page over a STUBBED API (`page.route` serves `features/subscription/__fixtures__`; the router is a 501 stub until step 3): the chrome and tabs, the cards per Figma frame, _Start Free Trial_ posts `{codes}`, a seam's URL, the payment-failed banner, the Checkout return posts once and leaves the URL, no buttons for a non-payer · **dark:** the page goes to not-available. Runs with stand-in credentials when `E2E_*` are unset (nothing reaches the API). Located inside `main` - `next dev` adds its own button and alert outside it                                                      |
| `features/subscription/e2e/03_manage_subscriptions.spec.ts` | the Manage Subscriptions list over the STUBBED API: the list from the landing with the transfer card and the two sections, a row's cells, the ⋮ menu's items and a seam, Start Trial asks then posts with the company's id, search and the no-match state, the empty state, `?entity=` brings the row into view                                                                                                                                                                                                                                                                                                         |
| `features/subscription/e2e/*` (later)                       | with the portal port: the five journeys from `billing-frontend/e2e/03_payer_portal.spec.ts`; with step 3: a module-page journey over the live API (cards for the seeded shop; start a card-free trial → Flask's gate opens)                                                                                                                                                                                                                                                                                                                                                                                             |

## Not covered here

Stripe card capture (Elements iframes stay out of Playwright, as in the sibling apps; the
capture flow is unit-tested with Stripe stubbed). The API's own contract is
`minty-billing-api/e2e`.
