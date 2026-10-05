# Authentication — minty-web's half

This app **stores and forwards a token; it never mints or refreshes one.** Minty (Flask) signs
the person in — email OTP or Xero, on THIS app's sign-in page since phase 2 (below) — mints the module JWT (`_generate_module_token`, 30 minutes)
and hands it over in the launch URL; the system-wide picture is `Minty/docs/features/authentication.md`,
the verifying half `minty-subscription-api/docs/features/authentication.md`.

## The sign-in page (`/login`, `features/auth`, phase 2 - 2026-10-05)

Log in, sign up (`?mode=signup`) and invitations (`?invite=&email=&fn=&ln=`) on `/login`, the code
on `/login/confirm` - Flask's `/` + `/register` and minty-onboarding-web's `/auth` pages until
2026-10-05; those forward here (Flask's `hub_login_url`, onboarding's `next.config.ts`). The page
is a client of Flask's identity, nothing more: `POST /auth/email/request-code` (log-in mode asks
Flask to refuse an address with no account), `POST /auth/email/verify-code` (a new address's
account is made there, with the names and the Terms version agreed), and the verify's answer is
a one-shot hand-off URL on Flask's origin - followed only there - that sets Flask's session and
goes on to `next` (kept from Flask's `login_required` redirect, a path on Flask only) or the
list. Xero is a navigation to Flask's `/xero_auth`. Flask's flashes from the way here arrive
signed in `?flash=` and are read back from `GET /auth/notices`, shown as toasts. Sign-up and a
new invitee agree to the Terms on the gate's own panel (`components/ui/TermsModal`, `agree` =
keep the version shown, which then rides with verify). `/login` is an open path: no cookie, no
Terms gate. The invite token leaves the address bar on arrival; the handover to the code's page
is sessionStorage (`features/auth/lib/handover.ts`). Recipe: `features/auth/README.md`.

## The landing

`/landing?token=<jwt>&next=<path>&entity_id=<id>&entity_name=<name>` (`app/landing/page.tsx`).
Stores the three values in cookies (`lib/auth.ts`: `minty_token`, `minty_entity_id`,
`minty_entity_name`; `SameSite=Lax`, `Secure` on https, **max-age = the token's `exp`**, so an
expired session is caught by proxy.ts before a page renders) and `router.replace`s to
`next` — a path on this origin (`lib/safeNext.ts`, through `lib/handoff.ts::safeNext`), else the
entity list (`lib/hubPaths.ts::HUB_HOME`). Reached with no token it goes to Flask's re-handoff for `next`.
The rule refuses `//host`, any backslash and any control character before checking the
origin: until 2026-10-05 `/landing?token=x&next=/%5Cevil.com` (or `/%09/evil.com`) passed a
`startsWith("/")` check and landed on another site. minty-payment-request-web carries a copy of
the file - change both. Stripe.js is imported from `@stripe/stripe-js/pure`
(`features/subscription/lib/stripe.ts`), so it loads only when a card or address form needs
it - not on `/landing` while the token is still in the URL. Every response carries
`Referrer-Policy: same-origin`, `X-Content-Type-Options`, `frame-ancestors 'self'` and (in
production) HSTS (`next.config.ts`).

Two tokens arrive here: the **unscoped** one (`entity_id: ""`) from Minty's entity list for the
portal, and the **scoped** one from inside a company for its module settings page. Both are
stored the same way; the difference matters at the API (below) and in the portal's chrome (the
company's name, its modules in the drawer, the way out to its modules). The module settings
page's CTAs carry the scoped one into the portal's list; a result's _Back to Manage
Subscriptions_ **trades it for an unscoped one** (2026-09-29): `lib/auth.ts::isEntityScoped`
says the stored token names a company, and `lib/handoff.ts::redirectToHandoff(next)` - the
same re-handoff a lapsed token takes, asked with no `entity_id` - clears the cookies and has
Flask mint the payer's token, back through `/landing`. This app still mints nothing.

## The gate (`proxy.ts`)

**The cookie.** Every page but `/landing` and `/maintenance` (`OPEN_PATHS`, `lib/hubPaths.ts`)
needs `minty_token`. Without it: `307` to `PETTY_CASH_URL/handoff/minty-web?next=<page>` —
Flask's login-gated route (Minty's `/handoff/minty-web`, landed 2026-09-21) that mints the same token and comes back to
`/landing`. Silent while the Flask session (24 h) is alive; when it is not, Flask's
`login_required` sends the browser to this app's `/login` with that route as `next`.

There is no second gate. The subscription feature's dark switch (`NEXT_PUBLIC_SUBSCRIPTION_ENABLED`
and its `/not-available` page) was removed on 2026-10-01: subscriptions are simply on.

## Talking to Flask (`lib/apiClient.ts::mintyFetch`)

The entity list and My Profile read Flask's bearer routes (`GET /api/me/entities`, `GET` /
`PATCH /api/me/profile` - Minty's `blueprints/shared/hub_api.py`): the same bearer, the base
`PETTY_CASH_URL`, and never `X-Entity-Id` (Flask's CORS allows only `Authorization` and
`Content-Type`; a company travels as `?entity=`). A 401 re-authenticates keeping the cookie's
company - except for the header's initials (`lib/viewer.ts`, `onUnauthorized: "reject"`),
which are decoration and must never move the page. Flask refuses a token for a deactivated
account like a bad one.

## The Terms gate (`components/ui/TermsGate.tsx`)

Every page but the three open ones (`lib/hubPaths.ts::isOpenPath`) asks Flask, once per token,
whether the person owes a Terms & Conditions acceptance: `GET /api/me/terms` (`lib/terms.ts`,
Minty's `blueprints/legal/routes/hub.py`). Since 2026-09-29 Flask's `/entity` hands the browser
here whether or not one is owed, so this is where most people meet the Terms. Owed, the page is
`inert` behind `TermsModal` - Flask's panel (`templates/legal/_terms_panel.html`), ported as it
looks: the document scrolled inside its card, the tick box locked until the end is reached (4 px
of tolerance; a document that does not scroll unlocks at once), _Accept & Continue_ and _Cancel_.

- **A gate, not a dialog.** No close button, no click-outside, no Escape; focus stays inside.
  _Cancel_ is Log Out (`lib/logout.ts`) - someone who will not agree has nowhere else to go.
- **Accepting** posts `{accepted: true, terms_version}` - the version on screen - to
  `POST /api/me/terms/accept`. Flask runs its own panel's checks (`consent.accept_current_terms`)
  and records the row with the registry's fingerprint and `source = "hub"`. The gate lifts and
  the person stays on the page they are on. A **409** (the Terms changed while it sat open)
  reads them again: a new version is a new reading, unticked and locked. Any other refusal is
  said in the panel, and Accept can be tried again.
- **It fails open, as Flask's gate does.** A check that errors - Flask down, a 500, an answer it
  cannot read - shows the page and logs `Terms check failed: showing the page WITHOUT the Terms
  gate` to the console. The gate is a backstop here: entering a company still passes Flask's own
  gate, and the bearer APIs are not Terms-gated (Minty's gate only sees session requests).
- **The page behind still loads** (inert, hidden from assistive technology) - the trade Flask's
  own modal makes over its list.
- **Once per token.** An answer of "nothing owed", or an acceptance, is remembered for the token
  (`termsSettled`); a revamp reaches everyone within one token (30 minutes) of going live. The
  gate re-asks after a client-side move, because the landing stores the token and then moves on
  without a reload.

## Talking to the API (`lib/apiClient.ts`)

`Authorization: Bearer <cookie token>` on every call to `SUBSCRIPTION_API_URL`.
`X-Entity-Id` is **opt-in per call**: the payer portal (`/api/me/*`) is person-scoped and sends
none; the module settings page (`/api/entities/{id}/*`) names its company, because the token may
be the unscoped one when the page is reached from the portal — the same convention minty-payment-request-web
uses with minty-payment-request-api. A **401** clears the cookies and sends the browser to the re-handoff
for the current page, once (several requests fail together; one navigation). Nothing retries.

## What this app never does

- **Mint or refresh a token.** `jwt` is not a dependency; the only signing in the repo is
  `e2e/helpers.ts`, which mints the token Flask would, with the shared secret, for the browser
  tests. minty-payment-request-web's `refreshToken` was deliberately not ported.
- **Verify a token.** `lib/auth.ts::decodeJwtPayload` reads `exp` to size the cookie; the
  signature is the API's to check on every request.
- **Hold a company's data outside the cookie.** No local storage, no session; the three cookies
  are the whole client state, and clearing them is signing out of this app (Minty's session is
  untouched — signing out of Minty is done in Minty).

## Configuration

`PETTY_CASH_URL` (the re-handoff, sign-in's calls and "Back to Minty"), `SUBSCRIPTION_API_URL`,
`PAYMENT_REQUEST_WEB_URL` — all inlined at build time (`next.config.ts` `env`, read in `lib/env.ts`).

## Tests

`features/subscription/__tests__/apiClient.test.ts` (bearer, opt-in header, the 401 → one
redirect, the error sentence with its status), `components/ui/__tests__/TermsGate.test.tsx` (the
panel, the lock, accept, 409, refusals, Cancel, once per token, the open pages, failing open); in
the browser `e2e/01_landing.spec.ts` (no token → re-handoff; no cookie → re-handoff for that page;
the handoff stores a cookie that lives as long as the token; an unsafe `next` is ignored) and `e2e/09_terms.spec.ts` (the gate over the list in a real layout). Every other
spec arrives with the Terms answered "nothing owed" (`e2e/helpers.ts::handoff`). Flask's side:
Minty's `tests/test_hub_terms.py`. Sign-in: `features/auth/__tests__/{LoginScreen,ConfirmScreen}.test.tsx`
(log-in mode, sign-up with the read-to-agree Terms, the invitation, Xero, the flashes; the code,
the lockout, the hand-off refused off Flask's origin) and `features/auth/e2e/10_login.spec.ts`;
Flask's side `tests/test_hub_sign_in.py` and `tests/test_otp_identity_gate.py`.
