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
| Index             | `/subscription`                                   | **built** (§15): "Subscription & Billing" — the account at a glance (who is billed and when, how many companies pay, how many trials end soon, what needs attention), with _Manage Subscription_ leading to the list. Where Minty's own link lands | —                                                                                                                                             |
| Subscriptions     | `/subscription/subscriptions`                     | **built** (§10): every company the payer pays for in one scrolling list, a cell per module, search, the column sorts, the ⋮ menu, Start Trial from the list, the transfer-request cards, the payment-failed line — over a stubbed API | —                                                                                                                                             |
| Change subscriber | `/subscription/subscriptions/subscriber?entity=…` | **built** (§14): the admins the bill could move to, each with its own quote, the current payer tagged, an invitation for someone new, _Request transfer_ → "Transfer requested"; the request already waiting and its _Withdraw request_ — over the live routes | the outcome modals (accepted / declined / expired) once the API reports how an outgoing request ended                                        |
| Incoming          | `/subscription/subscriptions/incoming`            | **built** (§14): the requests offered to me — the company's modules as they are, what accepting charges today, the card it goes to (changeable among my saved cards), _Confirm Subscription Transfer_ landing on the list's row, _Decline_; "No requests waiting" — over the live routes | —                                                                                                                                             |
| Billing           | `/subscription/billing`                           | **built** (§15): the next bill, the saved cards with the default pinned first and its _Update card_ menu (promote / edit / remove), _+ Add payment method_, the invoices already paid — over the live routes | the billing company and its address (08-C: no route on the `/api/me` surface), the estimated amount of the next bill |
| Add / edit a card | `/subscription/billing/add`, `…/billing/edit?card=` | **built** (§15): Stripe's own card fields on a SetupIntent (08-Y), and the name and expiry of a saved card (08-D)                                                                                                                       | —                                                                                                                                             |
| Invoices          | `/subscription/invoices`                          | — (the billing page already lists the invoices already paid; this is section 09's own page)                                                                                                                                           | every invoice, newest first, filter by company, Stripe's hosted page, the billing-breakdown csv                                               |
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
index.ts        THE public surface: SubscriptionOverview, ManageSubscriptions, ModuleSettingsPage, BillingPage,
                AddCard, EditCard, TransferSubscription, SubscriptionRequests, NotBuiltYet, SubscriptionLayout,
                SUBSCRIPTION_BASE_PATH
api/            payerPortal.ts (the 15 /api/me routes, billing-frontend's function names) · moduleSettings.ts
                (getModulePage, postModuleAction over the 19 actions, startTrial, completeCheckout, and the six
                a confirmed change posts: cancelModule, renewModule, retryPayment, restartBilling, authorizeBilling,
                openPaymentMethodCapture; the card and page-model types) · moduleChanges.ts (applyChange: the
                open row's ticks → those actions, in an order that keeps a change whole) · notice.ts
hooks/          useModulePage (the module page's state and its CTAs) · useSubscriptionsList (the list's, the
                open row, a change applied and its result) · useEntitySummary (the open company's page model
                and card, the ticks pending on them) · useTransferSubscription (the payer's side of a handover:
                the pick, the request, the one waiting withdrawn) · useSubscriptionRequests (the recipient's:
                the requests offered, one under review with its cards and charge, the card picked, accept / decline)
                · useBillingPage (the billing page: the cards, who is billed, the invoices, and every card action)
                · useBillingOverview (the landing's figures) · useCardForm (useAddCard / useEditCard)
lib/            paths.ts (the ONE place the mount point is spelled; PORTAL.*, modulesPath(id), moduleRoutes(id))
                · moduleState.ts (card flags → what the card shows) · flaskLinks.ts (the settings chrome's Flask URLs)
                · portalRows.ts (the list's cells, sections, ⋮ shapes, sort and search) · subscriptionSummary.ts
                (the open row: ticks, chips, the panel's forecast) · changeModal.ts (what the confirmation asks)
                · changeResult.ts (where a change lands) · transfer.ts (both sides of a handover: minor-unit money,
                the paid-through day, who a request waits on, what each side is charged, inherited trials)
                · billing.ts (the billing screens: a card's name, chip and month, the default pinned first, the
                menu it offers, the expired line, who the bill goes to, the invoice table, the landing's figures)
components/     the module page's pieces: SettingsTabs (billing-frontend's pills), PaymentFailedBanner,
                ManagedByNotice, ModuleCard, ModuleCta, ModuleCardGrid (the header is the shell's AppHeader);
                the list's: PortalHero, TransferRequestCard, SearchField, SubscriptionsTable, ModuleCellView,
                RowMenu, ListStates, SubscriptionSummaryRow (the open row), ConfirmDialog (the modal shell),
                StartTrialDialog and ChangeDialog (the confirmations), InterruptedDialogs (PaymentFailedDialog /
                LeaveDialog - when it fails or gets interrupted), ChangeResultView (ChangeResultRow /
                ChangeResultPage - the result screens); the handover's: TransferSubscriptionPanels (SubscriberPicker /
                PendingRequestPanel / TransferRequested), SubscriptionRequestsPanels (NoRequests / RequestList /
                IncomingRequestReview / PaymentMethodPicker), TransferOutcomeDialog (how a handover ended);
                the billing area's: BillingPanels (NextBillingCard / ExpiredCardNotice / PaymentMethodsPanel with
                the card menu / NoCardPanel / InvoiceHistoryTable), CardDialogs (CardAddedDialog / RemoveCardDialog),
                CardCaptureForm (Stripe's own fields on a SetupIntent), BillingOverviewPanels (the landing's two cards)
routes/         SubscriptionLayout (PortalChrome = billing-frontend's header + PortalTabs), ManageSubscriptions (+ Screen),
                ModuleSettingsPage (+ Screen), TransferSubscription (+ Screen), SubscriptionRequests (+ Screen),
                SubscriptionOverview (+ Screen), BillingPage (+ Screen), CardPages (AddCard / EditCard) + CardScreens,
                NotBuiltYet
__fixtures__/   modulePage.ts — the page model in each Figma state (03's A–F, 05·A's M11 … N21a, 05·C's RU22 … RNX21a
                as before/asked/after), the nominated card; subscriptions.ts — frame 04-A's 21 companies, the
                transfer request, and the list's A/B/F frames; transfers.ts — 07's subscriber options (A, C with an
                offer waiting, BLOCKED), the requests offered (D, TRIAL, F) and the recipient's cards; billing.ts —
                08's wallets (B two cards, H none, I expired, J eight, N one just added) and the invoices; shared by
                Vitest, Playwright and ?fixture=
__tests__/      apiClient (from the feature's side), paths, the re-export guard, moduleState, flaskLinks,
                useModulePage, ModuleSettingsScreen, portalRows, useSubscriptionsList, ManageSubscriptionsScreen,
                subscriptionSummary, useEntitySummary, SubscriptionSummaryRow, changeModal, ChangeDialog,
                InterruptedDialogs, changeResult, ChangeResultView, transfer, useTransferSubscription,
                useSubscriptionRequests, TransferScreens, billing, useBillingPage, useCardForm, BillingScreens
e2e/            02_module_settings.spec.ts, 03_manage_subscriptions.spec.ts, 05_transfers.spec.ts,
                06_billing.spec.ts (each page in a browser, API stubbed), 04_live_api.spec.ts (over the live API)
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
`flaskLinks.test.ts`, `useModulePage.test.tsx` (load, error, a trial asked about then posted and
the way back out, the Checkout return, the seams, the fixture switch), `ModuleSettingsScreen.test.tsx` (each Figma frame rendered),
`portalRows.test.ts` (the list's cells, sections, the three ⋮ shapes, the orders, the search),
`useSubscriptionsList.test.tsx` (the pages walked, the transfers alongside, search/sort, Start
Trial asks then posts with `X-Entity-Id`, the seams, the fixture switch, a row open in place),
`ManageSubscriptionsScreen.test.tsx` (frames 04-A/B/C/E/G and the menu, the open row),
`subscriptionSummary.test.ts` (05·A's rules: each frame's ticks, plan and price, the
current/future split, the card, the footer; 05·B's pending ticks: V44/U44/V21/V31/V51/V61/NX21a,
the chips, the split they cause, a tick undone, the change to confirm; the cards from the list's
row), `useEntitySummary.test.tsx` (the two reads, the card call failing, retry, a tick pending
and dropped with the row, a page model that is not one, the list's cards while loading, the
calculating beat after a tick), `SubscriptionSummaryRow.test.tsx` (frames M44/M11/M21/M45/M61
rendered, the pending states V44/V21/NX21a, the calculating panel, the seams), `changeResult.test.ts` (05·C's rules:
which screen each change lands on, the generated frames' copy, the money line agreeing with the
panel's forecast), `ChangeResultView.test.tsx` (both layouts rendered), `changeModal.test.ts`
(section 06's rules: which of the seven modals a change asks with, the design's copy) and
`ChangeDialog.test.tsx` (the modals rendered, their tones and moods, Go back / Escape, nothing
while busy; 05·D's `menuCodes` / `ticksFor` and the modal each item lands on) and
`InterruptedDialogs.test.tsx` (06·B's two: the declined card named, the retry sentence only
where a retry is scheduled, Escape the safe way out), `transfer.test.ts` (section 07's rules:
minor units to money, the paid-through day and the responsibility sentence, who a request waits
on and since when, what a candidate or the recipient is charged, inherited trials, the expiry
chip), `useTransferSubscription.test.tsx` (the options read and refused for a company not the
payer's, a pick and its quote, the current payer unpickable, blockers disabling the request,
_Request transfer_ posting and landing on 07-B, an invitation sent and refused, the offer
waiting withdrawn — 07-K then read again — Cancel / Back to the row, the fixture switch),
`useSubscriptionRequests.test.tsx` (nothing waiting, one request reviewed at once with the
company's cards and the person's wallet, several to pick from and `?transfer=`, another card
picked and made the default, accept landing on the list's row transferred, a refused or
blocked accept, decline reading again, the fixture switch) and `TransferScreens.test.tsx`
(07-A/B/C/D/E/F and 07-K rendered from the fixtures), `billing.test.ts` (section 08's rules: a
card's name and month, the default pinned first whatever order the API sent, the chips, the
menu, Show more, the expired line only for the card being charged, who the bill goes to and
when the block turns amber, the invoice header, the landing's two figures and its update
lines), `useBillingPage.test.tsx` (the three reads and what survives one failing, Show more, a
card promoted from the answer, the default refused removal and another one removed, a refused
removal, the card that just arrived and making it the default, where Add and Edit go, the
fixture switch), `useCardForm.test.tsx` (one SetupIntent per visit, an unreadable wallet not
claiming a first card, a refused intent and its retry, where a saved card lands; the edit
screen's starting fields, the four-digit year it sends, the bad month it does not, a refused
save, a card the account does not hold) and `BillingScreens.test.tsx` (08-B/H/I/J rendered, the
menu's two shapes, 08-R, 08-N → 08-S, the edit and add screens, and 08-A). The list hook's tests also take a change
through its modal and apply it over the stubbed API - one action per module, the result row,
the cancellation page, Stripe's card form when there is no card, the bank declining (asked
again, tried again, or left pending), an action refused, Go back posting nothing - land Start
Trial on its result, take the ⋮'s Cancel subscription (from a closed row) and Reactivate (from
the open one) through the same modal, and ask before leaving the open row with ticks pending.
`e2e/01_landing.spec.ts` (the handoff, the gates, dark → not-available; Flask's re-handoff
stubbed - the route exists in Minty now, the spec only asserts where the browser is sent); `features/subscription/e2e/02_module_settings.spec.ts`
and `03_manage_subscriptions.spec.ts` (each page in the real app, the API served from the
fixtures by `page.route` - every Figma state, the seams, what a CTA sends, a tick pending on the
open row, its modal asking, a change confirmed and landing on its result row, a cancellation
landing on its page, leaving with a tick pending asked about, the bank declining asked about);
`06_billing.spec.ts` (the billing area over the stubbed routes: the landing and its way to the
list, the billing page's next bill, cards and invoices, a card promoted, the default refused
removal and another one removed, the empty and expired states, and the card that just arrived);
`05_transfers.spec.ts` (both sides of a handover over the stubbed routes: the payer picks and
sends - 07-A → 07-B - and withdraws the one waiting - 07-C → 07-K → 07-A; the recipient sees
nothing waiting - 07-F - and reviews, changes the card, accepts and lands on the list's
"Subscription Transfer Completed" row - 07-D → 07-E → 07-M; every POST's body checked);
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
| 4c     | **live-API journeys done 2026-09-22** (`04_live_api.spec.ts`); **the open row done 2026-09-22** (§11, Figma 05·A and 05·B - the ticks pend on the row until _Confirm Subscription Change_); **the change applied and its result screens done 2026-09-22** (§12, Figma 05·C); **the confirmation modals done 2026-09-22** (§13, Figma section 06 - the confirm button asks first); **the "Calculating…" beat and the ⋮'s items done 2026-09-22** (§11, Figma 05·B-C; §13, Figma 05·D); **the declined-payment and leave-without-saving modals done 2026-09-22** (§13, Figma 06·B); **both sides of a handover done 2026-09-22** (§14, Figma section 07 - _Request transfer_ and the incoming requests, over the live routes; the outcome modals wait for an outgoing-transfer read). **the billing area done 2026-09-23** (§15, Figma section 08 - the portal's landing, the billing page and its states, the card screens; `/subscription` is the landing now and the list is `/subscription/subscriptions`). Still to build, each from its own Figma frame: the invoices page (09), and the billing company's address (08-C) once the API can answer it |
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
  | trial_eligible | Get Started · 30 days trial available    | Start Free Trial (outline) → **asks, then posts** |
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

- **Starting a trial asks first** (2026-09-23). _Start Free Trial_ opens the same dialog the
  list asks with — `StartTrialDialog`, Figma 04-G — and only _Confirm_ posts `start-trial`;
  _Go back_, Escape and the backdrop post nothing. A refusal is a toast and the dialog stays
  open so it can be tried again. All three places a trial can be started (this page, the list's
  row, the open row's card) now ask the same way; nothing starts a trial on one press.
- **Confirming leaves for the list** (2026-09-23). The trial's news is told where the design
  tells it - Figma RV11, the company's row in Manage Subscriptions saying "Congratulations! /
  <Module> free trial has started — 30 days, free. / Nothing is being charged." - so _Confirm_
  posts and then pushes `moduleRoutes(id).started(code)` = `/subscription/subscriptions?entity=
  <id>&started=<code>` instead of refetching this page. The list rebuilds that row from the
  company's page model ALONE (`lib/changeResult.ts::startedTrialResult`, beside the handover's
  `transferredResult`), since it has no before-and-after of its own; it refuses to celebrate
  unless that module really is on trial and not since cancelled, so a link opened in another
  state simply shows the ordinary row. Starting a trial makes the person the company's payer,
  so the company is in the list to land on. A refusal never navigates.
- **The dialog is the design's, with the design's own styling fixed** (2026-09-23). The copy is
  Figma 04-G/04-H word for word - "You've activated free trial for <Module>." and "after trial
  period" without the article - by the user's decision, over the grammar. Its title lockup is a
  rule: "Start" and "Free Trial for" are always the first two lines (each `whitespace-nowrap`),
  the module's name takes the third and may wrap ("Payment Request" takes two lines, as the
  design draws it). Two things the design gets wrong are NOT reproduced: it pins "Entity" at a
  fixed offset, where a four-line title overlaps it by 4px (here the block follows the title
  row, so the gap is always 28px), and it lets Minty run 89px past the card's right edge.
  `02_module_settings.spec.ts` measures the lockup, the gap and the button row.
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

`/subscription/subscriptions` (reached from the landing's _Manage Subscription_, §15) — billing-frontend's `/profile/subscriptions`,
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
  module is not ACTIVE (it ticks every one of them). The two ticks open the row and ask with the
  modal for that change (§13, 05·D); _Request transfer_ opens the change-subscriber page (§14).
- **Start Trial from the list** (04-G/H): a confirmation card, then the company's `start-trial`
  action with `X-Entity-Id` (the `/api/me/*` surface is read-only), then the result row (§12). A
  refusal is a toast and the card stays.
- **A row's chevron opens it in place** — the Subscription Summary of §11 (Figma 05·A), one
  company at a time; the chevron on the open row closes it.
- **Where the rest goes** — _Request transfer_ → `PORTAL.subscriber?entity=` and _Review and
  accept_ → `PORTAL.incoming?transfer=`, both built (§14); the seams still to be built from
  their own Figma frames: _Subscribe_ → `moduleRoutes(id).activate(code)`; the payment-failed
  "here" → `PORTAL.billing`, the billing page (§15); "Back to the previous page" →
  `history.back()`.
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
  entity route): "Visa 4121" and _Change_ → `moduleRoutes(id).paymentMethod` (the per-company
  nomination screen, still to be built - the ACCOUNT's cards are the billing page, §15); the brand is
  the API's `brand_label`, a datum, not the design's Visa artwork. A 403 (not the payer) or a
  Stripe failure there simply leaves the column out.
- **The footer** (`components/RowFooter.tsx`, the same one under a result row): "Minty for
  <company> was originally created <created_at>. Your next subscription renewal date is <date>
  and each month after. Minty subscriptions auto-renew monthly until cancellation is initiated.
  There is a 1 month notice period required for your cancellation." Three parts, guarded
  SEPARATELY (2026-09-23): the created sentence needs `created_at`, the renewal sentence needs a
  date, and the two standing sentences are terms — they carry no date and read under every
  company. Hanging all three off the date made them vanish for any company whose only module was
  a trial, which is most of the design's own frames. The date is `panel.next_invoice.date`, or —
  since the API withholds that until a company has a billing cycle ("Absent while the entity has
  only trials") — the end of the soonest running, not-cancelled trial, which is the day billing
  would begin. Nothing started at all: no date, no sentence. Both facts come from
  `subscriptionSummary.ts::rowFooter`, derived once for the summary row and the result row.
- **Money** prints the API's way (`format_trimmed`): the summary's symbol, cents only when they
  mean something, a symbol that is letters spaced (`HKD 400`).
- **"Calculating…"** (section "05·B-C · Calculating… — one per destination, auto-advances after
  1.2s", `2370:2739`): where the panel goes, a white card says "Calculating...." over Minty at
  a desk with a calculator — while the row's page model loads (the cards are already drawn from
  what the list knows of the company, `pageFromList`; a trial reads unconfirmed until the page
  model answers, and the boxes wait for it) and for `CALCULATING_MS` = 1.2 s after every tick
  (the cards flip and take their chip at once; the panel and its confirm button follow). The
  design's beat, not a wait for anything.
- **Dev switch**: `?summary=M44` (any of `M11 M21 M22 M31 M44 M45 M51 M61 N21a`) serves the
  open row from `__fixtures__/modulePage.ts` outside production; the list fixture opens M44 unless
  named. A 05·B state is reached by pressing a box on it.
- **The ⋮ on the open row** is the list's `RowMenu` in the same three shapes (section "05·D ·
  Other options — the entity panel ⋮", `1795:3165`, K44/K45/K66): its items are ticks (§13).

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
  as it does from there. The bank declining (`retry-payment` `status: "failed"`, or a 402 from
  `restart-billing` / `renew` that is not "Choose a card …") asks with 06·B's "Payment could not
  be processed" (§13); any other refusal is a toast and the row is read again.
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
  _Start Trial_ (04-G) now lands too - and the module settings page's, which leaves for the
  list rather than refreshing itself (`?started=<code>` beside `?entity=`; see §9).
- **The line of money** under the row's lines is the panel's own arithmetic
  (`subscriptionSummary.ts` `forecast`, in a sentence): "Nothing is being charged." / "HK$400 a
  month." / "Nothing charged today · HK$400 a month when the trial ends." / "HK$280 a month now ·
  HK$400 when the trial ends." / "HK$400 until 20 Aug 2026, then HK$280 a month." — "until" being
  the day the removed module ends, the same day its line names.
- **Layouts** (`components/ChangeResultView.tsx`): the row (`ChangeResultRow` — the company's
  name and ⋮, the headline, the lines with the module names in their colours, the money, _Back to
  Manage Subscriptions_, Minty celebrating, the footer sentences; the other companies stay listed
  around it) and the page (`ChangeResultPage` — the banner retitled, one card with the ⋮, Minty
  with a heart). _Back to Manage Subscriptions_ **leaves for the portal's landing** (08-A,
  `/subscription`) — all 103 frames of 05·C carry `▶ Back to Manage Subscriptions → 08-A`, and so
  does 07-M, so every result screen ends the same way (2026-09-23; it used to clear the result in
  place). One handler serves all five kinds and both layouts, and the list unmounts, so nothing
  is reset and nothing is reloaded on the way out. Back into the list from there:
  _Manage Subscription_ on the landing, or the _Subscriptions_ tab. The illustrations are the design's (`public/portal/minty-celebrating.png`,
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
  The company block lives **inside the title's column** (2026-09-23): same left edge, same
  width, tucked into the last line's leading so it reads right below the title, one grey
  (`#737a87`) for both its lines as the design's single text node draws them, and a long name
  wraps inside that column instead of running under Minty. Only the sentences and the buttons
  take the card's full width.
  Its **button row is the design's** (2026-09-23, from 04-G / B-02): 66px tall, a 20px gap and
  39px to each card edge, the two sharing the row equally - wider than the card's 48px padding,
  so the row reaches back out by 9px a side. A single button (`hideBack`: a card already the
  default, a transfer outcome) stays centred at 169px. The confirming button carries a
  transparent border so the bordered one beside it cannot come out 2px wider.
- **The ⋮'s items are the same ticks** (section 05·D: "Cancel subscription … unticks every
  ACTIVE module. Reactivate … ticks every one of them. Each item lands on the confirm modal in
  06 for exactly that change"). `menuCodes(page, item)`: _Cancel subscription_ names every
  ACTIVE module (not one winding down); _Reactivate_ every module that is not ACTIVE and has a
  tick to give — a trial running or expired, a cancellation pending, a suspension; a module never
  started has no tick (its Start Free Trial button is on the row). From a closed row the hook
  reads the page model, opens the row, sets those ticks (`ticksFor`, `useEntitySummary`'s
  `setTicksFor`) and asks with the modal built from that page model (`changePrompt.page`, so a
  quick Confirm never waits for the row's own read); from the open row the loaded page model
  serves. _Go back_ leaves the ticks pending on the open row, as the design's "returns to 05·A".
  An item with nothing to change says so in a toast and leaves the row open. _Request transfer_
  opens the change-subscriber page (§14).
- **When it fails or gets interrupted** (section "06·B", `1670:2116`;
  `components/InterruptedDialogs.tsx` on the same shell): **A-05 "Payment could not be
  processed"** when the bank declines a charge — the nominated card as the panel names it
  ("Visa 4121"), "We'll automatically retry in a few days." only where a scheduled retry really
  follows (a suspension's outstanding invoice — the dunning retries), "If you've resolved the
  issue, feel free to try again. You can also use a different payment method to avoid
  interruption to your service.", then _Try again now_ (the same change applied again, from the
  page model it was read against) or _Done_ (the ticks stay pending on the row; Escape and the
  backdrop are Done). **A-11 "Leave without saving?"** when the open row has ticks pending and
  the person closes it, opens another company, goes back, or takes another company's ⋮ —
  "You have unsaved changes." / "Your changes will be lost if you leave this page.", _Discard
  changes_ (drops the ticks and goes) or _Go Back_ (stays; Escape and the backdrop stay); a
  reload or a closed tab gets the browser's own warning (`beforeunload`). **A-07 / A-08** (a
  transfer declined or expired) are two of `TransferOutcomeDialog`'s four kinds (§14) with
  nothing to open them yet: the API tells the payer by email and no read here reports it.
- **Readings**: "another 30 days" is the design's fixed figure, and the prorated rule's floor
  (access until the later of the period end and thirty days out) — the result screen names the
  exact day, so the API's `cancel-preview` is not called for the modal; a confirmed trial
  unticked (the NX frames, which section 06 does not draw) asks with the removal modals; the
  design's "SuperMinty" is the API's bundle name (`Super Minty`), as everywhere else; 05·D's
  "Reactivate … 30 days trial available … ticks every one of them" cannot tick a module never
  started (a trial is started, not ticked), so those are left to their button; A-05's "We'll
  automatically retry in a few days." is left out of a purchase's decline (nothing retries a
  purchase) and the design's "Disgard" reads "Discard".

## 14. Handing the subscription over — both sides

Figma section "07 · Transfer — handing the subscription over" (`1410:1737`). Built 2026-09-22
over step 3's live routes: the payer's side at `/subscription/subscriptions/subscriber?entity=`
(`routes/TransferSubscriptionScreen`, `hooks/useTransferSubscription`,
`components/TransferSubscriptionPanels`) and the recipient's at
`/subscription/subscriptions/incoming[?transfer=]` (`routes/SubscriptionRequestsScreen`,
`hooks/useSubscriptionRequests`, `components/SubscriptionRequestsPanels`); the rules both read
by are `lib/transfer.ts`, pure. The screen OFFERS the handover; nothing about the company
changes until the other person accepts — then Minty charges THEM for the days the current
payer's money does not cover, and the subscription moves.

- **07-A "Transfer Subscription"** (the ⋮'s _Request transfer_, or the module page's): the
  responsibility sentence — "Send request to take over the subscription. You are still
  responsible for <company> until the transfer is successfully completed. This subscription has
  been paid up until <date>. The new subscriber will begin incurring charges after this date."
  (the date is the first quote's `covers_from`; without a quote the sentence stops at
  "completed.") — then the picker: "SELECT NEW SUBSCRIBER FOR THIS ENTITY (Admin Role Only)", a
  radio per admin of the company (`/api/me/subscriptions/subscriber-options?entity=`), the
  current payer disabled and tagged _Current_, the pick's own charge under it ("They'll be
  charged HKD 88 for <from> to <to> — the days after the period you've paid for, up to
  their own billing date."; "This also sets their billing date." when the recipient has no
  anchor yet), the API's `blockers` in amber (they disable _Request transfer_), "Invite someone
  new" (an address, _Send invite_ → `invite-admin`; the answer or the refusal stays by the box),
  _Cancel_ / _Request transfer_ (`POST /transfer {entity, to_user}`) — beside Minty handing the
  papers to Lemon.
- **07-B "Transfer requested"**: "Request has been sent to <email>." and the responsibility
  sentence again, Lemon stamping the papers, _Back to Manage Subscription_ → the list with this
  company's row open (`?entity=`).
- **07-C, a request already waiting** (`pending_transfer`): the amber notice "A request is
  already waiting. Sent <date> to <name>. Nothing has changed and you are still the
  subscriber. Withdraw it if you want to ask somebody else.", the person with a _Pending_ tag,
  _Back_ / _Withdraw request_ (`POST /transfer/cancel`) beside Minty with a clock. Withdrawing
  asks nothing (there is nothing to lose) and tells with **07-K "Transfer request has been
  withdrawn"** — "You can send a new request to anyone anytime.", _Done_ — then reads the
  screen again, which is 07-A. After every write the screen is read again rather than patched:
  the server recomputes the quotes and blockers too.
- **07-F "Subscription requests"** — the only portal screen about companies the viewer does NOT
  pay for, and the one a person can arrive at with no subscriptions at all: "No requests
  waiting" / "When someone asks you to take over billing for their company, it'll appear here
  for you to accept or decline.", _Back to My Profile_ → the list. Several requests waiting are
  a list to pick from (`?transfer=` picks one); a single one is reviewed at once.
- **07-D "Transfer Subscription - Choose Modules"**, the request under review
  (`/api/me/subscriptions/transfers`): who asks and for which company, the company's two module
  cards drawn as the module page draws them (the page model read with that company's
  `X-Entity-Id`, the card the person's own default), the Subscription Summary panel with the
  plan and price (§11's builder), the card the charge goes to ("Visa 4121", _Change_), what
  accepting costs — "You'll be charged HK$88 today for <from> to <to>." with "That
  covers the days after the period Priya Chan has already paid for … renews on your usual
  billing date." — or "Nothing to pay today." when everything is still on a free trial (the
  trials that carry over are listed: "Petty Cash free trial carries over until <date>;
  HK$280 a month after that."), the API's blockers, "Subscription will be charged to your
  selected payment method from the date that transfer is completed.", _Confirm Subscription
  Transfer_ (`POST /transfer/respond {transfer, accept: true}`) and _Decline_ (`accept: false`,
  then the screen is read again). Accepting lands on the list with `?entity=<id>&transferred=1`.
- **07-E "Payment Methods"** (_Change_): the person's saved cards
  (`/api/me/billing/payment-methods`) as radios — "Visa ending in 4121 · Expire on 04/29" — _Add
  New Card_ (the billing page's add-card screen, §15) and _Confirm_, which makes the pick the default
  (`POST /payment-methods/default`) and returns to 07-D naming it.
- **07-M "Subscription Transfer Completed"**: the list's row for the company, in the result
  row's celebrate layout (§12): the headline, "You are now the owner of the <company>
  subscription and have full control of this Minty." with the company in teal, and how billing
  carries on; _Back to Manage Subscriptions_ leaves for the landing, as on every result screen. `useSubscriptionsList` reads
  `?transferred=1` and shows it once the row's page model is in (`transferredResult`), until the
  row is closed or the person moves on.
- **How it ended, told** — `components/TransferOutcomeDialog.tsx`, four kinds on the
  `ConfirmDialog` shell, each the company, one sentence and _Done_: `withdrawn` (07-K, the only
  one with a trigger today), `accepted` (07-L "Transfer has been successful"), `declined`
  (07-I / 06·B's A-07 "<Name> declined the transfer") and `expired` (A-08 "Transfer request has
  expired").
- **Seeing it without the API**: `?fixture=A` (the picker), `C` (a request waiting), `BLOCKED`
  on the payer's page; `?fixture=D` (one priced request), `TRIAL` (nothing to pay today), `F`
  (nothing waiting) on the recipient's — dev only, from `__fixtures__/transfers.ts`, the
  company's cards from the 05·A frame M24.
- **Readings** (the design's frames against the API's contract):
  - **The cards are drawn, not ticked.** 07-D's title says "Choose Modules" and its cards have
    hotspots to 07-E, but `transfer/respond` moves a company's billing whole — there is no
    per-module accept — so the cards show the modules as they come and the ticks are read-only.
  - **Decline exists.** The design draws no way to refuse a request; the API has one
    (`accept: false`) and a request the person cannot take (blockers) would otherwise sit
    forever, so _Decline_ sits under _Confirm Subscription Transfer_.
  - **Add New Card leaves this screen** for the billing page (§15, built since 2026-09-23); a
    card is added there, never here.
  - **07-B's hero** reads "Subscription & Billing" in the frame; the page keeps "Transfer
    Subscription" — it is the same page a moment later.
  - **The outcome modals have no trigger** but `withdrawn`. Accepted, declined and expired
    answer to something the OTHER person did or did not do; the API tells the payer by email
    and has no read for an outgoing request's end (`subscriber-options` reports only the one
    still pending). They are built and tested as kinds and wait for that read and the
    Subscription & Billing dashboard (08), where 06·B places A-07/A-08.
  - **Money is in minor units** on both transfer routes (8800 = HK$88.00), unlike the module
    page's cards — `formatMinor` is the one place it is converted.
  - **"to them"**: when the person a request waits on is no longer among the candidates (left
    the company, lost the admin role), the pending sentence names nobody rather than guessing.
  - **The charge is the recipient's**, always: the payer sees "They'll be charged …" against
    each candidate's OWN quote (anchors differ per payer), never a figure of their own.

## 15. Billing — the account, the cards and the invoices

Figma section "08 · Billing — details and payment methods" (`1410:1806`). Built 2026-09-23 over
step 3's live routes, as two pages and two screens: the portal's landing
(`routes/SubscriptionOverviewScreen`, `hooks/useBillingOverview`,
`components/BillingOverviewPanels`), the billing page (`routes/BillingPageScreen`,
`hooks/useBillingPage`, `components/BillingPanels` + `CardDialogs`), and the card screens
(`routes/CardScreens`, `hooks/useCardForm`, `components/CardCaptureForm`). The rules all three
read by are `lib/billing.ts`, pure.

- **08-A "Subscription & Billing"**, at `/subscription` — where Minty's own link lands
  (Flask's `next` defaults to it). "Back to the entity dashboard" above — which goes to **the
  company this browser is scoped to**, not Minty's entity picker (2026-09-23):
  `lib/mintyEntry.ts::mintyModulesUrl` builds `/entity/{id}/enter?token=…&next=/entity/{id}/modules`,
  so the person arrives with their Flask session re-established and Minty's `module_selector`
  routes them — one module enabled goes straight in (Petty Cash's dashboard, or the payments
  app), two offer the module selection. Minty decides, from `entity_function_map`; this app
  counts no modules. With no company in the cookie the link falls back to the entity list, which
  is a safety net rather than a second design: the only live way in here is a company's module
  settings page (`Minty/blueprints/entity/routes/settings.py:1287`), which is always scoped.
  Then the payment-method
  card (who the bill goes to, the next billing date, _Go to payment details and invoices_ →
  the billing page) and the Subscription Overview: **Active subscriptions** and **Trial ending**
  counted in COMPANIES (a company counts once however many modules it pays for, and a trial is
  not an active subscription — nothing is being charged for it yet), the update lines ("Company
  A Limited · **Petty Cash** trial ends in *3 days*", "Company C Limited · **Payment failed**",
  failures first, five printed and the rest counted), and _Manage Subscription_ → the list.
- **08-B, the billing page** at `/subscription/billing`: "Next billing" — **Bill to** (the payer
  and their email), **Next Bill Date** (the account's billing anchor) — then "Payment Methods"
  and "Invoice History". Amber with "Due Immediately" and a **Payment Failed** chip when any
  company on the account is past due (**08-K**); a red line over the list when the card being
  charged has already expired (**08-I**); "No card saved · Trials keep running without one…"
  when there are none (**08-H**).
- **The cards**: the default is pinned first and chipped `Default`, the rest `Saved`, an expired
  one `Expired` in red with its month in red too. Two are shown; "Show more (6)" opens all of
  them (**08-J**, whose note is the rule: "the default card stays pinned to the top and is the
  only one charged. An expired card is named as expired rather than quietly failing at
  renewal"). **"Update card" IS the menu** (the frames' hotspots): _Set as default_ (only on a
  card that is not, **08-W**; **08-X** is the default's shorter menu), _Edit_ → 08-D, _Delete_.
- **Removing** (`/payment-methods/remove`): the default card is refused by the page itself with
  **08-R** "Remove default card?" — "<Card> is currently your default payment method. Another
  card will need to be selected as the default payment method before this card can be removed.",
  one way out. Any other card is asked about first and then removed; a refusal from the server
  is shown as written (it knows what the card is still paying for).
- **08-Y, adding a card** at `/subscription/billing/add`: a SetupIntent
  (`/payment-methods/setup-intent`), Stripe's own `PaymentElement` and `AddressElement`, then
  `/payment-methods/confirm` — three trips in that order, and the last is not optional (for a
  first card it is what creates the customer). The number is typed into Stripe's iframe and
  never reaches this app; Stripe's own mandate line is suppressed inside the Element because it
  names the Stripe ACCOUNT, so the sentence under the form IS the disclosure and the two go
  together. Saving comes back to the billing page with `?added=<card>`, which draws **08-N**
  "New Card added Successfully · <Card> is added successfully. This card is not your default
  payment method." (_Set as default_ / _Done_) or **08-S** (…"is set as the default payment
  method.", _Done_) when it already is.
- **08-D, editing a card** at `/subscription/billing/edit?card=`: the number shown, masked and
  disabled, and only what Stripe lets a saved card change — the name on it and its expiry
  ("Only the name on the card and its expiry date can be changed. To use a different number, add
  a new card."). _Save changes_ is dead until something is different.
- **Invoice History**: Inv#, Amount (the currency named once in the header), Paid date, and
  Invoice PDF — Stripe's own hosted invoice page, a CAPABILITY URL opened in a new tab with
  `rel="noopener noreferrer"`, never logged or rewritten.
- **Seeing it without the API**: `?fixture=B` (two cards), `H` (none), `I` (the default expired),
  `J` (eight), `N` (one just added, with `?added=pm_master8842`) on the billing page; the
  landing takes the list's own `?fixture=A|B|F` — dev only, from `__fixtures__/billing.ts`.
- **Readings** (the design's frames against the API's contract):
  - **"Bill to" is the payer, not a billing company.** The frames show a company, an address and
    a billing email with _Change billing details_ → **08-C**. That record exists
    (`payer_billing_group.billing_company` / `billing_email`) but only on the ONBOARDING surface
    (`/api/onboarding/billing/accounts`); `/api/me` has no read or write for it. The block names
    the payer and their email instead, and 08-C is not built — the link is left out rather than
    pointing at nothing.
  - **No "Amount (estimated)".** The API has no payer-level forecast of the next invoice (prices
    are per company, on each company's module page), and money is not a figure to guess. The
    block shows the date alone. The figure needs `billing.next_amount` (or similar) on
    `/api/me/subscriptions`, computed where the money rules already live.
  - **A card expires in a month, not on a day.** The Expiry column reads "Sep 2026": Stripe
    gives month and year, and the frames' "14 Sep 2026" would be a day nobody can act on.
  - **A non-default card is asked about before it goes.** The design's _Delete_ returns straight
    to the list; removal is hard to undo, so it asks first. 08-R — the default card's refusal —
    is the design's own.
  - **"Billing Breakdown · Download csv" is section 09's** (the frames' hotspots say
    `Download csv → 09-D`, `Invoice PDF → 09-A`); the PDF link is built, the csv column waits.
  - **08-F / 08-G (A-12 / A-13, the payment-method picker)** are the picker already built for
    07-E — the same component, reached from the transfer review; nothing new was built for them.
  - **08-E is 08-Y as a modal**: the same Stripe form. It is built once, as the page, and its
    "New billing account" heading (the onboarding wording) reads "Add a payment method" here.
  - **The list moved.** 08-A is the landing the design draws ("Back to the entity dashboard"
    above it, _Manage Subscription_ → 04-A below), so `/subscription` is the overview now and
    the Manage Subscriptions list is `/subscription/subscriptions`. Flask's handoff default
    (`next=/subscription`) needs no change.
  - **Stripe's fields stay out of Playwright** (an iframe from js.stripe.com): the add screen is
    checked as a screen, with the publishable key withheld, and the capture flow is unit-tested
    with Stripe stubbed — the same rule the sibling apps keep.
