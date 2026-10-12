# Features — what minty-web does and where each part lives

`minty-web` is the Next.js hub of the Minty system, born in Part 2 of the modernisation plan
with one feature: subscriptions — the payer portal and a company's module settings page, over
`minty-subscription-api`. Since 2026-09-29 it also has the entity list ("Select Company", the hub's
first page) and My Profile, over Flask's bearer routes — Part 3 step 4, pulled forward; since
phase 2 (2026-10-05) also sign-in (`/login`); and since 2026-10-12 the legal documents
themselves - the Terms of Use and the Privacy Policy, their pages and their fingerprints, moved
out of Flask; the dashboard follows in Part 3. Written for
someone new to the codebase; the plan (`Minty/docs/modernisation/modernisation_plan.md`) and
the sibling repos' `docs/features/` folders are linked, not repeated.

| Feature                                                                                                                                                  | Document                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Getting in: the sign-in page (`/login`, phase 2), the module token, the cookie, the cookie gate in `proxy.ts`, the re-handoff, what this app never does | [authentication.md](authentication.md) — `features/auth/README.md` holds the recipe; Minty's `docs/features/authentication.md` has the system-wide picture |
| The subscription feature: the pages, the bounded folder and its three rules, the API clients, no switch, card capture, tests, and which step fills what  | [subscriptions.md](subscriptions.md) — `features/subscription/README.md` holds the extraction recipe; `minty-subscription-api/docs/features/subscriptions-api.md` the contract |
| The entity list ("Select Company"): where it comes from, the cards, what Flask flashed on the way, the header and the side menu on every page | [entities.md](entities.md) — `features/entities/README.md` holds the extraction recipe |
| My Profile: the Figma 10-A/10-B page, editing in place, the subscription feature's card in its slot | [profile.md](profile.md) — `features/profile/README.md` holds the extraction recipe |
| A company's Users and Entity & Integration tabs (phase 2): members, roles, invitations, the company's details and its Xero connection | [company-settings.md](company-settings.md) — `features/company-settings/README.md` holds the extraction recipe |
| Toasts - `components/ui/Toast.tsx` is the reference every app copies | `Minty/docs/features/toasts.md` - the system-wide rule and the other three apps' copies |
| Manual QA checklist - a hand-run checklist over every feature above, to run before a release | [qa-checklist.md](qa-checklist.md) |
| Required fields: the red `*`, the `aria-required` half, where it deliberately does not appear, and the card-expiry bug fixed with it | [required-fields.md](required-fields.md) |
| The legal documents: the Terms of Use and Privacy Policy, their versions and pinned fingerprints, the renderer, the public pages, and the split with Flask | [legal.md](legal.md) — Minty's `docs/features/legal-terms.md` holds the consent record's half |

Running it: `npm run dev` on 3000 with `.env.local` (the three URLs in
`.env.example`); tests `npm test` (Vitest, 29 on 2026-09-21) and `npm run test:e2e` (Playwright,
stack up — `e2e/README.md`). Skeletal by decision: a new design replaces `components/` later
without touching `api/`, `hooks/` or the tests.

Email fields take English only (2026-10-01): every editable email input (the transfer invite,
the billing-account email in 01-D and 08-C, My Profile) spreads `useEmailInput` from
`lib/emailInput.ts`. It is `type="text" inputMode="email"`, not `type="email"`: the browser's
email input let Hangul through after the "@" and reported it as punycode. Anything outside
printable ASCII is dropped (after an IME composition ends, never during), the field says
"Email can only contain English letters, numbers and symbols.", and `isEmail` refuses it too.
The APIs refuse it again. Copies of the file live in minty-payment-request-web, minty-onboarding-web and the landing
page, and Flask's twin is `static/js/email_input.js`: change them together.

Two faces, and the line between them (2026-10-12). **Inter** is this app's body face, loaded
through `next/font` in `app/layout.tsx` and bound to `--font-sans`. **Plus Jakarta Sans** is the
brand face and is for the Minty NAME ONLY — the lockup, the name standing as the mark in a bar,
never a word inside a sentence, a headline or a plan name, which stay Inter so copy is not broken
up to re-typeset one word. Every lockup drawn as text goes through `components/ui/Wordmark.tsx`,
which owns the treatment (`font-brand`, weight 700, `-0.005em`) — the same values as
minty-onboarding-web's `.topbar .brand`, the system's other text lockup; change the two together.
A lockup drawn as an image (`SideMenu`'s `minty-logo.svg`, `AppHeader`'s `showLogo`) needs none of
it. Both `--font-*` tokens are declared inside `@theme`, not `:root`: `--font-*` is Tailwind's own
theme namespace, so a token declared only in `:root` generates no utility and `font-sans` would
quietly fall back to Tailwind's stack instead of Inter. The marketing site (`minty-www`) is the
one deliberate exception to all of this — Plus Jakarta Sans is its body face throughout.

This `@theme` block is the **canonical copy for all four frontends** since the mechanism was
unified (2026-10-12): minty-payment-request-web and minty-onboarding-web carry it byte for byte,
and minty-www carries the same stacks through its Tailwind v3 `tailwind.config.ts`. Change them
together, until `@minty/shared` takes the tokens at Part 3 step 4. Three things that block is
deliberately missing: a `--font-mono` (nothing uses the mono utility, and Tailwind's own default
keeps it genuinely monospace, so a future `<pre>` renders right — aliasing it to the sans stack
would have broken that silently). Write "the mono utility" rather than the bare class name
anywhere in this repo, including in these docs: Tailwind v4's source detection scans Markdown and
CSS as well as components, so naming the class even in prose is enough to make it generate the
utility. It is also missing an emoji tail (no frontend has an emoji in its source, and
browsers find an emoji font by last-resort fallback regardless), and any Google Fonts `<link>`:
every face is self-hosted via `next/font`, which is what supplies the metric-matched fallback
(`src: local(Arial)` plus `size-adjust`) so text does not reflow when the webfont arrives. The two
`fonts.googleapis.com` URLs that remain are Stripe's `cssSrc` (`features/subscription/lib/stripe.ts`
and onboarding's `BillingSheet.tsx`), fetched inside Stripe's cross-origin iframe, which cannot see
our `@font-face`.

Keep these current: when a route, a rule or a test named here changes, change the line that
names it in the same commit. `subscriptions.md` §8 says which step fills which part; move a row
out of it when the step lands.
