# minty-web browser tests

```bash
npm install
npx playwright install chromium   # once
npm run test:e2e                  # against a stack that is already running
```

Real browser, stack already up (this app :3000 `npm run dev`, minty-subscription-api :8000, Minty
:8010). **Nothing is started here.** Specs skip with a reason when a service or the credentials
are missing.

Two folders, one runner (`playwright.config.ts`): `e2e/` holds the shell's specs; each
feature's own journeys live in its `features/<name>/e2e/` so that lifting the feature out takes
its specs with it.

**The Terms gate** (`components/ui/TermsGate.tsx`) asks Flask on every page. `handoff()` answers
it "nothing owed" (`answerTerms`) unless a spec passes `{ terms }`: only `09_terms.spec.ts` is
about the gate, and the shared e2e account OWES an acceptance that nobody may give on it - with
real credentials, an unanswered check would put the panel over every other spec.

## Credentials

The specs arrive the way Minty sends people: `/landing?token=<jwt>`. They mint that JWT
themselves with the shared `SECRET_KEY` (see `e2e/helpers.ts` for why nothing is bypassed):

| Variable                                                 | What                                                                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_JWT_SECRET`                                         | the `SECRET_KEY` shared by Minty and minty-subscription-api                                                                             |
| `E2E_MINTY_USER` / `E2E_MINTY_ENTITY`                    | the identity `Minty/scripts/e2e_seed.py --print` creates                                                                                |
| `E2E_MINTY_SUBSCRIPTION_ENTITY`                          | the seed's second company (`E2E Subscription Shop`), reset to "never held anything" on every seed run - the live trial journey's target |
| `E2E_MINTY_ENTITY_NAME`                                  | optional, default `E2E Petty Cash Shop`                                                                                                 |
| `E2E_BASE_URL` / `E2E_SUBSCRIPTION_API_URL` / `E2E_PETTY_CASH_URL` | the three hosts; default the local ports (`E2E_PETTY_CASH_URL` must equal the app's `PETTY_CASH_URL`)                         |

Run the seed in the Minty repo before every run. Never commit any of these values. Report the
run time (mm:ss) with the result.

Two traps. The stubbed specs (`02`, `03`, `05`, `06`) intercept the URL the BROWSER calls, which is the
app's `SUBSCRIPTION_API_URL` (default `http://localhost:8000`): leave `E2E_SUBSCRIPTION_API_URL`
at its default, or set both to the same host - with them apart the stubs miss and the real API
answers the fixture assertions. And the browser must open the app on the origin the API allows
(`E2E_BASE_URL` = `http://localhost:3000`, as `CORS_ALLOWED_ORIGINS` names it); on
`127.0.0.1:3000` every preflight fails and the pages report "couldn't load".

## Specs

| File                                                        | Journeys                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01_landing.spec.ts`                                        | no token → Flask's re-handoff (stubbed: the route exists in Minty since 2026-09-21, but the spec asserts where the browser is sent, not what Flask does); the API is stubbed too (`stubBillingApi`, a 501 like the real routers) so a token for a user the API's database does not hold cannot 401 the browser out of the app · no cookie on a page → the re-handoff for that page · the handoff stores the cookie (lifetime = the token's) and lands on `next` · an unsafe `next` is ignored · `/` is the entity list |
| `features/subscription/e2e/02_module_settings.spec.ts`      | the module settings page over a STUBBED API (`page.route` serves `features/subscription/__fixtures__`; the router is a 501 stub until step 3): the chrome and tabs, the cards per Figma frame, _Start Free Trial_ asking first (04-G's dialog) and then posting `{codes}` - with _Go back_ posting nothing, a seam's URL, the payment-failed banner, no buttons for a non-payer. Runs with stand-in credentials when `E2E_*` are unset (nothing reaches the API). Located inside `main` - `next dev` adds its own button and alert outside it                                                      |
| `features/subscription/e2e/03_manage_subscriptions.spec.ts` | the Manage Subscriptions list over the STUBBED API: the list from the landing with the transfer card and the two sections, a row's cells, the ⋮ menu's items, Cancel subscription opening the row and asking (05·D), Request transfer's seam, Start Trial asks then posts with the company's id, search and the no-match state, the empty state, `?entity=` opens the company's row; a row opened in place (Figma 05·A, served from `__fixtures__/modulePage`): the ticks, the summary's current/future blocks, one open at a time; a tick pending (05·B): the chip, the panel calculating for a beat (05·B-C), a second press undoing it; a change confirmed: its modal asks first (06 - the bundle's, Cancel Subscription? with Go back keeping the tick), then the actions posted with the company's id, the result row (Congratulations) and the cancellation page (05·C), Back to the list; leaving with a tick pending asks (06·B, Go Back / Discard changes); the bank declining asks to try again (06·B, Done keeps the tick)                                                                                                                                            |
| `features/subscription/e2e/04_live_api.spec.ts`             | the pages over the LIVE API (step 3), no stubs: the module page renders the seeded shop's real cards; on the subscription shop, _Start Free Trial_ and its confirmation open a card-free trial through the API and the card comes back counting the term down (the API confirms `trialing`, and Flask's gate - `entity_function_map` - is on); the Manage Subscriptions list shows the company the trial made the person the payer of, and its row opens on the real page model (the trial as the plan at nothing a month, no card on file). Needs the whole stack and the seed run first (the seed is the reset).                          |
| `features/subscription/e2e/05_transfers.spec.ts`            | both sides of a handover over the STUBBED routes (Figma 07): the payer picks the new subscriber - the current one unpickable, the pick's charge and the responsibility sentence shown - and _Request transfer_ posts `{entity, to_user}` and lands on "Transfer requested", Back to the company's row (07-A → 07-B); a request already waiting is withdrawn - `{transfer}` posted, the 07-K modal, Done reading the picker again (07-C → 07-K → 07-A); the recipient with nothing waiting (07-F, Back to the list); a request reviewed - the cards drawn, the chosen billing account's card named - the BILLING ACCOUNT changed among the person's accounts (the oldest that can pay preselected, one in dunning shut; the row is pressed), nothing posted until _Confirm Subscription Transfer_ posts `{transfer, accept: true, codes, billing_group_id}` (no `payment-methods/*` call allowed) and lands on the list's "Subscription Transfer Completed" row, Back closing it (07-D → 07-E → 07-M) |
| `features/entities/e2e/07_entity_list.spec.ts` | "Select Company" over a STUBBED Flask: the rows and where they lead, search, the "+" in the screen's corner; the layout measured (the bar across the screen with the title in its middle, Flask's column widths and 65 / 24 px spacing, the search box that stays while the rows scroll, a phone's single column); the initials open My Profile over the list; the menu without Settings, the cat above Logout; Flask's flashed notices; a company's token traded for an unscoped one |
| `features/profile/e2e/08_profile.spec.ts` | My Profile over a STUBBED Flask and API: the page opened inside a company and from the list, an edit saved in place (the menu names the person anew; its name only closes the sidebar on the page); the sidebar's My Profile from the initials and from the menu's name, ‹ back to the menu, the whole screen on a phone and its close |
| `e2e/09_terms.spec.ts` | the Terms gate over a STUBBED Flask: Flask's panel over the list with the list out of reach, not dismissible, the tick box locked until the document is scrolled to its end in a real layout, Accept posts the version on screen and lifts it where the person stands; a 409 reads the new version and asks again; Cancel logs out at Minty; a phone's single column without the illustration |
| `features/subscription/e2e/06_billing.spec.ts`              | the billing area over the STUBBED routes (Figma 08): the portal's landing at `/subscription` - who is billed, the two figures, the failure lines - and _Manage Subscription_ landing on the list (08-A); the billing page's next bill (amber, "Due Immediately"), the default card pinned first with its chip and month, the invoice rows, an invoice's PDF downloaded as `Inv-<reference>.pdf` and its breakdown as the CSV, and its Inv#'s view-only preview - a real pdf.js canvas at the A4 page's true width from the worker the app serves (`/pdfjs`), the X its one control, no download event (08-B); the _Update card_ menu promoting a saved card and the chips swapping (08-W); the default card's removal refused (08-R) and another card's removal posted; "No card saved" leading to the add screen (08-H → 08-Y, with the publishable key withheld so Stripe's iframe never opens); the expired card's line (08-I); and the card that just arrived being made the default (08-N → 08-S). A standalone invoices page (minty-payment-request-web's section 09) was decided against - this spec's invoice rows and their two downloads are the whole of it |

## Not covered here

Stripe card capture (Elements iframes stay out of Playwright, as in the sibling apps; the
capture flow is unit-tested with Stripe stubbed - `06_billing.spec.ts` stubs the SetupIntent
with an empty publishable key, which draws the screen and opens no iframe). The API's own contract is
`minty-subscription-api/e2e`.
