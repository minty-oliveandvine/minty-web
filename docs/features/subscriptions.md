# Subscriptions — the hub's first feature

The payer portal and a company's module settings page, over `minty-billing-api` (:8004). This
page is the map of the feature as it stands (**Part 2 step 1: the shell, the bounded folder,
the typed API clients and a skeletal index**) and of what step 4 fills in. The behaviour being
ported is described in `Minty/docs/features/modules-and-subscriptions.md` (the Flask module page)
and billing-frontend's portal components; the API contract in
`minty-billing-api/docs/features/subscriptions-api.md`.

## 1. What a person gets

Reached from Minty — the entity list's _Subscriptions_ link (an unscoped token, for the portal)
or a company's _Modules_ settings (a scoped token, for that company's page). Never a login here.

| Page              | Path                                              | Today                                                                    | Step 4                                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Index             | `/subscription`                                   | three links (Subscriptions · Billing · Invoices) under the tabbed layout | replaced by the ported _Manage subscriptions_ screen                                                                                                                                                                               |
| Subscriptions     | `/subscription/subscriptions`                     | —                                                                        | the companies I pay for, module status per company, search/sort/pages; a row opens the company's module page; _Change subscriber_                                                                                                  |
| Change subscriber | `/subscription/subscriptions/subscriber?entity=…` | —                                                                        | admins the bill could move to, each with a quote and inherited trials; offer / withdraw                                                                                                                                            |
| Incoming          | `/subscription/subscriptions/incoming`            | —                                                                        | offers made to me: accept (charges the quote) / decline                                                                                                                                                                            |
| Billing           | `/subscription/billing`                           | —                                                                        | billing accounts, saved cards (Stripe Elements card capture), default, per-company nomination                                                                                                                                      |
| Invoices          | `/subscription/invoices`                          | —                                                                        | every invoice, newest first, filter by company, Stripe's hosted page                                                                                                                                                               |
| Module settings   | `/subscription/entities/{id}/modules`             | —                                                                        | the two module cards with their states; start trial / buy / restart / cancel / retry / change card / manage billing; the decision dialogs, the consent-takeover flow, `?session_id=` return from Checkout, `?from=bills` back link |

**Skeletal by decision** (2026-09-21): functional screens with minimal styling; a new design is
created later. Tests locate by role and text, never by class.

## 2. The bounded folder — `features/subscription/`

Everything the feature is lives here; the app is a shell around it, and the ESLint boundary
keeps it that way so the feature can be lifted into its own app in Part 3 (the extraction recipe
is in `features/subscription/README.md`).

```
index.ts        THE public surface: SubscriptionIndex, SubscriptionLayout, SUBSCRIPTION_BASE_PATH
api/            payerPortal.ts (the 15 /api/me routes, billing-frontend's function names) · moduleSettings.ts
                (getModulePage, postModuleAction over the 19 actions) · notice.ts
hooks/          state over api/ (step 4)
lib/paths.ts    the ONE place the mount point is spelled; PORTAL.*, modulesPath(id)
components/     the screens' pieces (step 4) — what the design pass replaces one for one
routes/         SubscriptionLayout (header + PortalTabs), SubscriptionIndex
__tests__/      apiClient (from the feature's side), paths, the re-export guard
e2e/            the live journeys (step 4), picked up by the root playwright.config.ts
```

The three rules, enforced by `npm run lint` (eslint-plugin-boundaries) and `npm test`:
(1) the folder imports only itself, `@/lib/**`, `@/components/ui/**` and packages; (2) nothing
outside imports it except `app/subscription/**`, and only `index.ts`; (3) `app/subscription/**`
files are one-line re-exports. A fourth by convention: links inside the feature go through
`lib/paths.ts`, never a literal `/subscription/…`.

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
from the source). `e2e/01_landing.spec.ts` (the handoff, the gates, dark → not-available;
Flask's re-handoff stubbed until Part 2 step 5 lands the route). Step 4 adds
`features/subscription/e2e/`: the five portal journeys from `billing-frontend/e2e/03_payer_portal.spec.ts`
and the module-page journeys (cards for the seeded shop; start a card-free trial → Flask's gate
opens; cancel-preview → cancel → restart quote), with the JWT minted by `e2e/helpers.ts`.

## 8. What arrives when

| Step   | Lands here                                                                                                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4      | the portal screens (behaviour from `billing-frontend/components/profile/*`, styling stripped), the module settings page (behaviour from Flask's `module_*.html` partials), `hooks/`, `lib/payerPortalFormat.ts`, the feature's e2e journeys |
| 5      | Minty's `/handoff/minty-web` route exists — the e2e stub goes; billing-frontend's profile links point here                                                                                                                                  |
| 7      | deployed dark at the cutover; 8b switches it on after the API                                                                                                                                                                               |
| Part 3 | login, dashboard, profile, settings join the hub; `@/lib` and `@/components/ui` become `@minty/shared`; the folder is liftable per its README                                                                                               |
