# Subscriptions — the hub's first feature

The payer portal and a company's module settings page, over `minty-billing-api` (:8004). This
page is the map of the feature as it stands (**Part 2 step 1: the shell, the bounded folder,
the typed API clients and a skeletal index; step 4a: the module settings page, built from its
Figma design over a stubbed API**) and of what the rest of step 4 fills in. The behaviour being
ported is described in `Minty/docs/features/modules-and-subscriptions.md` (the Flask module page)
and billing-frontend's portal components; the API contract in
`minty-billing-api/docs/features/subscriptions-api.md`.

## 1. What a person gets

Reached from Minty — the entity list's _Subscriptions_ link (an unscoped token, for the portal)
or a company's _Modules_ settings (a scoped token, for that company's page). Never a login here.

| Page              | Path                                              | Today                                                                                                                                                                                                                                 | Step 4                                                                                                                                        |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Index             | `/subscription`                                   | **the Manage Subscriptions list** (§10), the same page as below                                                                                                                                                                       | —                                                                                                                                             |
| Subscriptions     | `/subscription/subscriptions`                     | **built** (§10): every company the payer pays for in one scrolling list, a cell per module, search, the column sorts, the ⋮ menu, Start Trial from the list, the transfer-request cards, the payment-failed line — over a stubbed API | the row's expanded state (the design's M-frames), the confirm flows the ⋮ items lead to (section 06), _Change subscriber_, incoming transfers |
| Change subscriber | `/subscription/subscriptions/subscriber?entity=…` | —                                                                                                                                                                                                                                     | admins the bill could move to, each with a quote and inherited trials; offer / withdraw                                                       |
| Incoming          | `/subscription/subscriptions/incoming`            | —                                                                                                                                                                                                                                     | offers made to me: accept (charges the quote) / decline                                                                                       |
| Billing           | `/subscription/billing`                           | —                                                                                                                                                                                                                                     | billing accounts, saved cards (Stripe Elements card capture), default, per-company nomination                                                 |
| Invoices          | `/subscription/invoices`                          | —                                                                                                                                                                                                                                     | every invoice, newest first, filter by company, Stripe's hosted page                                                                          |
| Module settings   | `/subscription/entities/{id}/modules`             | **built** (§9): the settings chrome, the two module cards in their six states, the payment-failed banner, _Start Free Trial_, the `?session_id=` return, the `?from=bills` way back — over a stubbed API until step 3                 | the pages the other CTAs lead to (Manage / Activate / Resume / Reactivate / payment method), each from its own Figma frame; the live API      |

**Skeletal by decision** (2026-09-21) for the portal screens: functional, minimal styling, a
design later. The module settings page is the exception — its design exists (Figma
`43YI3MYtTfX5Xzz6dRoRuT`, section "03 · Settings › Module") and it is built to it. Tests locate
by role and text, never by class.

## 2. The bounded folder — `features/subscription/`

Everything the feature is lives here; the app is a shell around it, and the ESLint boundary
keeps it that way so the feature can be lifted into its own app in Part 3 (the extraction recipe
is in `features/subscription/README.md`).

```
index.ts        THE public surface: SubscriptionIndex, SubscriptionLayout, ModuleSettingsPage, SUBSCRIPTION_BASE_PATH
api/            payerPortal.ts (the 15 /api/me routes, billing-frontend's function names) · moduleSettings.ts
                (getModulePage, postModuleAction over the 19 actions, startTrial, completeCheckout; the card
                and page-model types) · notice.ts
hooks/          useModulePage (the module page's state and its CTAs) · useSubscriptionsList (the list's)
lib/            paths.ts (the ONE place the mount point is spelled; PORTAL.*, modulesPath(id), moduleRoutes(id))
                · moduleState.ts (card flags → what the card shows) · flaskLinks.ts (the settings chrome's Flask URLs)
                · portalRows.ts (the list's cells, sections, ⋮ shapes, sort and search)
components/     the module page's pieces: SettingsTabs (billing-frontend's pills), PaymentFailedBanner,
                ManagedByNotice, ModuleCard, ModuleCta, ModuleCardGrid (the header is the shell's AppHeader);
                the list's: PortalHero, TransferRequestCard, SearchField, SubscriptionsTable, ModuleCellView,
                RowMenu, StartTrialDialog, ListStates
routes/         SubscriptionLayout (PortalChrome = billing-frontend's header + PortalTabs), ManageSubscriptions (+ Screen),
                ModuleSettingsPage (+ Screen)
__fixtures__/   modulePage.ts — the page model in each Figma state (A–F); subscriptions.ts — frame 04-A's 21 companies,
                the transfer request, and the list's A/B/F frames; shared by Vitest, Playwright and ?fixture=
__tests__/      apiClient (from the feature's side), paths, the re-export guard, moduleState, flaskLinks,
                useModulePage, ModuleSettingsScreen, portalRows, useSubscriptionsList, ManageSubscriptionsScreen
e2e/            02_module_settings.spec.ts, 03_manage_subscriptions.spec.ts (each page in a browser, API stubbed)
```

The three rules, enforced by `npm run lint` (eslint-plugin-boundaries) and `npm test`:
(1) the folder imports only itself, `@/lib/**`, `@/components/ui/**` and packages; (2) nothing
outside imports it except `app/subscription/**`, and only `index.ts`; (3) `app/subscription/**`
files are one-line re-exports. A fourth by convention: links inside the feature go through
`lib/paths.ts`, never a literal `/subscription/…`.

The portal pages live in the route group `app/subscription/(portal)/` so their tabbed layout
does not wrap `app/subscription/entities/[entityId]/modules`, which draws Flask's settings chrome
instead. The module page reads its parameters on the client (`useParams`, `useSearchParams`
under `Suspense`) because a page taking `params` could not be a one-line re-export.

## 3. Talking to the API

`lib/apiClient.ts` is the one way out: `Authorization: Bearer <cookie token>`; `X-Entity-Id`
**opt-in per call** — the portal (`/api/me/*`) is person-scoped and sends none, the module page
names its company, because the token may be the unscoped one when the page is reached from the
portal. Errors arrive as `ApiError(status, sentence)` from the API's `{"error": …}` body with
Flask's status codes — 402 card declined, 403 not allowed / no consent, 404 not yours, 409
already done — and screens branch on the status and show the sentence. A 401 sends the browser
back through Flask's re-handoff once (`lib/handoff.ts`); nothing retries or refreshes
(`docs/features/authentication.md`).

`api/payerPortal.ts` keeps billing-frontend's function names (`fetchPayerSubscriptions`,
`fetchSubscriberOptions`, `inviteAdminToEntity`, `initiateTransfer`, `respondToTransfer`,
`cancelTransfer`, `listIncomingTransfers`, `fetchPaymentMethods`, `startCardSetup`,
`confirmCardSetup`, `setDefaultPaymentMethod`, `fetchEntityPaymentMethod`,
`setEntityPaymentMethod`, `updatePaymentMethod`, `removePaymentMethod`, `fetchPayerInvoices`)
and its response types, so the portal screens port mechanically. `api/moduleSettings.ts`
exports the nineteen `MODULE_ACTIONS` the API pins in its `test_contract.py`.

## 4. The switch

`NEXT_PUBLIC_SUBSCRIPTION_ENABLED` — **on unless `0`** (the backends default to off; a dev
server with no env file must still reach the feature). Off, `proxy.ts` sends `/subscription/*`
and `/` to the static `/not-available` page, and the landing still stores the cookie. The
backends are the real guard (404 while dark); this keeps the doors out of sight. Deployed off at
the cutover with `minty-billing-api`, switched on at launch **after** the API (plan step 7 / 8b).

## 5. Card capture

Stripe Elements over a SetupIntent (`startCardSetup` → `confirmCardSetup`), the publishable key
from the API's answer — never from this app's env. `@stripe/react-stripe-js` / `@stripe/stripe-js`
are in `package.json`; the components arrive in step 4. The Elements iframe stays out of
Playwright (as in the sibling apps); the capture flow is unit-tested with Stripe stubbed.

## 6. Configuration

`lib/env.ts` — `NEXT_PUBLIC_BILLING_API_URL` (8004), `NEXT_PUBLIC_MINTY_URL` (5001, the
re-handoff and _Back to Minty_), `NEXT_PUBLIC_PAYMENTS_WEB_URL` (3000, the profile until Part 3),
`NEXT_PUBLIC_SUBSCRIPTION_ENABLED`. All inlined at build time. In the docker stack this is the
`minty-web` service on 3002.

## 7. Where it is tested

`features/subscription/__tests__/`: `apiClient.test.ts` (bearer, opt-in header, one redirect on
401, the error sentence with its status), `paths.test.ts`, `reexports.test.ts` (rules 2 and 3
from the source), `moduleState.test.ts` (every card state, the precedence, the day arithmetic),
`flaskLinks.test.ts`, `useModulePage.test.tsx` (load, error, start-trial, the Checkout return,
the seams, the fixture switch), `ModuleSettingsScreen.test.tsx` (each Figma frame rendered),
`portalRows.test.ts` (the list's cells, sections, the three ⋮ shapes, the orders, the search),
`useSubscriptionsList.test.tsx` (the pages walked, the transfers alongside, search/sort, Start
Trial asks then posts with `X-Entity-Id`, the seams, the fixture switch) and
`ManageSubscriptionsScreen.test.tsx` (frames 04-A/B/C/E/G and the menu).
`e2e/01_landing.spec.ts` (the handoff, the gates, dark → not-available; Flask's re-handoff
stubbed - the route exists in Minty now, the spec only asserts where the browser is sent); `features/subscription/e2e/02_module_settings.spec.ts`
and `03_manage_subscriptions.spec.ts` (each page in the real app, the API served from the
fixtures by `page.route` — the routers are 501 stubs until step 3; journeys over the live API
join them then). The landing spec stubs the API too (`stubBillingApi`): over the real API a
token for a user its database does not hold is a 401 that sends the browser out of the app. Still to come with the portal
port: the five journeys from `billing-frontend/e2e/03_payer_portal.spec.ts`.

## 8. What arrives when

| Step   | Lands here                                                                                                                                                                                                                                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4a     | **done 2026-09-21** — the module settings page from its Figma design (§9), over a stubbed API; the `(portal)` route group; Flask's `/entity/settings/payments/<id>` redirect for the Payment Settings tab                                                                         |
| 4b     | **the Manage Subscriptions list, done 2026-09-21** (§10) — the design's target of the module page's _Manage Subscription_                                                                                                                                                         |
| 4c     | the row's expanded state (the design's M-frames) and the confirm flows (section 06: cancel / reactivate / subscribe / activate / resume), the payment-method screen (08-K), _Change subscriber_ and incoming transfers (07), billing and invoices — each from its own Figma frame |
| 5      | Minty's `/handoff/minty-web` route exists — the e2e stub goes; billing-frontend's profile links point here                                                                                                                                                                        |
| 7      | deployed dark at the cutover; 8b switches it on after the API                                                                                                                                                                                                                     |
| Part 3 | login, dashboard, profile, settings join the hub; `@/lib` and `@/components/ui` become `@minty/shared`; the folder is liftable per its README                                                                                                                                     |

## 9. The module settings page

`/subscription/entities/{id}/modules` — Flask's `/entity/settings/module/<org_id>`, re-homed and
redrawn to the Figma design (section "03 · Settings › Module", six frames). What is on it:

- **The settings chrome is billing-frontend's** (decision 2026-09-21: "the settings design
  should be similar to the current billing frontend - the only difference is the module
  contents"). `components/ui/AppHeader` and `components/ui/NavMenu` are ports of its
  `components/layout/{Header,NavMenu}` (Inter through `next/font`, the `material-symbols`
  glyphs, the same classes): the way back (`‹ Payments` when `?from=bills`, else `‹ Dashboard`
  to Minty's `/entity/{id}`), "Settings", `corporate_fare` + the company, the viewer's initials
  (`viewer` on the page model) and the hamburger drawer - the company's abbreviation, _Select
  entity_, a Petty Cash section (Dashboard, Reports - into Minty through `/entity/{id}/enter`
  with the cookie token) and a Payment Request section (Payments), each only when that module is
  on, _Settings_ (this page), _Logout_ (Minty's `/logout`) and the cat. Below it, in the same
  1024px column, a sticky pill row with billing-frontend's `SettingsPills` classes — Users ·
  Entity & Integration · Petty Cash Settings · Payment Settings · **Module** —
  linking to Flask's pages (`lib/flaskLinks.ts`); Payment Settings goes through Flask's
  `GET /entity/settings/payments/<id>`, which mints the payments app's token and sends the
  browser on. A module's settings tab (and its drawer section) shows only when that module is on, as
  in billing-frontend and Flask - from the page model's `has_access` once it is here, from the
  token's `petty_cash_enabled` / `billing_enabled` claims until then (`lib/moduleClaims.ts`,
  billing-frontend's `getModuleClaims` ported; both default to on), so the pills never vanish
  while the page loads or when the API cannot answer. The initials badge is not a link yet (billing-frontend's opens its
  profile; the portal here is not built).
- **Two cards, six states** (`lib/moduleState.ts`, first match wins):

  | state          | card says                                | CTA                                      |
  | -------------- | ---------------------------------------- | ---------------------------------------- |
  | past_due       | Subscription Suspended + the page banner | Reactivate Subscription (outline) → seam |
  | pending_cancel | Cancellation pending · Ends in N days    | Resume Subscription (filled) → seam      |
  | trialing       | Trial · N days remaining                 | Manage Subscription (filled) → seam      |
  | active         | Currently Active                         | Manage Subscription → (link) → seam      |
  | trial_eligible | Get Started · 30 days trial available    | Start Free Trial (outline) → **posts**   |
  | expired        | Trial Expired                            | Activate Subscription (outline) → seam   |

  When both cards carry the same _Manage Subscription_ (frames B and C), it is drawn once,
  centred. A closing trial is still a trial: the access gate ends it, never the date. Days count
  calendar days (the `YYYY-MM-DD` of both sides), floored at zero.

- **Who may act.** `can_manage_modules` (admin AND the payer, or no payer yet) shows the CTAs;
  otherwise the cards render without them and a line names the payer, or says only admins can
  change modules.
- **Re-entry.** `?session_id=` (back from Stripe Checkout) posts `checkout-complete` once and is
  dropped from the URL before the page loads; `?checkout_error=` is shown and dropped.
- **The seams.** Every CTA but _Start Free Trial_ navigates to a page under the module page
  (`lib/paths.ts::moduleRoutes`: `/manage`, `/activate/{code}`, `/resume/{code}`,
  `/reactivate/{code}`, `/payment-method`) that the next steps build from their own Figma frames; until
  then a seam lands on the **Not built yet** page (`routes/NotBuiltYet.tsx`, the catch-all routes
  `app/subscription/entities/[entityId]/modules/[...flow]` and `app/subscription/(portal)/[...rest]`),
  which names the flow and offers the way back. The tests pin those URLs now.
- **Not on this page any more** (moved to the Manage Subscription flow by the design): the "Your
  subscription" panel, the next-payment-date card, the decision dialog and the lapsed-trial
  restart takeover Flask forced on every load.
- **From Flask.** Live, Minty's `/entity/settings/module/<id>` redirects here through
  `/landing` with the company's token (`MINTY_WEB_MODULE_PAGE`, on by default there), and a
  lapsed token goes back through Minty's `/handoff/minty-web` - both landed 2026-09-21. Until
  step 3 fills the API the page answers its 501 with "not served by the subscription service
  yet", and the API's dark 404 (`not_found`) with "the subscription service is switched off" -
  each with _Try again_.
- **Seeing it without the API.** `?fixture=A` … `F` serves the page model from
  `features/subscription/__fixtures__/modulePage.ts` in a dev build (`NODE_ENV !== "production"`,
  dynamic import — nothing of it ships). Playwright does not use it; it stubs with `page.route`
  so the same spec runs against a production build. The switch goes at step 5.
- **Illustrations.** `public/modules/{petty-cash,payment-request}.png`, exported from the Figma
  file; served unoptimized (two 5 KB PNGs; Next's optimizer hung on webp on a Windows dev box).

## 10. The Manage Subscriptions list

`/subscription` and `/subscription/subscriptions` — billing-frontend's `/profile/subscriptions`,
re-homed and redrawn to Figma section "04 · Manage Subscriptions — the payer portal" (frames
04-A … 04-H) and "04·M · Row menu open". The design's own notes fix its behaviour:

- **The list scrolls — there is no pager.** Every company the payer is responsible for sits in
  one list, newest first (`created_at` on the row, an addition for the step-3 API; absent, the
  API's order). The hook walks every page of `/api/me/subscriptions` (`per_page=100`) and
  reads the transfer requests alongside (`/api/me/subscriptions/transfers`; a failure there
  never takes the list down). Search (300 ms debounce, the same fields billing-frontend
  searched) and the sort arrows work on the loaded list: Entity name A→Z / Z→A, a module
  column by whichever date comes soonest; a third press clears the sort.
- **A cell per module** (`lib/portalRows.ts`): `not_subscribed` → the **Start Trial** pill;
  `trial_expired` / `ended` → "Trial Expired" over a **Subscribe** link; `trialing` → "Trial /
  N days remaining"; `active` → "Active"; `cancelled` → "Cancels 20 Aug"; `past_due` →
  "Suspended".
- **Two sections.** A company with _every_ module suspended sits under "Suspended
  Subscriptions", greyed; anything else — even one suspended module beside a trial still on
  offer — stays in the main list, as frame 04-A draws it.
- **The ⋮ menu** has three shapes (04·M's rule): _Request transfer_ on every company; _Cancel
  subscription_ when a module is ACTIVE (it unticks every active one); _Reactivate_ when any
  module is not ACTIVE (it ticks every one of them).
- **Start Trial from the list** (04-G/H): a confirmation card, then the company's `start-trial`
  action with `X-Entity-Id` (the `/api/me/*` surface is read-only), then the list reloads. A
  refusal is a toast and the card stays.
- **Seams** — everything else navigates to the screen that owns the flow, each still to be built
  from its own Figma frame: a row's chevron → the company's module page (the design's M-frames
  are the row expanded; until they arrive the module page is the truthful destination);
  _Subscribe_ → `moduleRoutes(id).activate(code)`; _Cancel subscription_ / _Reactivate_ →
  `moduleRoutes(id).cancelAll` / `.reactivateAll` (section 06's confirm modal); _Request
  transfer_ → `PORTAL.subscriber?entity=`; _Review and accept_ → `PORTAL.incoming?transfer=`
  (07-D); the payment-failed "here" → `PORTAL.billing` (08-K); "Back to the previous page" →
  `history.back()`.
- **The module page's _Manage Subscription_** lands here with `?entity=<id>`: that company's row
  is ringed and scrolled into view.
- **States** (04-B/C/D/E): nothing paid for (the sad cat, _Go to entity list_ → Minty's
  `/entity`); a search that matched nothing (the puzzled cat); skeleton rows while loading —
  "not a spinner, the table keeps its shape"; could not load with _Try again_ — "an empty table
  here would read as 'you pay for nothing', which is a worse lie than an error you can retry
  from". The API's 501 stub and its dark 404 read as sentences here too.
- **Chrome**: billing-frontend's header (`routes/PortalChrome.tsx` over `components/ui/AppHeader`)
  and the portal tabs, in the design's 1298px column; the icons and cats are exported from the
  Figma file into `public/portal/`.
- **Seeing it without the API**: `?fixture=A` (the full list + a transfer), `B` (empty), `F`
  (the suspended companies) — dev only, as the module page's.
