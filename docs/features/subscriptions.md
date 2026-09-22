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
                (getModulePage, postModuleAction over the 19 actions, startTrial, completeCheckout, and the six
                a confirmed change posts: cancelModule, renewModule, retryPayment, restartBilling, authorizeBilling,
                openPaymentMethodCapture; the card and page-model types) · moduleChanges.ts (applyChange: the
                open row's ticks → those actions, in an order that keeps a change whole) · notice.ts
hooks/          useModulePage (the module page's state and its CTAs) · useSubscriptionsList (the list's, the
                open row, a change applied and its result) · useEntitySummary (the open company's page model
                and card, the ticks pending on them)
lib/            paths.ts (the ONE place the mount point is spelled; PORTAL.*, modulesPath(id), moduleRoutes(id))
                · moduleState.ts (card flags → what the card shows) · flaskLinks.ts (the settings chrome's Flask URLs)
                · portalRows.ts (the list's cells, sections, ⋮ shapes, sort and search) · subscriptionSummary.ts
                (the open row: ticks, chips, the panel's forecast) · changeModal.ts (what the confirmation asks)
                · changeResult.ts (where a change lands)
components/     the module page's pieces: SettingsTabs (billing-frontend's pills), PaymentFailedBanner,
                ManagedByNotice, ModuleCard, ModuleCta, ModuleCardGrid (the header is the shell's AppHeader);
                the list's: PortalHero, TransferRequestCard, SearchField, SubscriptionsTable, ModuleCellView,
                RowMenu, ListStates, SubscriptionSummaryRow (the open row), ConfirmDialog (the modal shell),
                StartTrialDialog and ChangeDialog (the confirmations), ChangeResultView (ChangeResultRow /
                ChangeResultPage - the result screens)
routes/         SubscriptionLayout (PortalChrome = billing-frontend's header + PortalTabs), ManageSubscriptions (+ Screen),
                ModuleSettingsPage (+ Screen)
__fixtures__/   modulePage.ts — the page model in each Figma state (03's A–F, 05·A's M11 … N21a, 05·C's RU22 … RNX21a
                as before/asked/after), the nominated card; subscriptions.ts — frame 04-A's 21 companies, the
                transfer request, and the list's A/B/F frames; shared by Vitest, Playwright and ?fixture=
__tests__/      apiClient (from the feature's side), paths, the re-export guard, moduleState, flaskLinks,
                useModulePage, ModuleSettingsScreen, portalRows, useSubscriptionsList, ManageSubscriptionsScreen,
                subscriptionSummary, useEntitySummary, SubscriptionSummaryRow, changeModal, ChangeDialog,
                changeResult, ChangeResultView
e2e/            02_module_settings.spec.ts, 03_manage_subscriptions.spec.ts (each page in a browser, API stubbed),
                04_live_api.spec.ts (both pages over the live API)
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
Trial asks then posts with `X-Entity-Id`, the seams, the fixture switch, a row open in place),
`ManageSubscriptionsScreen.test.tsx` (frames 04-A/B/C/E/G and the menu, the open row),
`subscriptionSummary.test.ts` (05·A's rules: each frame's ticks, plan and price, the
current/future split, the card, the footer; 05·B's pending ticks: V44/U44/V21/V31/V51/V61/NX21a,
the chips, the split they cause, a tick undone, the change to confirm), `useEntitySummary.test.tsx`
(the two reads, the card call failing, retry, a tick pending and dropped with the row, a page
model that is not one), `SubscriptionSummaryRow.test.tsx` (frames M44/M11/M21/M45/M61
rendered, the pending states V44/V21/NX21a, the seams), `changeResult.test.ts` (05·C's rules:
which screen each change lands on, the generated frames' copy, the money line agreeing with the
panel's forecast), `ChangeResultView.test.tsx` (both layouts rendered), `changeModal.test.ts`
(section 06's rules: which of the seven modals a change asks with, the design's copy) and
`ChangeDialog.test.tsx` (the modals rendered, their tones and moods, Go back / Escape, nothing
while busy). The list hook's tests also take a change through its modal and apply it over the
stubbed API - one action per module, the result row, the cancellation page, Stripe's card form
when there is no card, a declined card, an action refused, Go back posting nothing - and land
Start Trial on its result.
`e2e/01_landing.spec.ts` (the handoff, the gates, dark → not-available; Flask's re-handoff
stubbed - the route exists in Minty now, the spec only asserts where the browser is sent); `features/subscription/e2e/02_module_settings.spec.ts`
and `03_manage_subscriptions.spec.ts` (each page in the real app, the API served from the
fixtures by `page.route` - every Figma state, the seams, what a CTA sends, a tick pending on the
open row, its modal asking, a change confirmed and landing on its result row, a cancellation
landing on its page);
`04_live_api.spec.ts` (step 3's API for real, no stubs: the module page's real cards, a
card-free trial started from the page and read back as `trialing` with Flask's gate open, the
list showing the company - against the seed's `E2E Subscription Shop`, which
`Minty/scripts/e2e_seed.py` resets to "never held anything" on every run). The landing spec
stubs the API too (`stubBillingApi`): over the real API a token for a user its database does
not hold is a 401 that sends the browser out of the app. Still to come with the portal port: the
five journeys from `billing-frontend/e2e/03_payer_portal.spec.ts`. The fixtures' `TODAY` is the
real calendar day (UTC 03:00), not a pinned one: a `page.route` stub reaches a page that counts
from the browser's clock, so a pinned day drifted by one every midnight.

## 8. What arrives when

| Step   | Lands here                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4a     | **done 2026-09-21** — the module settings page from its Figma design (§9), over a stubbed API; the `(portal)` route group; Flask's `/entity/settings/payments/<id>` redirect for the Payment Settings tab                                                                                                                                                                                                   |
| 4b     | **the Manage Subscriptions list, done 2026-09-21** (§10) — the design's target of the module page's _Manage Subscription_                                                                                                                                                                                                                                                                                   |
| 4c     | **live-API journeys done 2026-09-22** (`04_live_api.spec.ts`); **the open row done 2026-09-22** (§11, Figma 05·A and 05·B - the ticks pend on the row until _Confirm Subscription Change_); **the change applied and its result screens done 2026-09-22** (§12, Figma 05·C); **the confirmation modals done 2026-09-22** (§13, Figma section 06 - the confirm button asks first). Still to build, each from its own Figma frame: the K-frames (the open row's ⋮), the payment-method screen (08-K), _Change subscriber_ and incoming transfers (07), billing and invoices |
| 5      | Minty's `/handoff/minty-web` route exists — the e2e stub goes; billing-frontend's profile links point here                                                                                                                                                                                                                                                                                                  |
| 7      | deployed dark at the cutover; 8b switches it on after the API                                                                                                                                                                                                                                                                                                                                               |
| Part 3 | login, dashboard, profile, settings join the hub; `@/lib` and `@/components/ui` become `@minty/shared`; the folder is liftable per its README                                                                                                                                                                                                                                                               |

## 9. The module settings page

`/subscription/entities/{id}/modules` — Flask's `/entity/settings/module/<org_id>`, re-homed and
redrawn to the Figma design (section "03 · Settings › Module", six frames). What is on it:

- **The settings chrome is billing-frontend's** (decision 2026-09-21: "the settings design
  should be similar to the current billing frontend - the only difference is the module
  contents"). `components/ui/AppHeader` and `components/ui/NavMenu` are ports of its
  `components/layout/{Header,NavMenu}` (Inter through `next/font`, the `material-symbols`
  glyphs, the same classes): the way back (`‹ Payments` when `?from=bills`, else `‹ Reports`
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
  | trialing       | Trial · N days remaining (red, ≤ 7 days) / Trial Active · N days remaining (black) | Manage Subscription (filled) → seam |
  | active         | Currently Active                         | Manage Subscription → (link) → seam      |
  | trial_eligible | Get Started · 30 days trial available    | Start Free Trial (outline) → **posts**   |
  | expired        | Trial Expired                            | Activate Subscription (outline) → seam   |

  When both cards carry the same _Manage Subscription_ (frames B and C), it is drawn once,
  centred. A closing trial is still a trial: the access gate ends it, never the date. Days count
  calendar days (the `YYYY-MM-DD` of both sides), floored at zero.

- **Card looks.** Frame 03-A (node `1410:2611`) was redesigned on 2026-09-22: its cards are
  the tall 300×504 and draw each CTA _inside_ the card as a 248×66, radius-24 button (filled
  teal, or white with a 1 px teal border); `pageLook` in `lib/moduleState.ts` picks that look
  only when the page's states are exactly {trialing, trial_eligible}. Every other frame keeps
  the original 50 px buttons under the cards (and the shared one for B/C), and its cards end
  under the status line (a fixed 402 px; equal on a page because the description and status blocks
  are fixed boxes) until it is redesigned - then each is one more `pageLook` case. Every
  button is the same 248×66 shape (03-A, 03-B's shared _Manage Subscription_, 03-D's
  _Activate_); only its position differs. A trial is red only with seven days or fewer left
  (`TRIAL_URGENT_DAYS`), otherwise "Trial Active" in black.

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
- **Copy.** Name and description are the catalogue's (`entity_function`, through the page
  model) verbatim; the description box is a fixed 102 px so the status line sits at the same
  height on both cards, and a newline in the copy is honoured. The design's copy (Petty Cash
  breaks after "expenses,") was written to the local catalogue on 2026-09-22 and is a
  cutover-day UPDATE in Minty's runbook (`modernisation_plan.md`, Part 2 step 7, item 5) -
  the data pipeline restores the 2026-06 seed's wording otherwise.

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
- **A row's chevron opens it in place** — the Subscription Summary of §11 (Figma 05·A), one
  company at a time; the chevron on the open row closes it.
- **Seams** — everything else navigates to the screen that owns the flow, each still to be built
  from its own Figma frame: _Subscribe_ → `moduleRoutes(id).activate(code)`; _Cancel
  subscription_ / _Reactivate_ → `moduleRoutes(id).cancelAll` / `.reactivateAll` (section 06's
  confirm modal); _Request transfer_ → `PORTAL.subscriber?entity=`; _Review and accept_ →
  `PORTAL.incoming?transfer=` (07-D); the payment-failed "here" → `PORTAL.billing` (08-K); "Back
  to the previous page" → `history.back()`.
- **The module page's _Manage Subscription_** lands here with `?entity=<id>`: that company's row
  opens (§11) and is scrolled into view — the design's target of that CTA is exactly this.
- **States** (04-B/C/D/E): nothing paid for (the sad cat, _Go to entity list_ → Minty's
  `/entity`); a search that matched nothing (the puzzled cat); skeleton rows while loading —
  "not a spinner, the table keeps its shape"; could not load with _Try again_ — "an empty table
  here would read as 'you pay for nothing', which is a worse lie than an error you can retry
  from". The API's 501 stub and its dark 404 read as sentences here too.
- **Chrome**: billing-frontend's header (`routes/PortalChrome.tsx` over `components/ui/AppHeader`)
  and the portal tabs, in the design's 1298px column; the icons and cats are exported from the
  Figma file into `public/portal/`.
- **Seeing it without the API**: `?fixture=A` (the full list + a transfer), `B` (empty), `F`
  (the suspended companies) — dev only, as the module page's; with a list fixture the open row
  is served from a 05·A frame too, `?summary=M11 … N21a` (M44 unless named).

## 11. The open row — "Subscription Summary" and a change pending

Figma section "05·A · Subscription Summary — all 36 module-status combinations" (`1521:1292`;
36 M-frames, down = Petty Cash status, across = Payment Request status, and 12 N-frames for a
confirmed trial) draws the list with one row grown into a card: the company's name and ⋮, its
two module cards with a checkbox or a **Start Free Trial** button under each, a summary panel,
and two footer sentences. Section "05·B · Subscription to be updated as — every tick / untick"
(`1529:1424`; 108 frames: U = both boxes pressed, V = Petty Cash's only, W = Payment Request's
only, NX = a confirmed trial unticked) draws every one of those rows after a press. Built
2026-09-22 in `components/SubscriptionSummaryRow.tsx` over `hooks/useEntitySummary.ts` (the
company's page model `GET /api/entities/{id}/modules` and its nominated card
`GET /api/me/billing/entity-payment-method?entity=`, fetched when the row opens; the pending
ticks, kept beside that answer) and `lib/subscriptionSummary.ts`, the pure view where the
design's rules live (`buildSummaryView(page, entity, wallet, today, pending)`, `toggleTick`):

- **The cards** reuse the module page's vocabulary (`lib/moduleState.ts`): "Get Started / 30
  days trial available" with the illustration dimmed, "Trial / N days remaining", "Trial
  Expired", "Active", "Cancellation pending / Ends in N days", "Subscription Suspended". Only a
  **ticked** card carries the teal fill, border and glow.
- **The tick** is the state: ACTIVE (not winding down) → ticked, a press means _cancel_; a
  running trial → unticked, a press _confirms_ it (the N-frames: once confirmed — a card and this
  company's consent, `needs_card` false — it is ticked and a press means cancel); trial expired →
  unticked, _subscribe_; cancellation pending → unticked, _resume_; suspended → unticked,
  _reactivate_; never started → the **Start Free Trial** button (04-G's dialog, then the
  company's `start-trial`).
- **A press is a change pending, not a request** (05·B). The box flips in place, the card takes
  the live fill if it is now ticked (a confirmed trial unticked loses it), and a chip under its
  status names the change: **Adding** (a trial or an expired trial ticked), **Restoring**
  (cancellation pending or suspended ticked), **Removing** (an active module unticked); a
  confirmed trial unticked shows none (the NX-frames: the trial simply stops). The panel takes
  the changing form at once — Current (what bills now, "Until <the earliest period end that
  changes>") and Future ("From <the day after>": the modules ticked after the change — "Petty
  Cash only", the bundle when both survive, "No modules selected") — and a teal **Confirm
  Subscription Change** button appears under it. A second press undoes the change; closing the
  row, opening another company or reloading drops every pending tick. The confirm button
  **asks first** (§13) and, confirmed there, **applies** the change (§12). Two readings off the
  frames: a module with no period
  running (expired, suspended) changes today, so its row names no "Until"/"From" date — the
  frames repeat one template date on all 108, which cannot be that module's; and the Future card
  is not drawn when nothing bills now and nothing will (a confirmed trial unticked): the Current
  block says it all.
- **The panel.** "Billable" = ACTIVE or CANCELLATION_PENDING. The bundle (`summary.bundle_name`,
  the API's `Super Minty`, at `summary.bundle_amount`) applies only when BOTH are billable; a
  trial is not billable, so the price is HK$0 while a trial is all that is alive ("Petty Cash
  (Free Trial)"), and the amount box is greyed when nothing is charged. Nothing changing → one
  block ("Selected plan", the price, "No pending changes"). Something changing at the period end
  — a cancellation pending, a trial that will convert — → "Current Subscription / Until <period
  end>" (each module tagged "(Active)", "(Cancellation in progress)" or "(Free Trial)"; the
  singles' sum struck through where the bundle price applies; "No additional charges will apply
  during the trial period." under a trial's HK$0) and a white "Future Subscription / From <the
  day after>" card (the survivors — "Petty Cash only", the bundle, or "No modules selected").
- **The payment method** shows when a card is nominated for the company (`nominated_id` on the
  entity route): "Visa 4121" and _Change_ → `moduleRoutes(id).paymentMethod` (08-K); the brand is
  the API's `brand_label`, a datum, not the design's Visa artwork. A 403 (not the payer) or a
  Stripe failure there simply leaves the column out.
- **The footer**: "Minty for <company> was originally created <created_at>." and "Your next
  subscription renewal date is <panel.next_invoice.date> and each month after. …" — the second
  only when something bills.
- **Money** prints the API's way (`format_trimmed`): the summary's symbol, cents only when they
  mean something, a symbol that is letters spaced (`HKD 400`).
- **Dev switch**: `?summary=M44` (any of `M11 M21 M22 M31 M44 M45 M51 M61 N21a`) serves the
  open row from `__fixtures__/modulePage.ts` outside production; the list fixture opens M44 unless
  named. A 05·B state is reached by pressing a box on it.
- **Not in this slice**: the ⋮ on the open row is the list's `RowMenu` (the K-frames are not in
  hand).

## 12. Where a change lands — the result screens

Figma section "05·C · After Confirm — the result screens" (`1626:2031`): six base screens and
108 generated ones (RU/RV/RW + the 05·B frame they follow), "where every Confirm Subscription
button in 05·B lands". Built 2026-09-22.

- **Applying the change** (`api/moduleChanges.ts` `applyChange`, once the modal of §13 is
  confirmed): one API action per module
  changed, from the card's state — an active module (or a confirmed trial) unticked → `cancel`;
  a cancellation pending, ticked → `renew`; a running trial, ticked → `authorize-billing` (this
  company's consent; consent is per company, so every trial it runs converts); a suspended
  module, ticked → `retry-payment` (the outstanding invoice, now); an expired trial, ticked →
  `restart-billing` (**this charges** the nominated card). The calls that can never leave the app
  go first (cancel, renew, consent), the ones that may hand the browser to Stripe last: a trial
  confirmed with no card at all, or a 402 from `restart-billing`, opens Stripe's card form
  (`payment-method` → `lib/handoff.ts` `leaveTo`), and the browser comes back to the module page
  as it does from there. A declined card (`retry-payment` `ok: false`) or a refused action is
  said in a toast and the row is read again.
- **Which screen** depends on what the change did, read off the company's page model before and
  after (`lib/changeResult.ts` `buildChangeResult`; the lines come from the difference, not from
  the ticks asked for): nothing left billing after a removal → the **subscription cancellation
  page** ("Thank you for being part of Minty", the company, access until the end of the current
  period; the banner reads "Cancellation Scheduled"); a module removed while another paid one
  keeps running (winding down counts) → the **module cancellation page** ("<Module> Cancellation
  Confirmed", "We've received your cancellation request for …", "You'll still have access until
  <date>. Your other module will remain active…", "Changed your mind? You can reactivate …
  anytime!"; the banner reads "Module Cancellation Scheduled"); a removal and an addition in one
  change → **"Subscription updated"** in the row ("<Module> is scheduled to end on <date>.",
  "<Module> is available now."); anything added, confirmed, restored or started →
  **"Congratulations!"** in the row — "<Module> is confirmed. Billing starts the day its trial
  ends." / "<Module> is active. Your card has been charged." / "<Module> is restored and billing
  carries on as before." / "<Module> free trial has started — 30 days, free." — where the list's
  _Start Trial_ (04-G) now lands too.
- **The line of money** under the row's lines is the panel's own arithmetic
  (`subscriptionSummary.ts` `forecast`, in a sentence): "Nothing is being charged." / "HK$400 a
  month." / "Nothing charged today · HK$400 a month when the trial ends." / "HK$280 a month now ·
  HK$400 when the trial ends." / "HK$400 until 20 Aug 2026, then HK$280 a month." — "until" being
  the day the removed module ends, the same day its line names.
- **Layouts** (`components/ChangeResultView.tsx`): the row (`ChangeResultRow` — the company's
  name and ⋮, the headline, the lines with the module names in their colours, the money, _Back to
  Manage Subscriptions_, Minty celebrating, the footer sentences; the other companies stay listed
  around it) and the page (`ChangeResultPage` — the banner retitled, one card with the ⋮, Minty
  with a heart). _Back to Manage Subscriptions_ drops the result, closes the row and reloads the
  list. The illustrations are the design's (`public/portal/minty-celebrating.png`,
  `minty-heart.png`, cropped and shrunk).
- **Readings and gaps, for the design**: the base frame 05·C-4 ("Subscription Update
  Confirmed", a full page) is not what the generated grid draws for a mixed change (RU24 and
  its kin use the in-row "Subscription updated"), so the grid is followed; the grid has no
  result for a confirmed trial unticked (the NX-frames) — it lands on the cancellation pages
  (the trial's end as the date); the 05·C-1 base frame's "module has been activated" reads
  "is active. Your card has been charged." in every generated frame, so that is the line; the
  design's headline is spelled "Congragulations!" in the base frames and "Congratulations!" in
  the generated ones — the latter is used.
- **Dev switch**: `?result=RU22` (any of `RU22 RU23 RU24 RV14 RV44 RV45 RW45 RV41 RV51 RV61
  RNX21a`) lands the open row (`?entity=`, `?fixture=A`) on that frame outside production.

## 13. The confirmation — what the modal asks

Figma section "06 · Confirm modals — every button that costs money asks first, and names the
module" (`1410:1588`; two template frames from the admin design and 108 generated ones, PU/PV/PW
+ the 05·B frame each follows, "directly across from the pending screen that opens it"). Built
2026-09-22: `lib/changeModal.ts` (`buildChangeModal(page, codes)`, pure) reduces the grid to
seven shapes read off the ticks, `components/ConfirmDialog.tsx` is the shell (the 04-G dialog's,
now shared with `StartTrialDialog` - the design's B-02) and `components/ChangeDialog.tsx` draws
them; `useSubscriptionsList` holds the prompt (`changePrompt`, `dismissChangePrompt`,
`applyChangePrompt`) between the button and `applyChange`.

- **Which modal**: a removal beside an addition → **Subscription Changes** (C-01: "<Removed>
  will be **removed**. You'll continue to have access for another 30 days. <Added> will be
  **added**. You'll have access immediately.", _Confirm Changes_ in orange, Minty surprised); a
  removal leaving nothing ticked → **Cancel Subscription?** (B-06: "No modules are selected." /
  "Your Minty subscription will be cancelled after 30 days.", _Confirm Cancellation_ in red,
  Minty sad — a module winding down is not ticked, so removing the other one asks this); a
  removal while the other module stays ticked → **Remove <Module>?** (B-05: "You've chosen to
  remove …. You'll still have access for another 30 days." / "Your other module will stay
  active, and your subscription fee will be updated accordingly.", _Confirm Change_ in orange);
  additions leaving both ticked → **You have unlocked <bundle>** (B-07: "You’ve activated both
  modules." / "Enjoy bundled pricing and access to all available modules.", the bundle's name
  in teal, Minty in a cape); one addition → **Activate <Module>** (B-01, a trial confirmed or an
  expired trial bought back: "You've chosen to activate ….") / **Continue <Module>** (B-04, a
  cancellation resumed: "… will remain in your subscription." / "Your scheduled cancellation
  will be removed.") / **Reactivating <Module>** (B-03, a suspension: "… will be reactivated." /
  "Your subscription billing will resume."), _Confirm_ in teal, Minty celebrating.
- **The shell**: the title with the module's name in its colour, "Entity" and the company,
  the sentences, _Go back_ and the confirming button in its tone; Escape and the backdrop go
  back; while the change is being applied nothing closes it. _Go back_ keeps the ticks pending.
- **Readings**: "another 30 days" is the design's fixed figure, and the prorated rule's floor
  (access until the later of the period end and thirty days out) — the result screen names the
  exact day, so the API's `cancel-preview` is not called for the modal; a confirmed trial
  unticked (the NX frames, which section 06 does not draw) asks with the removal modals; the
  design's "SuperMinty" is the API's bundle name (`Super Minty`), as everywhere else.
