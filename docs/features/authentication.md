# Authentication — minty-web's half

This app **stores and forwards a token; it never mints or refreshes one.** Minty (Flask) signs
the person in — email OTP or Xero — mints the module JWT (`_generate_module_token`, 30 minutes)
and hands it over in the launch URL; the system-wide picture is `Minty/docs/features/authentication.md`,
the verifying half `minty-billing-api/docs/features/authentication.md`.

## The landing

`/landing?token=<jwt>&next=<path>&entity_id=<id>&entity_name=<name>` (`app/landing/page.tsx`).
Stores the three values in cookies (`lib/auth.ts`: `minty_token`, `minty_entity_id`,
`minty_entity_name`; `SameSite=Lax`, `Secure` on https, **max-age = the token's `exp`**, so an
expired session is caught by proxy.ts before a page renders) and `router.replace`s to
`next` — same-origin, absolute, not protocol-relative (`lib/handoff.ts::safeNext`), else
`/subscription`. Reached with no token it goes to Flask's re-handoff for `next`.

Two tokens arrive here: the **unscoped** one (`entity_id: ""`) from Minty's entity list for the
portal, and the **scoped** one from inside a company for its module settings page. Both are
stored the same way; the difference matters only at the API (below).

## The two gates (`proxy.ts`)

1. **The cookie.** Every page but `/landing`, `/maintenance` and `/not-available` needs
   `minty_token`. Without it: `302` to `NEXT_PUBLIC_MINTY_URL/handoff/minty-web?next=<page>` —
   Flask's login-gated route (Minty, Part 2 step 5) that mints the same token and comes back to
   `/landing`. Silent while the Flask session (24 h) is alive; a login when it is not. This app
   has no login form of its own.
2. **The switch.** `NEXT_PUBLIC_SUBSCRIPTION_ENABLED` off → `/subscription/*` and `/` go to the
   static `/not-available` page (`lib/env.ts`). The backends 404 in that state anyway; this keeps
   the doors out of sight.

## Talking to the API (`lib/apiClient.ts`)

`Authorization: Bearer <cookie token>` on every call to `NEXT_PUBLIC_BILLING_API_URL`.
`X-Entity-Id` is **opt-in per call**: the payer portal (`/api/me/*`) is person-scoped and sends
none; the module settings page (`/api/entities/{id}/*`) names its company, because the token may
be the unscoped one when the page is reached from the portal — the same convention billing-frontend
uses with billing-backend. A **401** clears the cookies and sends the browser to the re-handoff
for the current page, once (several requests fail together; one navigation). Nothing retries.

## What this app never does

- **Mint or refresh a token.** `jwt` is not a dependency; the only signing in the repo is
  `e2e/helpers.ts`, which mints the token Flask would, with the shared secret, for the browser
  tests. billing-frontend's `refreshToken` was deliberately not ported.
- **Verify a token.** `lib/auth.ts::decodeJwtPayload` reads `exp` to size the cookie; the
  signature is the API's to check on every request.
- **Hold a company's data outside the cookie.** No local storage, no session; the three cookies
  are the whole client state, and clearing them is signing out of this app (Minty's session is
  untouched — signing out of Minty is done in Minty).

## Configuration

`NEXT_PUBLIC_MINTY_URL` (the re-handoff and "Back to Minty"), `NEXT_PUBLIC_BILLING_API_URL`,
`NEXT_PUBLIC_SUBSCRIPTION_ENABLED` — all inlined at build time (`lib/env.ts`).

## Tests

`features/subscription/__tests__/apiClient.test.ts` (bearer, opt-in header, the 401 → one
redirect, the error sentence with its status); in the browser `e2e/01_landing.spec.ts` (no token →
re-handoff; no cookie → re-handoff for that page; the handoff stores a cookie that lives as long
as the token; an unsafe `next` is ignored; dark → not-available).
