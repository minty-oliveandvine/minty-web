# Subscriptions — the hub's first feature

The payer portal and a company's module settings page, over `minty-subscription-api` (:8000). This
page is the map of the feature as it stands (**Part 2 step 1: the shell, the bounded folder,
the typed API clients and a skeletal index; step 4a: the module settings page, built from its
Figma design over a stubbed API**) and of what the rest of step 4 fills in. The behaviour being
ported is described in `Minty/docs/features/modules-and-subscriptions.md` (the Flask module page)
and minty-payment-request-web's portal components; the API contract in
`minty-subscription-api/docs/features/subscriptions-api.md`.

## 1. What a person gets

Reached from Minty — the entity list's _Subscriptions_ link (an unscoped token, for the portal)
or a company's _Modules_ settings (a scoped token, for that company's page). Never a login here.

| Page              | Path                                              | Today                                                                                                                                                                                                                                 | Step 4                                                                                                                                        |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Index             | `/subscription`                                   | **built** (§15): "Subscription & Billing" — ONE billing account at a glance (its name as "Bill to", the payer's next billing date; clicking the card opens the billing-account sheet - which account, `?account=`, and _New billing account_ in place), the account's NAME moving a company between accounts (_Change billing account_), how many companies pay, how many trials end within 30 days, what needs attention (five lines, _Show more_ for the rest), and _Manage Subscription_ leading to the list. Where Minty's own link lands | —                                                                                                                                             |
| Subscriptions     | `/subscription/subscriptions`                     | **built** (§10): every company the payer pays for in one scrolling list, a cell per module, search, the column sorts, the ⋮ menu, Start Trial from the list, the transfer-request cards, the payment-failed line — over a stubbed API | —                                                                                                                                             |
| Change subscriber | `/subscription/subscriptions/subscriber?entity=…` | **built** (§14): the admins the bill could move to, each with its own quote, the current payer tagged, an invitation for someone new, _Request transfer_ → "Transfer requested"; the request already waiting and its _Withdraw request_ — over the live routes | the outcome modals (accepted / declined / expired) once the API reports how an outgoing request ended                                        |
| Incoming          | `/subscription/subscriptions/incoming`            | **built** (§14): the requests offered to me — the company's modules as they are, no money line (a handover takes nothing at accept), the BILLING ACCOUNT the bill will go to and the card it charges (changeable among my accounts, or a new one opened in place in the billing-account sheet), _Confirm Subscription Transfer_ (sending that account) landing on the list's row, _Decline_; "No requests waiting" — over the live routes | —                                                                                                                                             |
| Billing           | `/subscription/billing?account=`                  | **built** (§15): ONE billing account's profile — who it bills (name, address, email) and _Change billing details_, its next bill (the date, and the amount it will charge - estimated, "HKD 1,500"), its cards with the one it charges pinned first (two, then _Show more_) and its _Update card_ menu (charge this card / edit / remove), _+ Add payment method_ onto it, its invoices 10 / 50 / 100 to a page, each previewed from its Inv# (view-only, drawn by pdf.js), downloading as our own PDF (Figma 09-A) and its billing breakdown as a CSV — over the live routes | — |
| Add / edit a card | `/subscription/billing/add?account=`, `…/billing/edit?card=&account=` | **built** (§15): Stripe's own card fields on a SetupIntent (08-Y) - the card goes ON the account - and the name and expiry of a saved card (08-D) | —                                                                                                                                             |
| Billing details   | `/subscription/billing/details?account=`          | **built** (§15): 08-C — the account's billing company and email, and the address in Stripe's own form (the billing address and name of the card it charges) | —                                                                                                                                             |
| New billing account | — (a sheet, not a page)                           | **built** (§15): onboarding's `BillingSheet` over 08-A and 08-B - the list, then the form in place (a billing email and company, then the card - which OPENS the account), then "New Card added Successfully"; from the move's step 2 the company then moves onto it | —                                                                                                                                             |
| Module settings   | `/entity/{shortid}/{name}/settings/modules`                 | **built** (§9): the settings chrome, the two module cards in their six states, the payment-failed banner, _Start Free Trial_, the way back (no Stripe return: nothing leaves for Stripe) — over a stubbed API until step 3 | the pages the other CTAs lead to (Manage / Activate / Resume / Reactivate / payment method), each from its own Figma frame; the live API      |

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
                AddCard, EditCard, BillingDetails, TransferSubscription, SubscriptionRequests,
                SubscriptionLayout,
                SUBSCRIPTION_BASE_PATH
api/            payerPortal.ts (the /api/me routes - Flask's 15 plus transfer/seen and the four billing-account
                routes; minty-payment-request-web's function names) · moduleSettings.ts
                (getModulePage, postModuleAction over the 10 actions, startTrial, and the five a confirmed
                change posts: cancelModule, renewModule, retryPayment, restartBilling, authorizeBilling; the card
                and page-model types) · moduleChanges.ts (applyChange: the open row's ticks → those actions, in
                an order that keeps a change whole; `needsCard` when there is no card to charge)
hooks/          useModulePage (the module page's state and its CTAs) · useSubscriptionsList (the list's, the
                open row, a change applied and its result) · useEntitySummary (the open company's page model
                and card, the ticks pending on them) · useTransferSubscription (the payer's side of a handover:
                the pick, the request, the one waiting withdrawn) · useSubscriptionRequests (the recipient's:
                the requests offered, one under review with its cards, the billing account picked or opened in
                place, accept / decline)
                · useBillingPage (ONE billing account's page: who it bills, its cards, its invoices, every card action)
                · useBillingOverview (the landing: its figures and the updates' Show more, the account shown and
                the sheet, a company moved, an account opened) · useCardForm (useAddCard onto an account /
                useNewAccount - the sheet's form, reporting what it opened / useEditCard) · useBillingDetails (08-C)
lib/            paths.ts (the ONE place the mount point is spelled; PORTAL.*, modulesPath(id), moduleRoutes(id))
                · moduleState.ts (card flags → what the card shows)
                · portalRows.ts (the list's cells, sections, ⋮ shapes, sort and search) · subscriptionSummary.ts
                (the open row: ticks, chips, the panel's forecast) · changeModal.ts (what the confirmation asks)
                · changeResult.ts (where a change lands) · transfer.ts (both sides of a handover: minor-unit money,
                the paid-through day, who a request waits on, what each side is charged, inherited trials)
                · breakdown.ts (08-B's "Download csv": the invoice's breakdown written as the user's
                sample, and the file's name) · download.ts (the one DOM helper: hand the browser a file -
                an invoice's PDF, or the breakdown's CSV)
                · billing.ts (the billing screens: a card's name, chip and month, the default pinned first, the
                menu it offers, the expired line, the invoice table - which rows have a PDF, and the name it
                is saved under - the landing's figures) · billingAccounts.ts
                (which account a page shows, its Bill-to block and address lines, who may move where and why
                not, the new account's identity, 08-C's fields - what stops Save and what is sent)
components/     the module page's pieces: PaymentFailedBanner,
                ManagedByNotice, ModuleCard, ModuleCta, ModuleCardGrid (the header is the shell's AppHeader);
                the list's: PortalHero, PortalBack (the back line's header slot), TransferRequestCard, SearchField, SubscriptionsTable, ModuleCellView,
                RowMenu, ListStates, SubscriptionSummaryRow (the open row),
                StartTrialDialog and ChangeDialog (the confirmations), InterruptedDialogs (PaymentFailedDialog /
                LeaveDialog - when it fails or gets interrupted), ChangeResultView (ChangeResultRow /
                ChangeResultPage - the result screens); the handover's: TransferSubscriptionPanels (SubscriberPicker /
                PendingRequestPanel / TransferRequested), SubscriptionRequestsPanels (NoRequests / RequestList /
                IncomingRequestReview / TransferAccountPicker), TransferOutcomeDialog (how a handover ended);
                the billing area's: BillingPanels (NextBillingCard / ExpiredCardNotice / PaymentMethodsPanel with
                the card menu / NoCardPanel / NoAccountPanel / InvoiceHistoryTable), InvoicePreviewDialog (the Inv#'s
                view-only preview) over PdfPages (pdf.js drawing a PDF onto canvases), CardDialogs (CardAddedDialog /
                RemoveCardDialog), CardCaptureForm (Stripe's own fields on a SetupIntent - in the page's look or
                onboarding's 01-D - with the fields and the account a screen adds), BillingOverviewPanels
                (BillingAccountCard / SubscriptionOverviewCard), AccountSheet (onboarding's
                BillingSheet: the frame, the radio rows, the 01-D form, 01-J), BillingAccountDialogs
                (AccountTargetList - the account rows, each shut with its reason, shared with 07-E /
                AccountPickerDialog / MoveCompanyDialog / NewAccountDialog), BillingDetailsForm (08-C). Since
                phase 2 the shared pieces live in the shell, for the other features too:
                `components/ui/{ModalFrame, ConfirmDialog (the modal shell, with its ModalImage and
                ConfirmTone), sheetClasses, SettingsTabs, CompanyFromAddress}`, `lib/settingsTabs.ts`
                (the settings chrome's tabs and Back) and `lib/companyFromAddress.ts`
routes/         SubscriptionLayout (PortalChrome = minty-payment-request-web's header; no tab row), ManageSubscriptions (+ Screen),
                ModuleSettingsPage (+ Screen), TransferSubscription (+ Screen), SubscriptionRequests (+ Screen),
                SubscriptionOverview (+ Screen), BillingPage (+ Screen), CardPages (AddCard / EditCard) +
                CardScreens, BillingDetailsPage (+ Screen)
__fixtures__/   modulePage.ts — the page model in each Figma state (03's A–F, 05·A's M11 … N21a, 05·C's RU22 … RNX21a
                as before/asked/after), the nominated card; subscriptions.ts — frame 04-A's 21 companies, the
                transfer request, and the list's A/B/F frames; transfers.ts — 07's subscriber options (A, C with an
                offer waiting, BLOCKED), the requests offered (D, TRIAL, F) and the recipient's billing accounts
                (`RECIPIENT_ACCOUNTS`, `RECIPIENT_NO_ACCOUNTS`); billing.ts —
                08's wallets (B two cards, H none, I expired, J eight, N one just added), the billing accounts
                (Company A, Vine Consulting, one never named - each with its estimated next bill) and
                `accountsFor(wallet)`, an account opened in the sheet (`OPENED_ACCOUNT`, `ACCOUNTS_OPENED`), and
                the invoices (`invoicePage(rows, paging)`); shared by
                Vitest, Playwright and ?fixture=
__tests__/      apiClient (from the feature's side), paths, the re-export guard, moduleState,
                useModulePage, ModuleSettingsScreen, portalRows, useSubscriptionsList, ManageSubscriptionsScreen,
                subscriptionSummary, useEntitySummary, SubscriptionSummaryRow, changeModal, ChangeDialog,
                InterruptedDialogs, changeResult, ChangeResultView, transfer, useTransferSubscription,
                useSubscriptionRequests, TransferScreens, billing, billingAccounts, useBillingPage, useCardForm,
                useBillingDetails, payerPortalAccounts, CardCaptureForm, BillingScreens
e2e/            02_module_settings.spec.ts, 03_manage_subscriptions.spec.ts, 05_transfers.spec.ts,
                06_billing.spec.ts (each page in a browser, API stubbed), 04_live_api.spec.ts (over the live API)
```

The three rules, enforced by `npm run lint` (eslint-plugin-boundaries) and `npm test`:
(1) the folder imports only itself, `@/lib/**`, `@/components/ui/**` and packages; (2) nothing
outside imports it except `app/subscription/**`, and only `index.ts`; (3) `app/subscription/**`
files are one-line re-exports. A fourth by convention: links inside the feature go through
`lib/paths.ts`, never a literal `/subscription/…`.

The portal pages live in the route group `app/subscription/(portal)/`. The module page is
mounted outside the feature's folder since phase 2 - `app/entity/[ref]/[slug]/settings/modules`,
a company's settings tab (the ESLint element `app-subscription` and the re-export guard both
cover it); it draws the settings chrome instead of the portal's. The module page reads its parameters on the client (`useParams`, `useSearchParams`
under `Suspense`) because a page taking `params` could not be a one-line re-export.

## 3. Talking to the API

`lib/apiClient.ts` is the one way out: `Authorization: Bearer <cookie token>`; `X-Entity-Id`
**opt-in per call** — the portal (`/api/me/*`) is person-scoped and sends none, the module page
names its company, because the token may be the unscoped one when the page is reached from the
portal. Errors arrive as `ApiError(status, sentence)` from the API's `{"error": …}` body with
Flask's status codes — 402 card declined, 403 not allowed / no consent, 404 not yours, 409
already done — and screens branch on the status and show the sentence. A 401 sends the browser
back through Flask's re-handoff once (`lib/handoff.ts`); nothing retries or refreshes
(`docs/features/authentication.md`). Every route answers JSON but one: an invoice's PDF, read
with `apiFetchBlob` - the same bearer, 401 and `ApiError`, since its failures are JSON too.

`api/payerPortal.ts` keeps minty-payment-request-web's function names (`fetchPayerSubscriptions`,
`fetchSubscriberOptions`, `inviteAdminToEntity`, `initiateTransfer`, `respondToTransfer`,
`cancelTransfer`, `listIncomingTransfers`, `fetchPaymentMethods`, `startCardSetup`,
`confirmCardSetup`, `fetchEntityPaymentMethod`, `updatePaymentMethod`, `removePaymentMethod`,
`fetchPayerInvoices`) and its response types, so the portal screens port mechanically - plus what
minty-payment-request-web never had: `markTransferSeen`, and the billing accounts (`fetchBillingAccounts`,
`setAccountDefaultCard`, `updateBillingAccount`, `moveCompanyToAccount`; `confirmCardSetup` REQUIRES
onboarding's `BillingAccountChoice` - an account id, or a company AND an email to open one - and
refuses without one (`namesAnAccount`, 422 "Choose a billing account for this card.", the API's own
words) before anything is sent; `respondToTransfer` takes `{codes, billingGroupId}`;
`removePaymentMethod` and `fetchPayerInvoices` an account), and one invoice's own routes
(`fetchInvoiceBreakdown`, `retryInvoice`, `fetchInvoicePdf`). `setDefaultPaymentMethod` and
`setEntityPaymentMethod` are gone (2026-10-01): no card is promoted to a payer-wide default or
nominated for a company on its own any more - a company is billed to its billing account's card.
`api/moduleSettings.ts` exports the ten `MODULE_ACTIONS` the API pins in its `test_contract.py`.

**No Stripe-hosted page, anywhere (the user, 2026-10-01).** A payment method is only ever added
through a BILLING ACCOUNT, in the app: the billing-account sheet (`AccountSheet`, onboarding's
01-D - a card and the company and email it bills under), or 08-Y onto one account
(`?account=` - reached without one, it opens no SetupIntent and goes to the billing page). The
module actions that handed the browser to Stripe (`checkout`, `payment-method`, `manage-billing`,
`checkout-complete`, `confirm-billing`, `payment-methods*`) are gone from the API, and with them
the module page's `?session_id=` / `?checkout_error=` return.

## 4. No switch

Subscriptions are simply on. The dark switch - `NEXT_PUBLIC_SUBSCRIPTION_ENABLED`, `proxy.ts`
sending `/subscription/*` to a static `/not-available` page, the side menu and the profile
leaving out their ways in, and the hooks' "the subscription service is switched off" sentence
for the API's dark 404 - was removed on 2026-10-01, at the user's word: the app is deployed on a
test site, so there is no dark phase left to hide. A 404 from the API is now an ordinary error
on every screen (the API's own sentence, or the screen's house sentence where it has one).

## 5. Card capture

Stripe Elements over a SetupIntent (`startCardSetup` → `confirmCardSetup`), the publishable key
from the API's answer — never from this app's env. `@stripe/react-stripe-js` / `@stripe/stripe-js`
are in `package.json`; the components arrive in step 4. The Elements iframe stays out of
Playwright (as in the sibling apps); the capture flow is unit-tested with Stripe stubbed.

## 6. Configuration

`lib/env.ts` — `SUBSCRIPTION_API_URL` (8000), `PETTY_CASH_URL` (8010, the
re-handoff, the entity list's and the profile's reads, Petty Cash) and `PAYMENT_REQUEST_WEB_URL`
(3020, the payment-request app - the side menu's _Bills_, the profile's way back). All inlined at
build time (`next.config.ts` `env`). In the docker stack this is the `minty-web` service on 3000.

## 7. Where it is tested

`features/subscription/__tests__/`: `apiClient.test.ts` (bearer, opt-in header, one redirect on
401, the error sentence with its status - the same for a file, `apiFetchBlob`, and an answer
that is not a PDF refused), `paths.test.ts`, `reexports.test.ts` (rules 2 and 3
from the source), `moduleState.test.ts` (every card state, the precedence, the day arithmetic),
`useModulePage.test.tsx` (load, error, a trial asked about then posted and
the way back out, the seams, the fixture switch), `ModuleSettingsScreen.test.tsx` (each Figma frame rendered),
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
company's cards and the person's billing accounts - the oldest that can pay preselected, the
rest shut with why - several to pick from and `?transfer=`, another account picked with
nothing posted and sent as `billing_group_id` with the accept, a shut account never chosen,
_New billing account_ opening the sheet in place and the account it opens coming back picked,
Cancel back to the list, accept landing on the list's row transferred, a refused or blocked
accept, decline reading again, the fixture switch) and `TransferScreens.test.tsx`
(07-A/B/C/D/E/F and 07-K rendered from the fixtures; 07-E's account rows and the sheet over the
offer for someone with no account), `billing.test.ts` (section 08's rules: a
card's name and month, the default pinned first whatever order the API sent, the chips, the
menu, Show more, the expired line only for the card being charged, the payer-level fallback
printing the NEXT billing date and never the anchor, the invoice header and its 10 / 50 / 100
paging words, which rows have a PDF (`has_pdf`, an older API's silence read as none), the
landing's two figures - a trial counted when it ends within 30 days - and its
update lines, soonest first under the failures, five until Show more), `breakdown.test.ts`
(the breakdown CSV as the user's sample, line for line, and the file-name stem the invoice's
PDF shares), `billingAccounts.test.ts` (which account a page shows, the
Bill-to block and its address lines, who may move where and why not, the new account's
identity and its 255 limit, 08-C's fields: what stops Save, what Stripe's address form opens
on and which countries it offers, what is sent), `useBillingPage.test.tsx` (one
account's two reads and what survives the invoices failing, the account asked for / a company's
/ the oldest, Show more, the card the account charges switched from the answer, its own card
refused removal and another one removed and read again, a refused removal, the card that just
arrived on it and making it the one it charges, a payer with no account and the sheet that
opens one, the invoices read apart from the accounts - a page at a time, 10 / 50 / 100, never
re-reading the accounts - the estimated amount, where Add / Edit / Change billing details / Back
go, an invoice's PDF saved as `Inv-<reference>.pdf` and its breakdown as the CSV - one download
at a time whichever file, each refusal in the API's words - its Inv# preview: the PDF's bytes
for the dialog and nothing saved, a refusal in the API's words, a late answer dropped when
another row's preview opened or it was closed - the fixture switch, its PDF and preview
included), `useCardForm.test.tsx` (one SetupIntent
per visit, an unreadable wallet not claiming a first card, a refused intent and its retry, where
a saved card lands and the account it goes on, no account to put it on opening nothing and
leaving for the billing page; `useNewAccount`: nothing reaches Stripe without
a company and an email, what it reports to the sheet - the accounts read again or the move's
answer, the company moved or refused, the card 01-J names; the edit
screen's starting fields, the four-digit year it sends, the bad month it does not, a refused
save, a card the account does not hold), `useBillingDetails.test.tsx` (08-C, Stripe.js mocked:
the account named and nothing else, only what changed sent - the address whole and only once
Stripe has checked it, a new cardholder as the cardholder, the name alone without asking
Stripe - a blanked or 255-plus name stopped, the API's refusal kept, a card-less account's
address locked, no Stripe here and Stripe.js blocked), `payerPortalAccounts.test.ts` (what the account calls SEND:
the confirm's account fields as onboarding sends them - and a confirm with no account refused
before it is sent - a removal's account, the invoices'
account, the country list only when asked) and `BillingScreens.test.tsx` (08-B/H/I/J rendered,
the menu's two shapes, 08-R, 08-N → 08-S, 08-B's estimated amount and paging, its two downloads -
the PDF button busy and both downloads disabled meanwhile, "—" for a draft, a refusal's
sentence under the table - and the Inv#'s view-only preview: its dialog, "Preparing the
invoice…", the viewer handed the API's bytes (`PdfPages` stood in for - jsdom has no canvas),
no Download and nothing saved, Escape and the X closing it with the keyboard back on the Inv#,
a refusal's sentence inside it, a draft's Inv# plain text, the column still downloading - the edit, add and
08-C screens, and 08-A: the account's name and next date, the updates' Show more, the sheet
opened by the card (and by its own button for the keyboard), the name opening _Change billing
account_, the link not opening the sheet, _New billing account_ turning the same sheet into the
form - onboarding's two errors, Cancel back to the list, 01-J and Done landing on the new account
- the move's step 2 opening it and moving the company or saying it stayed, 08-B's empty state
opening straight on the form, a company moved in two steps and a refused move, the accounts
failing to load), and `CardCaptureForm.test.tsx` (Stripe mocked at its packages: the gate before
Stripe, the order - ours, Stripe's, confirmSetup, Minty, the caller - the confirm's body, the
intent remembered after our half failed, the busy signal, the two looks, no account refusing
Save before Stripe). The list hook's tests also take a change
through its modal and apply it over the stubbed API - one action per module, the result row,
the cancellation page, "Billing Accounts" asked AGAIN when there is no card to charge (a
cardless trial, `retry-payment`'s `no_card`, `restart-billing`'s 402 "Choose a card") with
nothing navigating and the ticks still pending, the bank declining (asked
again, tried again, or left pending), an action refused, Go back posting nothing - land Start
Trial on its result, take the ⋮'s Cancel subscription (from a closed row) and Reactivate (from
the open one) through the same modal, and ask before leaving the open row with ticks pending.
`e2e/01_landing.spec.ts` (the handoff, the cookie gate; Flask's re-handoff
stubbed - the route exists in Minty now, the spec only asserts where the browser is sent); `features/subscription/e2e/02_module_settings.spec.ts`
and `03_manage_subscriptions.spec.ts` (each page in the real app, the API served from the
fixtures by `page.route` - every Figma state, the seams, what a CTA sends, a tick pending on the
open row, its modal asking, a change confirmed and landing on its result row, a cancellation
landing on its page, leaving with a tick pending asked about, the bank declining asked about);
`06_billing.spec.ts` (the billing area over stateful stubbed routes: the landing and its way to
the list, the picker switching `?account=`, the link to that account's page, a company moved in
two steps, one account's next bill, cards and invoices - an invoice's PDF downloaded as
`Inv-<reference>.pdf`, and its breakdown as the CSV; its Inv#'s preview drawn by pdf.js onto a
real canvas, at an A4 page's true width, with no Download and no download event - the card it charges switched, its own
card refused removal and another one removed, the empty and expired states, the card that just
arrived, 08-C's name and email - 255 refused under the field, only what changed sent, the
address's note with Stripe's key withheld - the estimated amount and a page size of 50 read, and the
billing-account sheet - the list 481 wide, _New billing account_ turning it into the 880-wide
form in place, Cancel back, the X closing, 481 and no cat below 900px, the move's step 2
opening it);
`05_transfers.spec.ts` (both sides of a handover over the stubbed routes: the payer picks and
sends - 07-A → 07-B - and withdraws the one waiting - 07-C → 07-K → 07-A; the recipient sees
nothing waiting - 07-F - and reviews, changes the billing account, accepts and lands on the
list's "Subscription Transfer Completed" row - 07-D → 07-E → 07-M; every POST's body checked,
and no `payment-methods/*` call made);
`04_live_api.spec.ts` (step 3's API for real, no stubs: the module page's real cards, a
card-free trial started from the page and read back as `trialing` with Flask's gate open, the
landing and the billing page over the person's real billing accounts (read-only), the
list showing the company - against the seed's `E2E Subscription Shop`, which
`Minty/scripts/e2e_seed.py` resets to "never held anything" on every run). The landing spec
stubs the API too (`stubBillingApi`): over the real API a token for a user its database does
not hold is a 401 that sends the browser out of the app. Still to come with the portal port: the
five journeys from `minty-payment-request-web/e2e/03_payer_portal.spec.ts`. The fixtures' `TODAY` is the
real calendar day (UTC 03:00), not a pinned one: a `page.route` stub reaches a page that counts
from the browser's clock, so a pinned day drifted by one every midnight.

## 8. What arrives when

| Step   | Lands here                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4a     | **done 2026-09-21** — the module settings page from its Figma design (§9), over a stubbed API; the `(portal)` route group; Flask's `/entity/settings/payments/<id>` redirect for the Payment Settings tab                                                                                                                                                                                                   |
| 4b     | **the Manage Subscriptions list, done 2026-09-21** (§10) — the design's target of the module page's _Manage Subscription_                                                                                                                                                                                                                                                                                   |
| 4c     | **live-API journeys done 2026-09-22** (`04_live_api.spec.ts`); **the open row done 2026-09-22** (§11, Figma 05·A and 05·B - the ticks pend on the row until _Confirm Subscription Change_); **the change applied and its result screens done 2026-09-22** (§12, Figma 05·C); **the confirmation modals done 2026-09-22** (§13, Figma section 06 - the confirm button asks first); **the "Calculating…" beat and the ⋮'s items done 2026-09-22** (§11, Figma 05·B-C; §13, Figma 05·D); **the declined-payment and leave-without-saving modals done 2026-09-22** (§13, Figma 06·B); **both sides of a handover done 2026-09-22** (§14, Figma section 07 - _Request transfer_ and the incoming requests, over the live routes; the outcome modals wait for an outgoing-transfer read). **the billing area done 2026-09-23** (§15, Figma section 08 - the portal's landing, the billing page and its states, the card screens; `/subscription` is the landing now and the list is `/subscription/subscriptions`). **Billing accounts done 2026-09-25** (§15 - 08-A shows ONE account, picked by clicking its card; _Change billing account_ moves a company; 08-B is one account's profile; 08-C and the new-account form built; the landing's Next Billing Date no longer prints the anchor). **Same day, at the user's word:** _New billing account_ became onboarding's `BillingSheet` in place (the page went), the account's name took over _Change billing account_ (its button went, and the move's "Nothing is charged now…" note), "Trial ending" counts the trials ending within 30 days and the update lines list them with _Show more_, and 08-B gained the next bill's estimated amount (`next_bill`, priced by the API's renewal runner) and 10 / 50 / 100 invoice paging; one real Stripe test-mode account opened through the sheet on the dev database. **A standalone invoices page (09) was decided AGAINST, 2026-09-28** - the billing page's own invoice list already covers it (paging, each invoice's PDF, the billing-breakdown CSV), so `PORTAL.invoices`, the tab and the route's NotBuiltYet entry were all removed rather than left waiting to be built. **The Invoice PDF became our own document, 2026-09-29** (§15, Figma 09-A - downloaded from `GET /api/me/invoices/{id}/pdf`, where it had linked Stripe's hosted invoice page); **its Inv# previews it, 2026-09-30** (§15 - view-only at the user's word, drawn by pdf.js; the column is still the download) |
| 5      | Minty's `/handoff/minty-web` route exists — the e2e stub goes. (minty-payment-request-web's profile links go through Minty's `/profile` since 2026-09-29, which opens minty-web's profile; its old profile page is deleted here with the portal copies) |
| 7      | deployed to a test site with subscriptions on - no dark phase (the switch was removed 2026-10-01, §4)                                                                                                                                                                                                                                                                                                       |
| Part 3 | the entity list and My Profile **joined the hub 2026-09-29** (`entities.md`, `profile.md`); login, dashboard and settings follow; `@/lib` and `@/components/ui` become `@minty/shared`; each feature folder is liftable per its README |

## 9. The module settings page

`/entity/{shortid}/{name}/settings/modules` (until phase 2, 2026-10-05,
`/subscription/entities/{shortid}/{name}/modules` - proxy.ts 307s that and the older full-id form here) —
Flask's `/entity/<shortid>/<name>/settings/modules`, re-homed and
redrawn to the Figma design (section "03 · Settings › Module", six frames). Its browser tab reads
"Modules - <company>" (2026-10-05; `lib/companyTitle.ts`, as for the other settings tabs -
docs/features/company-settings.md). What is on it:

- **The settings chrome is minty-payment-request-web's** (decision 2026-09-21: "the settings design
  should be similar to the current billing frontend - the only difference is the module
  contents"). `components/ui/AppHeader` and `components/ui/NavMenu` are ports of its
  `components/layout/{Header,NavMenu}` (Inter through `next/font`, the `material-symbols`
  glyphs, the same classes - but for one fix of 2026-10-01: the company name's cap is a plain
  `max-w-[6.5rem]`, since `min(100%,6.5rem)` counts as no cap while the `shrink-0` block is sized
  and a long name covered the way back on a phone): "‹ Back" (to the page the person came from - `components/ui/BackLink.tsx`; for a new tab,
  Minty's `/entity/{id}`; the `?from=bills` "‹ Payments" went 2026-10-05), "Settings", `corporate_fare` + the company, the viewer's initials
  (`viewer` on the page model) and the side menu - since 2026-09-29 the Figma 02 design on every
  page (`entities.md`): the person (the way to My Profile), _Select Entity_, _Manage
  subscriptions_, a Petty Cash section (Dashboard, Reports - into Minty through
  `/entity/{id}/enter` with the cookie token) and a Payment Request section (Bills), each only
  when that module is on, the cat, _Settings_ (this page) and _Logout_ (Minty's `/logout`). Below it, in the same
  1024px column, a sticky pill row with minty-payment-request-web's `SettingsPills` classes — Users ·
  Entity & Integration · Petty Cash Settings · Payment Request Settings · **Modules** (the pills' labels since 2026-10-05; "Payment Settings" and "Module" before) —
  spelled by `lib/settingsTabs.ts` (shared with the other settings tabs); Payment Request Settings goes through Flask's
  `GET /entity/<id>/settings/payment-request` (Flask shows it by short id and name), which mints the payments app's token and sends the
  browser on. A module's settings tab (and its drawer section) shows only when that module is on, as
  in minty-payment-request-web and Flask - from the page model's `has_access` once it is here, from the
  token's `petty_cash_enabled` / `billing_enabled` claims until then (`lib/moduleClaims.ts`,
  minty-payment-request-web's `getModuleClaims` ported; both default to on), so the pills never vanish
  while the page loads or when the API cannot answer. The initials open My Profile in the
  sidebar over the page (`profile.md`; since 2026-09-29 - they were hover-only that morning).
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

- **Card looks = the onboarding card** (2026-10-02, the user: "make module settings the same as
  onboarding card design"). `ModuleCardShell` (`components/ModuleCard.tsx`) copies
  minty-onboarding-web's step-2 card (`.mp-*` in its `globals.css`): a 3 px frame, grey
  `#ececea` or, when the module is live, the teal gradient with its glow; a 300×360 card washed
  in the module's accent (Petty Cash `#f5b945`, Payment Request `#3aa6f5`, onboarding's
  `MODULES`); the illustration filling the top at 92 % width, never dimmed; the 26 px name;
  the status pinned 26 px off the bottom edge (grey, teal when live, a state's own colour on
  its value line); and the description over the whole card on hover. The Figma 03 looks it
  replaced are gone: the illustration tile, the in-card description box, and frame 03-A's
  CTA inside a tall 504 px card (`pageLook` was deleted). Every CTA now sits 34 px under its
  card, or once, centred, under the pair for B/C. Every button is the same 248×66 shape (03-A,
  03-B's shared _Manage Subscription_, 03-D's _Activate_). A trial is red only with seven days
  or fewer left (`TRIAL_URGENT_DAYS`), otherwise "Trial Active" in black.

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
- **No re-entry from Stripe** (2026-10-01). The page used to settle `?session_id=` (back from
  Stripe Checkout, posting `checkout-complete`) and `?checkout_error=`; nothing hands the browser
  to a Stripe-hosted page any more, so neither is read and the action is gone from the API.
- **Activate / Resume / Reactivate are not pages** (2026-09-23). Each is ONE module's pending
  change, which the open row already says, so the CTA lands on the list with that company's row
  open and that module **ticked**: `moduleRoutes(id).activate|resume|reactivate(code)` all build
  `/subscription/subscriptions?entity=<id>&tick=<code>`. The URL carries no verb — what the tick
  means is decided there by `tickOf`'s seam (`subscribe` / `resume` / `reactivate`). It **ticks
  and stops**: the chip shows and _Confirm Subscription Change_ appears, but nothing is posted
  and no modal opens, so the person reads the money first — which matters most for _Activate_,
  whose confirmation charges the card. The list seeds the tick once the row's page model is in
  (`useSubscriptionsList`, the same wait `?started=` makes; the ticks are keyed per company, so
  seeding early would be invisible and would burn the "Calculating…" beat), and `ticksFor`
  refuses a code the company does not have or one with no tick to give.
- **The "Payment failed" banner opens the billing account** (2026-09-29, the user: "it opens
  the Manage billing details and Payment Methods of the problematic billing account"). Frame
  03-F's "here" is `useModulePage.updatePaymentMethod` → `BILLING.account({ entity })` =
  `/subscription/billing?entity=<id>`, 08-B resolving "the account this company is on" (§15)
  — the same landing as the list's banner. The card that failed belongs to the company's
  billing account, not to the company, so there is no per-company screen behind this button.
- **The seams.** Every CTA but _Start Free Trial_ lands on Manage Subscriptions with this
  company's row open (`lib/paths.ts::moduleRoutes`: `manage`, and `activate` / `resume` /
  `reactivate` with that module ticked); there is no per-company payment-method page any more -
  the open row's _Change_ opens the "Billing Accounts" sheet in place (§13, 2026-09-29). **The
  "Not built yet" page is gone** (2026-09-29, the user: "can it be removed?"): its last entry,
  _Cancel subscription_ at `/modules/cancel`, had no link left to it since the ⋮'s items became
  ticks on 2026-09-23 (cancel is the open row's untick → 06's modal → 05·C), so the page, its
  two catch-all routes (`[...flow]`, `[...rest]`) and the `NotBuiltYet` export were deleted. A
  stray path under the portal is Next's own not-found now; `reexports.test.ts` pins that no
  catch-all route exists.
- **Not on this page any more** (moved to the Manage Subscription flow by the design): the "Your
  subscription" panel, the next-payment-date card, the decision dialog and the lapsed-trial
  restart takeover Flask forced on every load.
- **From Flask.** Minty's `/entity/<shortid>/<name>/settings/modules` is always a hand-over to this page
  (Flask's Jinja version was deleted on 2026-10-01): it redirects here through `/landing` with
  the company's token, and a lapsed token goes back through Minty's `/handoff/minty-web` - both
  landed 2026-09-21. The page answers the API's 501 stub with "not served by the subscription
  service yet" and any other failure (a 404 included) with the API's own sentence - each with
  _Try again_.
- **Seeing it without the API.** `?fixture=A` … `F` serves the page model from
  `features/subscription/__fixtures__/modulePage.ts` in a dev build (`NODE_ENV !== "production"`,
  dynamic import — nothing of it ships). Playwright does not use it; it stubs with `page.route`
  so the same spec runs against a production build. The switch goes at step 5.
- **Illustrations.** `public/modules/{petty-cash,payment-request}.png` are onboarding's own
  (`pettycash-icon.png` / `payment-icon.png`, 556×384, 24 KB and 89 KB); served unoptimized
  (Next's optimizer hung on webp on a Windows dev box).
- **Copy.** Name and description are the catalogue's (`entity_function`, through the page
  model) verbatim; the description shows on hover, over the card, and a newline in the copy
  is honoured. The design's copy (Petty Cash
  breaks after "expenses,") was written to the local catalogue on 2026-09-22 and is a
  cutover-day UPDATE in Minty's runbook (`modernisation_plan.md`, Part 2 step 7, item 5) -
  the data pipeline restores the 2026-06 seed's wording otherwise.

## 10. The Manage Subscriptions list

`/subscription/subscriptions` (reached from the landing's _Manage Subscription_, §15) — minty-payment-request-web's `/profile/subscriptions`,
re-homed and redrawn to Figma section "04 · Manage Subscriptions — the payer portal" (frames
04-A … 04-H) and "04·M · Row menu open". The design's own notes fix its behaviour:

- **The list scrolls — there is no pager.** Every company the payer is responsible for sits in
  one list, newest first (`created_at` on the row, an addition for the step-3 API; absent, the
  API's order). The hook walks every page of `/api/me/subscriptions` (`per_page=100`) and
  reads the transfer requests alongside (`/api/me/subscriptions/transfers`; a failure there
  never takes the list down). Search (300 ms debounce, the same fields minty-payment-request-web
  searched) and the sort arrows work on the loaded list: Entity name A→Z / Z→A, a module
  column by whichever date comes soonest; a third press clears the sort. **The search bar is
  sticky** (2026-09-29): it stops right under the sticky header (`top: var(--app-header-h)`,
  `app/globals.css`) on a white band the rows scroll beneath.
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
- **The whole row is that chevron's click target** (2026-09-23): the company's name, a module
  cell, the space between them. A row's own controls are not — the ⋮ and its menu (which render
  inline in the same `<li>`, not through a portal), a cell's _Start Trial_ / _Subscribe_, and the
  chevron itself do only their own job (`fromControl` in `SubscriptionSummaryRow.tsx` is the one
  guard both rows share). On an OPEN row only the header strip closes it, never the panel below —
  a click on a checkbox or a module card must not collapse the row. Pointer affordance only: the
  chevron keeps the accessible name and stays the sole focusable control, so "Open <Company>"
  still names exactly one element. Ticks pending: closing this way asks "Leave without saving?"
  like every other way out.
- **A row's chevron opens it in place** — the Subscription Summary of §11 (Figma 05·A), one
  company at a time; the chevron on the open row closes it.
- **The open row takes the view** (2026-10-02, the user: "should focus on the open row"). However
  it opened — its chevron, a click on the row, `?entity=` — `SubscriptionSummaryRow` scrolls
  itself to the top on mount (smooth unless reduced motion; `scroll-mt-[var(--list-sticky-top)]`,
  as `ChangeResultRow` does, so its header strip lands 24px under the sticky header AND the
  sticky search band - a bare `scroll-mt-6` hid the strip behind them) and puts keyboard focus on its _Close_ chevron, since the _Open_ one unmounted with the
  closed row. Focus is only taken back from the page itself, never from a dialog or field the
  list re-rendered behind.
- **Where the rest goes** — _Request transfer_ → `PORTAL.subscriber?entity=` and _Review and
  accept_ → `PORTAL.incoming?transfer=`, both built (§14); the seams still to be built from
  their own Figma frames: _Subscribe_ → `moduleRoutes(id).activate(code)`; the payment-failed
  "here" → `PORTAL.billing`, the billing page (§15); "Back to the previous page" →
  `history.back()`.
- **The module page's _Manage Subscription_** lands here with `?entity=<id>`: that company's row
  opens (§11) and is scrolled into view — the design's target of that CTA is exactly this.
- **States** (04-B/C/D/E): nothing paid for (the sad cat, _Go to entity list_ → the entity
  list, `/entities`); a search that matched nothing (the puzzled cat); skeleton rows while loading —
  "not a spinner, the table keeps its shape"; could not load with _Try again_ — "an empty table
  here would read as 'you pay for nothing', which is a worse lie than an error you can retry
  from". The API's 501 stub reads as a sentence here too; any other failure shows the API's own.
- **Chrome**: minty-payment-request-web's header (`routes/PortalChrome.tsx` over `components/ui/AppHeader`)
  over the design's 1298px column. **The header's left is the page's own back line** (2026-09-29,
  the user: no more chevron header): "‹ Entity List" and the "Subscriptions" title are gone, and
  _Back to the entity dashboard_ (08-A) / _Back to the previous page_ (04-A, 08-B) moved out of
  the page into the bar, starting exactly where the teal banner does. The layout owns an empty
  slot in the header (`PortalBackSlot`, `AppHeader`'s `lead`) and the page portals its line into
  it (`components/PortalBack.tsx`); the slot pads itself with `cqw` against the header row, so it
  must stay in step with `SubscriptionLayout`'s `max-w-[1346px]` and px-4 / sm:px-6. A page with
  no line of its own (details, add/edit card, transfers, requests, a result page) leaves the bar
  empty - each has its way out in its body. Measured in Chromium at 1920 / 1440 / 1100 / 390px:
  the line's left edge equals the banner's. **Every `AppHeader` is sticky** (`top-0 z-40`, the
  user, 2026-09-29): the portal scrolls the document, so without it the header left with the
  page; the entity list and the module page scroll their own `main` under it anyway. Its row has
  a fixed height (`h-16` / `sm:h-18`) so a bar sticking under it can use `--app-header-h`
  (`app/globals.css` - change the two together). the icons and cats are exported from the Figma file into
  `public/portal/`. **The tab row is gone** (2026-09-29, the user: "remove this navigation
  header"): the Overview / Manage Subscriptions / Billing tabs that sat above every portal page
  (`PortalTabs.tsx`, deleted with its test) duplicated what the pages already offer - 08-A's
  _Manage Subscription_ button and its account card, every result's _Back to Manage
  Subscriptions_, each page's back line - so the portal now navigates only through the
  design's own hotspots. `e2e/01_landing.spec.ts` pins the absence.
- **Seeing it without the API**: `?fixture=A` (the full list + a transfer), `B` (empty), `F`
  (the suspended companies) — dev only, as the module page's; with a list fixture the open row
  is served from a 05·A frame too, `?summary=M11 … N21a` (M44 unless named).
- **On a phone** (2026-10-05; the design has no phone frames): the four columns
  (`components/listGrid.ts`, shared by the rows, the column heads and the skeleton) need ~820px,
  so they start at `lg`. Below it a row puts the name and chevron/⋮ on its top line and each
  module cell on a full line of its own (smaller badge and Start Trial pill), and the column
  heads become one wrapping line of sort buttons, so sorting still works. Nothing may scroll
  sideways at 375px.

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

- **The cards** are the module page's card, onboarding's design (`ModuleCardShell`, §9 "Card
  looks"), with a reserved chip slot under the status, and they use the page's vocabulary
  (`lib/moduleState.ts`): "Get Started / 30 days trial available", "Trial / N days remaining",
  "Trial Expired", "Active", "Cancellation pending / Ends in N days", "Subscription
  Suspended". Only a **ticked** card carries the teal gradient frame and glow, as a picked card
  does in onboarding; a card with a tick to press lifts on hover.
- **The tick** is the state: ACTIVE (not winding down) → ticked, a press means _cancel_; a
  running trial → unticked, a press _confirms_ it (the N-frames: once confirmed — a card and this
  company's consent, `needs_card` false — it is ticked and a press means cancel); trial expired →
  unticked, _subscribe_; cancellation pending → unticked, _resume_; suspended → unticked,
  _reactivate_; never started → the **Start Free Trial** button (04-G's dialog, then the
  company's `start-trial`).
- **The whole card is that box's click target** (2026-09-23), not only the 34px box below it:
  `SummaryModuleCard` takes an `onToggle` and calls the same `onTick` the checkbox calls, so the
  two can never disagree. It is a pointer affordance only — the checkbox stays the one focusable
  control with the accessible name, so nothing is added to the tab order. A card with nothing to
  tick is inert: a module never started (its _Start Free Trial_ button is its own control), a row
  still loading, and the read-only card the transfer review draws all pass no handler.
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
  **A tag sits BESIDE its module's name**, on the name's baseline in small grey type — "Petty
  Cash (Free Trial)", "Payment Request only" (the user, 2026-09-28, reversing an earlier
  "under the name") — and wraps to the next line only when the column cannot hold both
  (`PlanLines`, one `data-plan-line` row per module). The transfer review's summary (07-D, §14)
  draws its own lines and keeps its tag row under them, by the user's call.
- **The payment method** shows when a card is nominated for the company (`nominated_id` on the
  entity route - its billing ACCOUNT's card): "Visa 4121" and _Change_ → the **"Billing
  Accounts" sheet as a move of this company alone** (2026-09-29, the user's call; the same
  sheet Confirm Subscription Change opens, §13): the account it is on reads "Billed here now"
  and cannot be picked, the rows the API would refuse are disabled with their reason, nothing is
  preselected; Confirm → `POST /billing/accounts/move` (nothing charged, nothing applied), the
  sheet closes, the row reads its card again - it is the account's - and a toast says where the
  company is billed now (`accountChangeChoice`, `useSubscriptionsList.changePaymentMethod`). The
  network's mark sits above that line, as the design draws it (2026-09-28, "the brand logo is
  missing above the card"): `components/CardBrand.tsx` with `fit="mark"` in `SUMMARY_MARK`
  (74 wide, as tall as the mark, at most 42), keyed on the card's `brand` (`visa`,
  `mastercard`, …) with the API's `brand_label` as its fallback. `mark` is the list rows'
  drawing with its card-shaped field cropped away, flush right, so it fills the design's logo
  slot (78×64, the logo 73×24) instead of sitting small in its middle: measured, VISA renders
  66×24 with the design's gaps (25 px under the label, 10 px over "Visa 4121"), and Mastercard
  63×42, as onboarding's 01-C draws its 68×42. No crop is narrower than a four-letter mark's,
  so a short one ("CB") is not drawn as tall as the circles. The handover summary (07-D) and
  onboarding's summary (`sub-pay-mark`, the same crops in its copy of the component) draw the
  same slot the same way. It is our wordmark, not the issuers' licensed artwork (see that
  file), and it is hidden from screen readers because the line under it already names the
  card. A 403 (not the payer) or a Stripe failure there simply leaves the column out.
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
- **On a phone** (2026-10-05): the panel needs 360px of its own, so the three columns start at
  `lg`. From `sm` the two cards sit side by side with the panel full-width below them; below
  `sm` everything stacks. Padding and the price shrink, the plan/payment-method line wraps, and
  the struck-out price moves into the corner so it clears the price. The confirmation modal
  (§13) stacks its two buttons at 560px or less, action on top, as the billing sheet does.
- **Dev switch**: `?summary=M44` (any of `M11 M21 M22 M24 M31 M44 M45 M51 M61 N21a`) serves the
  open row from `__fixtures__/modulePage.ts` outside production; the list fixture opens M44 unless
  named. A 05·B state is reached by pressing a box on it.
  - M24 draws a state the engine never produces: a trial beside a paid module is always
    confirmed, so the live twin is N24a.
  - Real data for 38 of the 48 frames is the replay catalogue ("Ang - M44 Nexora Health Limited"
    and the rest). See minty-subscription-api `docs/features/subscriptions-api.md` §8.
- **The ⋮ on the open row** is the list's `RowMenu` in the same three shapes (section "05·D ·
  Other options — the entity panel ⋮", `1795:3165`, K44/K45/K66): its items are ticks (§13).

## 12. Where a change lands — the result screens

Figma section "05·C · After Confirm — the result screens" (`1626:2031`): six base screens and
108 generated ones (RU/RV/RW + the 05·B frame they follow), "where every Confirm Subscription
button in 05·B lands". Built 2026-09-22.

- **Applying the change** (`api/moduleChanges.ts` `applyChange` - for a change that only
  cancels, once its modal of §13 is confirmed; for one that bills, once the company is on the
  billing account picked in "Billing Accounts" (§13), so every charge and consent below is that
  account's card; a trial is then confirmed on it, unless the account picked has no card it can
  charge (`cardChosen`)): one API action per module
  changed, from the card's state — an active module (or a confirmed trial) unticked → `cancel`;
  a cancellation pending, ticked → `renew`; a running trial, ticked → `authorize-billing` (this
  company's consent; consent is per company, so every trial it runs converts); a suspended
  module, ticked → `retry-payment` (the outstanding invoice, now); an expired trial, ticked →
  `restart-billing` (**this charges** the nominated card). The calls that cannot need a card go
  first (cancel, renew, consent), the ones that may find none, or a charge refused, last.
  **Nothing hands the browser to Stripe** (the user, 2026-10-01: "payment method should only go
  through billing account first. must be only attached to the billing account"): a trial
  confirmed with no card at all (`NO_CARD_FOR_TRIAL`), `retry-payment`'s `status: "no_card"`
  (its `message`), a 402 "Choose a card …" from `restart-billing`, or a 402 "Choose a billing
  account for this company." from `authorize-billing` (the API no longer falls back to the
  payer's Stripe default card for a company on no account; its sentence) answers
  `needsCard`, and `useSubscriptionsList` asks **"Billing Accounts" AGAIN** for the same change:
  the accounts read fresh, the sentence as the sheet's error, every account with no card shut
  ("No card" - even the one the company is on, which is otherwise always pickable;
  `nominationChoice(…, {needCard: true})`), the first that can pay preselected, and _New billing
  account_ the way to add a card - the account it opens is picked and the change carries on.
  Whatever asked (the sheet, 06·B's Try again) stays up, busy, until the sheet takes its place,
  and the summary is not read again in between, so the ticks stay pending. If the accounts
  cannot be read, a toast says both sentences. The bank declining (`retry-payment` `status: "failed"`, or a 402 from
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
  is reset and nothing is reloaded on the way out. It **lands UNSCOPED** (2026-09-29, the user:
  "Back to Manage Subscriptions button should reset the token to unscoped"): a token minted
  inside a company - the module settings page's, which its CTAs bring to the list - is traded
  for the payer's on the way, through Flask's `/handoff/minty-web?next=/subscription` with no
  `entity_id` (`lib/auth.ts::isEntityScoped`, `lib/handoff.ts::redirectToHandoff`; only Flask
  mints). A token already unscoped goes straight there. So 08-A after a result is the payer's:
  "Subscriptions" in the header (it read "My entities" until 2026-10-02), and its way out is Minty's entity list. Back into the list from
  there: _Manage Subscription_ on the landing. The illustrations are the design's (`public/portal/minty-celebrating.png`,
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
`applyChangePrompt`) between the button and `applyChange` for a change that cancels, and
`accountStep` / `confirmed` for one that bills (below).

The dialog family (`components/ui/ModalFrame`, `components/ui/ConfirmDialog`, `LeaveDialog`) is copied to minty-payment-request-web (under its `features/subscription/components/`) (its Payment Request Settings' "Leave without saving?", 2026-10-01) and ported to Flask (Minty `static/js/minty_dialog.js` + `static/css/minty_dialog.css`) - change all three.

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
- **Every change asks in its modal first; one that bills then asks which account pays**
  (2026-09-29, the user's calls, in order: "confirm should then ask for a billing account to
  nominate a payment method"; then for a while the sheet came first and the modal only once
  paid; then "Have to redo again the activate modal opens after confirm subscription change.
  then it will open billing account picker", with NO modal after the payment - the row's
  result is the news). _Confirm Subscription Change_ opens the change's section-06 modal
  ("You have unlocked Super Minty", "Continue …", "Reactivating …", "Activate …", "Subscription
  Changes", "Cancel Subscription?", "Remove …?"). For a change that bills anything - a trial
  confirmed, an expired trial bought back, a cancellation resumed, a suspension reactivated,
  and the ⋮'s _Reactivate_ (`moduleChanges.billsAnything`) - its Confirm opens **Billing
  Accounts** in its place (the modal stays up, busy, while the accounts are read; a failed read
  is a toast and the modal stays), 08-A's picker (`AccountPickerDialog`, onboarding's sheet),
  over the row: "Choose the account that pays for
  <company>.", the accounts as radio rows, _New billing account_, _Confirm_. Once paid, the row
  lands on its result, brought into view (`ChangeResultRow` scrolls itself there - the user: "i
  have to scroll down to find it"); a decline shows 06·B. A change that only CANCELS bills
  nothing: its modal's Confirm applies it, and no account is asked for. Preselected: the
  account the company is on, else the first that can take it. The rows the API would refuse are shown disabled with their reason
  (`lib/billingAccounts.ts` `nominationChoice`): another account whose collection is failing
  ("Payment failed") or with no card ("No card"), and - while the company itself is past due -
  every account but its own ("Settle payment first": its debt and its retries follow the
  account it is on). Its own account is always pickable, with its own flags. _Confirm_ puts the
  company on it (`POST /api/me/billing/accounts/move`, which since 2026-09-29 also PLACES a
  company on no account yet - a card-free trial) and only then applies the change; a refusal
  stays in the sheet in the API's words and nothing is applied. The sheet STAYS UP through the
  move and the payment (2026-09-29, the user: "no loading during confirm on billing account it
  just closes"): its Confirm reads "Confirming…" (onboarding's `BillingSheet` word), the rows,
  _New billing account_ and the X are shut, Escape and the backdrop do nothing, and it gives way
  only to the answer - the result once paid, 06·B on a decline, a toast when the change is
  refused. _New billing account_ turns the
  sheet into onboarding's form (01-D → 01-J); on Done the sheet returns to its list with the new
  account picked and the company goes on it the same way. Closing the sheet applies nothing and
  keeps the ticks pending. 06·B's "Payment could not be processed" then names the card of the
  account picked, and _Try again now_ does not ask again.
- **The ⋮'s items are the same ticks** (section 05·D: "Cancel subscription … unticks every
  ACTIVE module. Reactivate … ticks every one of them. Each item lands on the confirm modal in
  06 for exactly that change"). `menuCodes(page, item)`: _Cancel subscription_ names every
  ACTIVE module (not one winding down); _Reactivate_ every module that is not ACTIVE and has a
  tick to give — a trial running or expired, a cancellation pending, a suspension; a module never
  started has no tick (its Start Free Trial button is on the row). From a closed row the hook
  reads the page model, opens the row, sets those ticks (`ticksFor`, `useEntitySummary`'s
  `setTicksFor`) and asks exactly as that change's button would, from that page model
  (`changePrompt.page`, so a quick Confirm never waits for the row's own read): _Cancel
  subscription_ with its modal, _Reactivate_ with its modal and then (it bills) "Billing
  Accounts"; from the open row the loaded page model serves. _Go back_ leaves the ticks pending
  on the open row, as the design's "returns to 05·A".
  An item with nothing to change says so in a toast and leaves the row open. _Request transfer_
  opens the change-subscriber page (§14).
- **When it fails or gets interrupted** (section "06·B", `1670:2116`;
  `components/InterruptedDialogs.tsx` on the same shell): **A-05 "Payment could not be
  processed"** when the bank declines a charge — the nominated card as the panel names it
  ("Visa 4121"), "We'll automatically retry in a few days." only where a scheduled retry really
  follows (a suspension's outstanding invoice — the dunning retries), "If you've resolved the
  issue, feel free to try again. You can also use a different payment method to avoid
  interruption to your service.", then _Try again now_ (the same change applied again, from the
  page model it was read against; the dialog stays up, busy, until the retry answers, as the
  billing page's does) or _Done_ (the ticks stay pending on the row; Escape and the
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
  (the date is `paid_through` on the payload — a fact about the COMPANY, added 2026-09-24. It
  used to be read off the first candidate's `covers_from`, and quotes are priced per candidate
  and only when there is one: a company whose payer is its own only admin had none, so the
  sentence stopped at "completed." on exactly the screen that exists to say what the payer is
  still liable for. The quote scan remains as a fallback. The API answers it advisorily —
  unreadable billing leaves the sentence off rather than failing the screen. **And the payer
  portal writes its datetimes RFC 822** — `"Sun, 18 Oct 2026 12:00:00 GMT"`, not ISO — so
  `utcDay` reads both; reading only the ISO prefix dropped every date on these screens against
  the real API while the ISO fixtures kept the tests green) — then the picker: "SELECT NEW SUBSCRIBER FOR THIS ENTITY (Admin Role Only)", a
  radio per admin of the company (`/api/me/subscriptions/subscriber-options?entity=`), the
  current payer disabled and tagged _Current_ (the pick's own charge used to print under it —
  "They’ll be charged HKD 88 for <from> to <to> …" — removed 2026-09-24 by decision, along
  with `candidateCharge`; the recipient is still told what accepting costs them, on 07-D, the
  screen where that money is actually owed), the API's `blockers` in amber (they disable _Request transfer_), "Invite someone
  new" (an address, _Send invite_ → `invite-admin`; the answer or the refusal stays by the box),
  _Cancel_ / _Request transfer_ (`POST /transfer {entity, to_user}`) — beside Minty handing the
  papers to Lemon.
- **07-B "Transfer requested"**: "Request has been sent to <email>." and the responsibility
  sentence again, Lemon stamping the papers, _Back to Manage Subscription_ → the list with this
  company's row open (`?entity=`).
- **07-C, a request already waiting** (`pending_transfer`): the amber notice "A request is
  already waiting. Sent <date> to <name>. Nothing has changed and you are still the
  subscriber. Withdraw it if you want to ask somebody else.", the person with a _Pending_ tag,
  _Back_ / _Withdraw request_ (`POST /transfer/cancel`) beside Minty with a clock. The
  responsibility footer is deliberately NOT repeated here (asked for and dropped 2026-09-24):
  the amber notice above it already says "Nothing has changed and you are still the subscriber."
  Withdrawing
  asks nothing (there is nothing to lose) and tells with **07-K "Transfer request has been
  withdrawn"** — "You can send a new request to anyone anytime.", _Done_ — then reads the
  screen again, which is 07-A. After every write the screen is read again rather than patched:
  the server recomputes the quotes and blockers too.
- **07-F "Subscription requests"** — the only portal screen about companies the viewer does NOT
  pay for, and the one a person can arrive at with no subscriptions at all: "No requests
  waiting" / "When someone asks you to take over billing for their company, it'll appear here
  for you to accept or decline.", _Back to Manage Subscription_ → the list. Several requests waiting are
  a list to pick from (`?transfer=` picks one); a single one is reviewed at once.
- **07-D "Transfer Subscription - Choose Modules"**, the request under review
  (`/api/me/subscriptions/transfers`): who asks and for which company, the company's two module
  cards drawn as the module page draws them (the page model read with that company's
  `X-Entity-Id`; the card shown is the billing account's chosen on 07-E), the Subscription Summary
  panel with the plan and price (§11's builder), the **Billing account** column (renamed from
  "Payment method" 2026-10-01, the user: "rename in the app to use billing account"; the Figma
  frame still says Payment method) - the chosen account's name over its charged card (the
  network mark, the name, "Visa 4121"; "No billing account yet" before one is chosen), _Change_ —
  "Add a billing account" when there is no account that can pay, **no money line at all** (accepting
  takes nothing), the trials that carry over when there are any (the
  trials that carry over are listed: "Petty Cash free trial carries over until <date>;
  HK$280 a month after that."), the API's blockers, "Subscription will be charged to your
  selected billing account from the date that transfer is completed.", _Confirm Subscription
  Transfer_ (`POST /transfer/respond {transfer, accept: true, billing_group_id, codes?}`) and
  _Decline_ (`accept: false`, then the screen is read again). Accepting lands on the list with
  `?entity=<id>&transferred=1`.
- **07-E "Billing Accounts"** (_Change_; rebuilt 2026-10-01 - the user: "payment method should
  only go through billing account first. must be only attached to the billing account"): the
  person's BILLING ACCOUNTS (`GET /api/me/billing/accounts`), drawn with the very rows Manage
  Subscriptions' "Billing Accounts" sheet uses (`AccountTargetList` - the card's mark, the
  account's name, "Visa ending in 4121", its companies) in 07-E's panel beside Minty with the
  lemon (the existing layout kept). An account whose collection is failing, or with no card it
  can charge, is shown and shut with the reason ("Payment failed", "No card" -
  `transferChoice`); the OLDEST that can pay is preselected. Picking posts nothing; _Confirm_
  returns to 07-D naming that account's card, and the account is sent with _Confirm Subscription
  Transfer_ as `billing_group_id` - the API bills the company to that account's charged card.
  Without one (and no prior nomination) the API refuses "Choose a billing account before taking
  over the billing.". Nothing is promoted to a payer-wide Stripe default any more
  (`setDefaultPaymentMethod` is deleted), and no card is saved loose: _New billing account_
  opens the billing-account sheet (`NewAccountDialog` - onboarding's 01-D, a card AND the company
  and email it bills under, then 01-J) **over the offer**; Done brings the account back to the
  list, picked; Cancel closes the sheet. Nothing navigates, because the offer being reviewed
  would be lost — and the person most likely to press it is someone with no account at all, who
  the API lets be offered a company precisely so they can say yes and open one.
  **Figma note:** 07-E draws a "Payment Methods" card list; the frame was not redrawn for
  accounts, so the panel keeps 07-E's frame and spacing and swaps its rows for the sheet's
  account rows - a design pass may want to redraw it.
- **07-M "Subscription Transfer Completed"**: the list's row for the company, in the result
  row's celebrate layout (§12): the headline, "You are now the owner of the <company>
  subscription and have full control of this Minty." with the company in teal, and how billing
  carries on; _Back to Manage Subscriptions_ leaves for the landing, as on every result screen. `useSubscriptionsList` reads
  `?transferred=1` and shows it once the row's page model is in (`transferredResult`), until the
  row is closed or the person moves on.
- **The modal shell's colours** (`ConfirmDialog`, so every modal that shows a company):
  the **entity name is teal** and the "Entity" label above it is not — the label is furniture,
  the name is what the modal is about. This supersedes the earlier "one grey for both lines".
  The block also sits **clear of the title** now (a `mt-4` gap, where it used to tuck `-mt-1`
  into the title's trailing leading and read as one block); `02_module_settings.spec.ts` pins
  the gap and that it still shares the title's column and never collides. In 07-I the
  **person's name is orange** (`#ea9713`, the design's own), rendered as a `<span>` inside the
  `<h2>` so the dialog's accessible name stays the whole sentence.
- **The bundle says it once** (2026-09-24). A change that did the SAME thing to every module of
  the bundle renders one line naming the bundle — "Super Minty is confirmed. Billing starts the
  day its trial ends." — instead of that sentence twice with a different name. `ModuleRef.code`
  gained `"BUNDLE"` for it and the line takes the bundle tone. **This diverges from the RU
  frames**, which say it per module; RU22's two tests were updated to the collapsed shape.
  Deliberately NOT applied to what is ENDING: those lines carry each module's own end date, and
  two dates cannot be one sentence.
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
  - **The cards ARE ticked, and the ticks are the choice** (built 2026-09-24; they were
    read-only until then, when `transfer/respond` moved a company's billing whole). The title
    says "Choose Modules" and now it does: every module the company holds starts ticked —
    arriving here is being offered all of it — and unticking one **cancels that module for the
    company** as part of accepting, ending it where the outgoing payer's money runs out.
    The tick reflects *"am I taking this on"*, NOT the module's own state, which is why a
    module that is not the active one is still ticked. `codes` is sent only when the choice
    differs from the whole company; unchanged, the field is omitted.
    **The last ticked module cannot be unticked** — its checkbox and its card both go inert —
    so the screen never reaches a state Confirm would have to refuse. The API refuses an empty
    set too, and that guard stays: it answers a request, not a click. Keeping none is what
    _Decline_ is for.

    **The Subscription Summary follows the ticks.** The unticked codes are fed to
    `buildSummaryView` as a pending change — the same machinery the open row uses for the
    same question — so "Selected plan" and the price become what the recipient will actually
    be billed, not what the company has today. The panel splits honestly in the process: the
    company keeps everything until the outgoing payer's money runs out, and only what was
    kept after, so the plan shown is the FUTURE half. The frozen "No pending changes" line
    under the price is now `declinedNote`, the only place that cancellation is visible before
    Confirm. **A trial and a paid module end on different days and get different sentences**:
    a paid one stops when the outgoing payer's money runs out ("Payment Request ends on 18 Oct
    2026."), a trial runs its free days out and then does not convert ("Petty Cash ends when
    the trial runs out."), and one of each is two sentences. With no date to name, a paid one
    reads "when the current subscription runs out".
  - **Decline exists.** The design draws no way to refuse a request; the API has one
    (`accept: false`) and a request the person cannot take (blockers) would otherwise sit
    forever, so _Decline_ sits under _Confirm Subscription Transfer_.
  - **A handover takes no money, and 07-D says nothing about money** (2026-09-24). The window
    being bought starts when the outgoing payer's money runs out — normally weeks away — so the
    API charges nothing at accept: it parks the charge on `subscription_transfer.collect_at` and
    the daily `collect-transfers` job takes it on that day. The "You'll be charged … today" line
    is GONE, with `acceptCharge` and `NOTHING_TO_PAY_TODAY`; a version naming the collection date
    instead was built and then dropped by the user. What the panel still carries is the note
    under it — "charged to your selected billing account from the date that transfer is
    completed" — and the inherited-trial lines, which are a different disclosure: they commit the
    recipient to a charge at a date of their own. `quote` is still on the API's rows, unread.
  - **A person with no billing account can be offered a company.** Being asked is not being
    charged, so the API's offer-time card refusal is gone (2026-09-24); the requirement lives at
    the accept, where the money is. 07-D says so rather than leaving it to a refused POST —
    "Choose or open a billing account to take this over. Nothing is charged until you confirm."
    (`NEEDS_ACCOUNT`) — and _Confirm Subscription Transfer_ is held until there is one. Only
    claimed once the accounts have actually been read.
  - **New billing account stays on this screen.** It used to leave for the billing page (§15),
    then (until 2026-10-01) mounted a bare card form here that saved a card to no account; it now
    opens the billing-account sheet over the offer, because answering "I have no account" by
    discarding the offer is not an answer, and a card only ever comes with an account.
  - **07-B's hero** reads "Subscription & Billing" in the frame; the page keeps "Transfer
    Subscription" — it is the same page a moment later.
  - **All four outcome modals now have a trigger** (2026-09-24). `withdrawn` always had one;
    **07-I / A-07** ("<Name> declined the transfer"), **A-08** (expired) and **07-L** (accepted)
    are drawn over **Subscription & Billing** — where the design puts them, and which until now
    had no modal layer at all. The gap was never the modal: `TransferOutcomeDialog` has had all
    four kinds with this copy since section 07. It was that **no read reported a finished
    handover** — every `SubscriptionTransfer` query filters on the three open statuses, so a
    decline was indistinguishable from an offer never made. `/api/me/subscriptions` now carries
    `transfer_outcomes`, and _Done_ POSTs `transfer/seen`, which stamps
    `subscription_transfer.outcome_seen_at`: **once, ever, on every device** — the user's choice
    over a per-browser flag, and the right one here, since this app stores nothing in
    `localStorage` and its other "show once" mechanisms only work for an action taken in the
    same tab a moment earlier. Several outcomes queue oldest-first, one dialog at a time.
    **Only _Done_ records it.** The backdrop and Escape close the dialog for that visit and it
    returns next time (`onClose` vs `onDone`, through `ConfirmDialog`'s `onDismiss` hook — the
    same one A-11 uses so Escape cannot mean "discard"): the marker is once-ever, so a stray
    click must not be able to consume the only in-app telling of a declined handover. Either way
    it leaves the queue immediately, so nobody is stuck behind a dialog that will not go. The
    POST is optimistic — a failure only means it opens once more, which is the safe direction.
    07-K is the exception and passes the same handler to both: it follows the payer's own
    Withdraw a moment earlier in the same tab, so there is no "seen" to consume.
  - **Money is in minor units** on both transfer routes (8800 = HK$88.00), unlike the module
    page's cards — `formatMinor` is the one place it is converted.
  - **"to them"**: when the person a request waits on is no longer among the candidates (left
    the company, lost the admin role), the pending sentence names nobody rather than guessing.
  - **The charge is the recipient's**, always: the payer sees "They'll be charged …" against
    each candidate's OWN quote (anchors differ per payer), never a figure of their own.

## 15. Billing — the accounts, the cards and the invoices

Figma section "08 · Billing — details and payment methods" (`1410:1806`). Built 2026-09-23 over
step 3's live routes; **re-cut around BILLING ACCOUNTS 2026-09-25** (the user's brief: a payer
creates billing accounts, each containing a payment method; 08-A drops the "Payment Method"
eyebrow, its "Bill to" is the account's name and it can switch between accounts; 08-B is the
profile page of ONE account). Pages and screens: the portal's landing
(`routes/SubscriptionOverviewScreen`, `hooks/useBillingOverview`,
`components/BillingOverviewPanels` + `BillingAccountDialogs`), one account's page
(`routes/BillingPageScreen`, `hooks/useBillingPage`, `components/BillingPanels` + `CardDialogs`),
its details (`routes/BillingDetailsScreen`, `hooks/useBillingDetails`,
`components/BillingDetailsForm`), and the card screens (`routes/CardScreens`,
`hooks/useCardForm`, `components/CardCaptureForm`). The rules are `lib/billing.ts` and
`lib/billingAccounts.ts`, pure.

**A BILLING ACCOUNT** is the API's `payer_billing_group`: a name ("Bill to" -
`billing_company`, else the payer), a billing email, the cards on it, the ONE card it charges,
the companies it pays for and its own dunning clock (`GET /api/me/billing/accounts`,
minty-subscription-api's `portal.build_billing_accounts`). Two facts look like choices and are not:
**every account renews on the payer's one anchor**, so the next billing date is one date whichever
account is shown (the user, 2026-09-25; the engine agrees); and **an account holds no address of
its own** - it is the Stripe billing address of the card it charges (the user's decision: no
schema change), which 08-C writes.

- **08-A "Subscription & Billing"**, at `/subscription` — where Minty's own link lands
  (Flask's `next` defaults to it). "Back to the entity dashboard" in the header bar — which goes to **the
  company this browser is scoped to**, not Minty's entity picker (2026-09-23):
  `lib/mintyEntry.ts::mintyModulesUrl` builds `/entity/{id}/enter?token=…&next=/entity/{id}/modules`,
  so the person arrives with their Flask session re-established and Minty's `module_selector`
  routes them — one module enabled goes straight in (Petty Cash's dashboard, or the payments
  app), two offer the module selection. Minty decides, from `entity_function_map`; this app
  counts no modules. With no company in the cookie the link goes to the entity list - which,
  since 2026-09-29, is also where it goes after a result's _Back to Manage Subscriptions_: that
  button trades the company's token for an unscoped one (§12, Layouts), so the landing it
  reaches is the payer's.
  Then the billing-account card: **"Manage Billing Details and Payment Methods"** (the frame's
  "Payment Method" eyebrow is gone), **Bill to** = the shown account's name, **Next Billing
  Date** = the payer's `next_billing` - the end of the anchor period now is in, NEVER the anchor
  (the anchor is the payer's first charge and never moves; this card printed it until
  2026-09-25, a date in the past from the second month on), and _Go to payment details and
  invoices_ → THAT account's page. **Clicking the card** (anywhere but its controls - the
  `fromControl` guard; the card itself is no control, so the keyboard has a button of its own,
  "Choose which billing account to show", out of sight until focused) opens **the
  billing-account sheet** (below): **Billing Accounts**, a radio row per account (its charged
  card, how many companies, _Payment failed_ / _Expired_ / _Expiring soon_ flags), _New billing
  account_ under them, Confirm. Picking only rewrites the URL (`?account=`, `router.replace`) -
  nothing is re-read and nothing about billing changes; with none, the payer's oldest. **The
  account's NAME is _Change billing account_** (the user's call, 2026-09-25 - there is no button
  of its own any more): it MOVES a company - step 1 the company (each row names the account it
  is on; a past-due one is shown, disabled - its debt, its retries and _Pay now_ follow the
  account it is on), step 2 the account (the current one, one in dunning and one whose card is
  gone disabled with the reason; _New billing account_ opens one in place for that company and
  moves it there), Confirm → `POST /billing/accounts/move`, and the card says "<Company> is now
  billed to <Account>." - or, when the move after a new account was refused, that the account is
  ready and the company stayed. A refusal stays in the dialog in the API's words. Accounts that
  cannot be read leave the card on the payer (the old fallback) with a retry, and the page up.
  Then the Subscription Overview (payer-wide, all companies - the user's call): **Active subscriptions** and **Trial ending**
  counted in COMPANIES (a company counts once however many modules it pays for, and a trial is
  not an active subscription — nothing is being charged for it yet; "Trial ending" is a trial
  ending within 30 days - a trial's whole length, the user's call 2026-09-25, after a 7-day window
  read "0" to a payer with seven trials running), the update lines for those same trials,
  soonest first, under every payment that failed ("Company A Limited · **Petty Cash** trial ends
  in *3 days*", "Company C Limited · **Payment failed**") - five shown, _Show more (N)_ opens
  the rest and _Show less_ puts them back - and _Manage Subscription_ → the list. Minty counting
  at the desk is MIRRORED (`-scale-x-100`, the user's call 2026-09-25) so it faces the figures,
  not out of the card; its cap's lettering reads mirrored with it.
- **08-B, one account's page** at `/subscription/billing?account=` (or `?entity=` - "the account
  this company is on", what the list's payment-failed banner knows; with neither, the oldest).
  Both its top cards - "Next billing" and "Payment Methods" - are 08-A's own whole-card hotspot
  (2026-09-29, the user's call): a click anywhere on either that is not one of its own controls
  opens the SAME billing-account picker (`AccountPickerDialog`), with a sr-only keyboard button
  doing the same; picking another account lands THIS page on it (`confirmPick`), rather than only
  rewriting the URL as 08-A does. "Next billing" — **Bill to** (the account's name, its address line by line, its email - the API's
  `bill_to_email`: the billing email, else the business email every company on it shares, else
  the payer's, the same address its money emails reach and its invoice PDFs print (2026-09-30) -
  and _Change billing details_ → 08-C), **Next Bill Date** (the payer's `next_billing`) and
  **Amount** - what THIS account's next renewal will charge, large in the price teal with
  "(estimated)" under it, by the currency's code with cents only when there are some ("HKD
  1,500", the user's call); the API prices it with the renewal runner itself (`next_bill`:
  its companies billing forward, the trials that will have converted by then, a cancellation
  extension riding along), and "—" when there is nothing to bill. **Three columns** from a
  tablet up, as the design draws them (2026-09-25): _Bill to_, the date and amount, and Minty -
  the clock cat (the thinking one when amber) drawn by its ARTWORK at 172px (124 when amber),
  right-aligned and centred: the PNG is a 477x400 canvas whose cat fills only its top-left
  310x306, so drawn whole it sat small and short of the edge; `CatArt` clips the canvas without
  editing the file. The gaps are kept to 24px so _Bill to_ has the room (331px with a
  "HKD 1,295.09" amount - "angelika.tardaguela@oliveandvinehk.com" on one line), and a longer
  email breaks after its "@", never mid-word — then
  its "Payment Methods" and its "Invoice History" (`/api/me/invoices?account=`; an invoice from
  before accounts belongs to the oldest, where dunning collects it) - 10 to a page until the
  payer picks 50 or 100, with the range and the way back and on; the invoices are their own
  read, so turning a page never re-reads the accounts. Amber with "Due
  Immediately" and a **Payment Failed** chip when THIS account is in dunning or a company on it
  is past due (**08-K**) - and then the card it charges has a **red-outlined _Update card_**
  (the card to fix, `cardNeedsUpdate`; an expired card's is red too, a spare stays grey), and a
  declined invoice's **whole row is red** with **"Failed 26 Jul"** under Paid date (the day it
  was raised and declined; the year only when not this one) and a red **Retry payment** on the
  one the API marks `retryable` - the invoice a retry would charge; an abandoned bill stays red
  with no button that could only refuse (2026-09-28, the user's design). _Retry payment_ →
  `POST /api/me/invoices/{id}/retry`: paid says "Payment received — …" under the table, a decline
  again opens 06·B's **Payment could not be processed** (the card named; _Try again now_ /
  _Done_; "We'll automatically retry" only while the account is in dunning), any other answer is
  the API's sentence - and the account and its invoices are read again quietly, so a paid retry
  clears the amber by itself; a red line over the list when the card it charges has already expired
  (**08-I**); "No card saved · Trials keep running without one…" when none of its cards is
  left (**08-H**); "No billing account yet" with _Open a billing account_ for a payer who has
  none, which opens the sheet straight on the form (onboarding's empty wallet) and makes the page
  the new account's.
- **The cards** are THIS account's: `Default` is the card it CHARGES (the API marks it per
  account - the flat wallet's `is_default` is the Stripe customer's and would point at the
  wrong card), pinned first; the rest `Saved`, an expired one `Expired` in red with its month in
  red too. _Set as default_ switches what the account charges - from its next bill, for every
  company on it (`POST /billing/accounts/default-card`); the payer-wide Stripe default is left
  alone. Two are shown; "Show more (6)" opens all of
  them (**08-J**, whose note is the rule: "the default card stays pinned to the top and is the
  only one charged. An expired card is named as expired rather than quietly failing at
  renewal"). **"Update card" IS the menu** (the frames' hotspots): _Set as default_ (only on a
  card that is not, **08-W**; **08-X** is the default's shorter menu), _Edit_ → 08-D, _Delete_.
- **Removing** (`/payment-methods/remove` with the `account`, then the accounts read again):
  the card the account charges is refused by the page itself with **08-R** "Remove default card?" — "<Card> is currently your default payment method. Another
  card will need to be selected as the default payment method before this card can be removed.",
  one way out. Any other card is asked about first and then removed - from every account, since
  it leaves the wallet - and if it was the payer-wide Stripe default the API hands that to this
  account's card rather than refusing with a fix this page has no button for. A refusal from the
  server is shown as written (it knows what the card is still paying for).
- **08-Y, adding a card** at `/subscription/billing/add?account=` - ON that account, as a
  spare until it is made the one it charges: a SetupIntent
  (`/payment-methods/setup-intent`), Stripe's own `PaymentElement` and `AddressElement`, then
  `/payment-methods/confirm` — three trips in that order, and the last is not optional (for a
  first card it is what creates the customer). The number is typed into Stripe's iframe and
  never reaches this app; Stripe's own mandate line is suppressed inside the Element because it
  names the Stripe ACCOUNT, so the sentence under the form IS the disclosure and the two go
  together. A SetupIntent Stripe has confirmed is remembered, so a retry after OUR confirm
  failed does not confirm it again (Stripe refuses an intent that already succeeded). Saving
  comes back to the account's page with `?added=<card>`, which draws **08-N**
  "New Card added Successfully · <Card> is added successfully. This card is not your default
  payment method." (_Set as default_ - the card the ACCOUNT charges / _Done_) or **08-S** (…"is
  set as the default payment method.", _Done_) when it already is.
- **New billing account** is not a page: it is **onboarding's `BillingSheet`**, three frames in
  one dialog (`components/AccountSheet` + `BillingAccountDialogs`, the user's call 2026-09-25 -
  the `/subscription/billing/new-account` page went). The list (**01-L**, 481 wide) turns in
  place into the form (**01-D**, 880: _Billing Email_ and _Billing company_ - onboarding's order
  and error words, the email labelled as the user asked - then Stripe's fields in a bordered
  _Payment method_ block themed with onboarding's `STRIPE_APPEARANCE`, the mandate, Cancel beside
  _Save billing account_, Minty holding a card; 481 and no cat below 900px), then **01-J** (435:
  "New Card added Successfully", "<Card> is added successfully.", "This card is set as the default
  payment method." - true: it is the card the new account charges - and Done). BOTH fields are
  required and checked before Stripe is asked for anything, and locked while saving; nothing
  closes the sheet mid-save; a SetupIntent that will not open offers Try again in place. The
  confirm carries them and OPENS the account on the new card (`make_default: false` - the
  payer-wide Stripe default does not move); a retry whose answer was lost re-answers the account
  it opened rather than opening a second. Done (or Escape, or the backdrop - on 01-J the account
  exists) lands 08-A on the new account; from the move's step 2 the company moves onto it first;
  from 08-B's empty state the page becomes the new account's.
- **08-C, "Update Billing Information"** at `/subscription/billing/details?account=` - exactly
  that account, or "couldn't be found" (never another account's form): the frame's form card
  (720px, the 1.5px-edged fields, the grey "Address" caption, _Go Back_ / _Save billing account_,
  Minty filling a form beneath) with **Billing Company** and **Billing email** - ours, each
  refused past 255 characters under the field (the API's limit, in its words) - then the
  **address in Stripe's own form** (`AddressElement`, billing mode, since 2026-09-25): Full
  name, Country or region, the lines, and a town and postcode where the country has them,
  opened on the charged card's cardholder and address, offering the registry's countries, and
  themed to the frame's fields (46px, the 1.5px edge, 18px between rows - measured live beside
  ours). `?countries=1` brings the registry and the publishable key it mounts with. Only what
  changed is sent (`POST /billing/accounts/update`): the address as a whole once Stripe has
  checked it (`getValue()` - an incomplete one is marked in place and nothing is sent), a blank
  line as a clear, the cardholder when the name changed; a company name the account has cannot
  be blanked (one never named may stay so). An account whose card is gone has nowhere to keep
  an address, and a page that cannot draw Stripe's form (no key here, Stripe.js blocked) says
  the address cannot change right now - either way the name and email still save. Both
  buttons land on 08-B.
- **08-D, editing a card** at `/subscription/billing/edit?card=`: the number shown, masked and
  disabled, and only what Stripe lets a saved card change — the name on it and its expiry
  ("Only the name on the card and its expiry date can be changed. To use a different number, add
  a new card."). _Save changes_ is dead until something is different.
- **Invoice History**: Inv#, Amount (the currency named once in the header), Paid date,
  **Invoice PDF** and **Billing Breakdown**, _Download csv_ (the two download columns centred,
  as the design sets them). **The Invoice PDF is our own document** (Figma 09-A, 2026-09-29 -
  it had linked Stripe's hosted invoice page): `GET /api/me/invoices/{id}/pdf`, saved as
  `Inv-<reference>.pdf` - named by the page, since CORS keeps the API's `Content-Disposition`
  from it (`lib/billing.ts::invoicePdfFilename`, the breakdown's stem). **Bill to** is the
  invoice's billing account, read when it is downloaded - its name, billing email and the
  charged card's address, as 08-B prints them; the lines are 09-A's plan lines with the
  companies listed under each (a company row is one Stripe invoice item). Only an invoice the
  processor has, paid, open or uncollectible, has one (`has_pdf`); a draft or a void one shows
  "—". A refusal is the API's sentence: 404 not yours, 409 no PDF, 502 the processor out of
  reach for the address (the rest is minty-subscription-api's `invoice_document.py`). The breakdown is
  `GET /api/me/invoices/{id}/breakdown` written as the user's sample file, column for column:
  `Entity Name, Subscription, Monthly amount, Period start, Period end, Charged for the period`,
  saved as `Inv-<reference> Breakdown by Entity.csv` (`lib/breakdown.ts`): a day as "26-Jul-26",
  a month running to the day before the next begins ("26-Jul-26 → 25-Aug-26") and an extension
  to the day access ended ("→ 5-Aug-26") - the sample's two readings; a rate trimmed ("400"), a
  charge to the cent ("400.00", a credit negative); quoted fields and CR-LF, and a byte-order
  mark so Excel reads a Chinese company name as UTF-8. One download at a time, whichever file -
  the row being prepared says so; each file's refusal is its own line under the table.
  **The Inv# previews that PDF** (2026-09-30; the user: "preview is only preview no download"):
  where there is one (`has_pdf`) the reference is a button - in the row's colour, red on a
  declined one - opening a dialog titled "Invoice <reference>" (`components/InvoicePreviewDialog`
  on `ModalFrame`): "Preparing the invoice…" while the same route is read
  (`useBillingPage.previewInvoice`), then the pages drawn by pdf.js (`components/PdfPages`,
  `pdfjs-dist` pinned at 4.10.38 - past CVE-2024-4367's fix in 4.2.67) onto canvases at an A4
  page's true width, 794px at most and a phone's narrower. **View-only**: the X is its one
  control - no Download, Print or Open - and nothing is saved from it; the Invoice PDF column is
  still the download, unchanged. pdf.js's worker is served by this app at
  `/pdfjs/pdf.worker.min.mjs`, copied out of `node_modules/pdfjs-dist` by `next.config.ts` on
  every start (gitignored; a missing or failed copy is a loud `console.error`, not a stopped
  server) - the worker only: the API's fpdf2 embeds every font (Identity-H), so no cMaps or
  standard fonts. A refusal is the API's sentence inside the dialog, and a PDF pdf.js cannot draw
  an alert there too (the error itself on the console). Escape, the backdrop and the X close it,
  even while it loads, and the keyboard goes back to the Inv#; an answer that arrives after it
  closed, or after another row's opened, is dropped. Not a download, so the one-at-a-time rule
  does not hold it back.
- **Seeing it without the API**: `?fixture=B` (two cards), `H` (none), `I` (the default expired),
  `J` (eight), `N` (one just added, with `?added=pm_master8842`) on the billing page - each is
  Company A's page in that state (`accountsFor`); the landing takes the list's own
  `?fixture=A|B|F` (A and F with three accounts - Company A, Vine Consulting, one never named -
  B with none); 08-C takes any `?fixture=` — dev only, from `__fixtures__/billing.ts`, whose
  accounts carry no Stripe key, so its address shows the "cannot change" note.
- **Readings** (the design's frames against the API's contract):
  - **"Bill to" is the billing account** (superseding the 2026-09-23 reading "Bill to is the
    payer"): its `billing_company`, else the payer for an account never named. The address under
    it is the Stripe billing address of the card the account charges - no column holds an
    account's address (the user's call); 08-C edits all of it, postcode included, in Stripe's
    form. Renaming an account renames the Bill to on its invoices' PDFs too, old ones included -
    ours are drawn from the account when downloaded; only Stripe's own hosted invoice, which the
    portal no longer links, keeps the one name the payer's one Stripe customer carries.
  - **08-C's address IS Stripe's own form** (the user's call, 2026-09-25; before it, our own
    five fields under Stripe's names): its `AddressElement` asks for exactly what a country's
    addresses need, checks and autocompletes it, and always asks for the cardholder's name -
    saved onto the card too, so the field does something. Themed to the frame's fields, not the
    frame's Hong Kong breakdown (unit, floor, building, street); the company and email stay
    ours, above it. **The Full name is wanted gone** (the user: 08-C updates an address, it adds
    no card) but Stripe only hides it with a per-account BETA, `fields.name: 'never'` - probed
    live 2026-09-25: "You cannot specify fields.name without beta access", the field still shown.
    The user chose to keep Stripe's form and ask Stripe to enable it. **When it is on:** add
    `fields: { name: "never" }` to `StripeAddress`'s options AND stop comparing and sending the
    name (`detailsChanges`' `cardholder`, `addressChanged`'s name) - a hidden field reads back
    empty, and sending it would blank the card's existing name. **A _Billing email_ field is
    added** under the company: 08-B prints the email and nothing else could correct it.
  - **The pickers are onboarding's sheet, not 08-G** (the user's call, 2026-09-25): section 08
    draws no frame for them, and onboarding's `BillingSheet` is the same act in another app - so
    the list, the form and 01-J are its 481 / 880 / 435 frames, its rows and buttons (the values
    in `components/ui/sheetClasses.ts`). Our words for the pickers; its words for the form and 01-J.
    The frame's whole-card hotspot to 08-B opens the sheet (the user's call); the link still goes
    to 08-B. Two changes from onboarding, both toward safety: the sheet cannot be closed
    mid-save, and a card form that fails to open offers Try again in place.
  - **`/subscription/billing` with no `?account=` opens the oldest account** (the tab that
    used to land there is gone, 2026-09-29); the payment-failed banners - the list's and the
    module page's - do carry their company's account.
  - **"Amount (estimated)" is the renewal runner's own figure** (2026-09-25; it was left out on
    09-23 because the API had no forecast): `next_bill` on each account, from
    `renewals.build_renewal` for the period starting on the next billing date plus the trials
    that will have converted by then - never re-priced here, so it cannot quote what the invoice
    will not charge. Estimated, because a trial that lapses or a module cancelled first changes
    the bill. By the currency's code ("HKD 1,500") where the frame writes "HK$1,500" - the
    user's call.
  - **A card expires in a month, not on a day.** The Expiry column reads "Sep 2026": Stripe
    gives month and year, and the frames' "14 Sep 2026" would be a day nobody can act on.
  - **A non-default card is asked about before it goes.** The design's _Delete_ returns straight
    to the list; removal is hard to undo, so it asks first. 08-R — the default card's refusal —
    is the design's own.
  - **"Billing Breakdown · Download csv" is built on 08-B** (2026-09-25; the frames' hotspot
    says `Download csv → 09-D`, and the user's sample file is that frame's content). Each line's
    days and monthly rate are the ones it RECORDED when it was issued (schema item 23, the
    user's call the same day; an extension priced at two rates records none, and its row shows
    the rate its days add up to). A line issued before then is read back by the API from how
    that kind of line is priced - and an extension of that age shows a blank end once a resume
    has cleared its module's access end.
  - **08-F / 08-G (A-12 / A-13, the payment-method picker)** have no screen of their own. The
    loose card picker they matched was 07-E's until 2026-10-01, when 07-E became a billing-account
    picker (§14) and `PaymentMethodPicker` was deleted; choosing which card an account charges is
    08-B's _Update card_ menu ("charge this card").
  - **08-E is 08-Y as a modal**: the same Stripe form, built once as the page. Its "New billing
    account" heading is the sheet's form's (onboarding's 01-D); adding a card to an account reads
    "Add a payment method".
  - **The list moved.** 08-A is the landing the design draws ("Back to the entity dashboard"
    above it, _Manage Subscription_ → 04-A below), so `/subscription` is the overview now and
    the Manage Subscriptions list is `/subscription/subscriptions`. Flask's handoff default
    (`next=/subscription`) needs no change.
  - **Stripe's fields stay out of the STUBBED specs** (iframes from js.stripe.com): the add screen
    and 08-C's address are checked as screens, with the publishable key withheld, and both forms
    are unit-tested with Stripe stubbed (`CardCaptureForm.test.tsx`, `useBillingDetails.test.tsx`,
    `BillingScreens.test.tsx`) — the same rule the sibling apps keep. Over the LIVE API,
    `04_live_api.spec.ts` drives 08-C's `AddressElement` for real, in Stripe test mode only: it
    opens on the card's address, a new line 2 reaches the card and 08-B, and the line is put back.
    It arrives with `handoff(..., { idle: false })` and waits for the field's value instead: Stripe's
    iframes can keep the network busy, and a "networkidle" wait then ran into the test's timeout
    (2026-10-06).
    The sheet was driven once for real with Stripe's test card on the dev database (2026-09-25, a
    hand check, not a spec): the account opened, 01-J, Done on 08-A.
