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
lib/            pure helpers (paths, moduleState, flaskLinks; payerPortalFormat.ts arrives with the port)
components/     the screens' pieces; the portal's are plain and the design pass replaces them ONE FOR ONE,
                the module page's are built to its Figma design
routes/         the page-level components app/subscription/**/page.tsx re-export
__fixtures__/   the module page model per Figma state - shared by Vitest, Playwright and the dev ?fixture= switch
__tests__/      Vitest: api/, hooks/, lib/, the screens and the re-export guard
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
   (`__tests__/reexports.test.ts`). The portal pages sit in the route group
   `app/subscription/(portal)/` so their tabbed layout stays off the module settings page.
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
mapped to the routes) and two skeletal routes (the index and the layout). Step 4a (2026-09-21):
the module settings page, built to its Figma design over a stubbed API, under billing-frontend's
settings chrome (`@/components/ui/{AppHeader,NavMenu}`) - `hooks/useModulePage`,
`lib/moduleState`, `lib/flaskLinks`, six components, the fixtures, its unit and browser tests
(`docs/features/subscriptions.md` §9). Step 4b builds the pages its CTAs lead to and ports the
portal screens from `billing-frontend/components/profile/*` (behaviour, not look). Step 4b (same
day): the Manage Subscriptions list from Figma section 04 - `hooks/useSubscriptionsList`,
`lib/portalRows`, eight components, `__fixtures__/subscriptions.ts`, its unit and browser tests
(`docs/features/subscriptions.md` §10); `/subscription` is that list now.
Step 4c (2026-09-22): the live-API journeys - `e2e/04_live_api.spec.ts` runs both pages over
step 3's routers with no stubs (a real card-free trial started from the page and read back),
against the seed's `E2E Subscription Shop`; and the open row from Figma 05·A and 05·B - `hooks/
useEntitySummary` (the answer and the ticks pending on it), `lib/subscriptionSummary`,
`components/SubscriptionSummaryRow` (`docs/features/subscriptions.md` §11); a tick is a change
pending on the row until *Confirm Subscription Change*, which asks first in the change's modal
from Figma section 06 - `lib/changeModal`, `components/ConfirmDialog` (the shell, shared with
the Start Trial dialog) and `components/ChangeDialog` (§13) - then applies it
(`api/moduleChanges`, one API action per module) and lands on its result from Figma 05·C -
`lib/changeResult`, `components/ChangeResultView` (§12): in the row for what was added,
confirmed, restored or started (Start Trial lands there too), the whole page for a
cancellation. The ⋮'s Cancel subscription / Reactivate (Figma 05·D) are those same ticks - every
ACTIVE module unticked, every module that is not ticked - opening the row and asking with the
modal for that change; "Calculating…" (05·B-C) fills the panel's slot while the row loads and
for a beat after every tick; the bank declining asks to try again and leaving with ticks
pending asks first (06·B, `components/InterruptedDialogs`). Both sides of a handover (Figma
section 07): the payer's `routes/TransferSubscription` - `hooks/useTransferSubscription`,
`components/TransferSubscriptionPanels` (pick the new subscriber, Request transfer, the one
waiting withdrawn) - and the recipient's `routes/SubscriptionRequests` -
`hooks/useSubscriptionRequests`, `components/SubscriptionRequestsPanels` (the request under
review with the company's cards and what accepting charges, the card picked, Confirm
Subscription Transfer landing on the list's row) - over `lib/transfer` (both sides' rules,
minor-unit money) and `__fixtures__/transfers.ts`; `components/TransferOutcomeDialog` tells how
a handover ended (§14). Step 4c (2026-09-23): the billing area from Figma section 08 - `routes/SubscriptionOverview`
(the portal's landing at `/subscription`, so the Manage Subscriptions list is
`/subscription/subscriptions` now), `routes/BillingPage` (the next bill, the saved cards with
their menu, the invoices) and `routes/CardPages` (add a card on Stripe's own fields, edit a
saved one), over `hooks/useBillingPage` / `useBillingOverview` / `useCardForm`,
`components/BillingPanels` + `CardDialogs` + `CardCaptureForm` + `BillingOverviewPanels`,
`lib/billing` and `__fixtures__/billing.ts` (§15). Next: the invoices page (section 09); the
handover's outcome modals once the API reports an outgoing request's end; the billing company
and address (08-C) and the next bill's estimated amount, both of which need the API first.
