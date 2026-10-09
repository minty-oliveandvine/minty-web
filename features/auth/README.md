# features/auth — sign-in

The sign-in page (phase 2, 2026-10-05): `/login` (log in, `?invite=&email=&fn=&ln=`), `/signup`
(make an account - its own route since 2026-10-09; `proxy.ts` 307s the old `/login?mode=signup`
there) and `/login/confirm` (the emailed code). Until then Flask's `/` + `/register` and
minty-onboarding-web's `/auth` + `/auth/confirm`; those forward here now. Flask stays the identity
behind it - this feature only talks to Flask's `/auth/email/*`, `/legal/*`, `/auth/notices` and
navigates to `/xero_auth`. The system-wide picture: `Minty/docs/features/authentication.md` §2.

```
index.ts        THE public surface: LoginPage, SignUpPage, LoginConfirmPage, AUTH_BASE_PATH,
                AUTH_SIGNUP_PATH
api/            signIn.ts - every Flask call (no bearer, no re-handoff; ApiError with Flask's sentence),
                flaskDestination (a verify's hand-off is followed only on Flask's origin), xeroSignInUrl,
                readNotices, inviteOwesTerms, signUpTerms (the live Terms for the read-to-agree panel)
hooks/          useSignInNotices - Flask's flashes from the way here (?flash=), as the hub's toasts
lib/            paths.ts (the mount, once), arrival.ts (the query, read once; `next` kept only as a
                path on the site), handover.ts (/login -> /login/confirm in sessionStorage; maskEmail)
components/     AuthShell (the bar with the mark, the narrow column, the form classes), CodeInput
routes/         LoginPages (the two mounted routes, Suspense), LoginScreen, ConfirmScreen
__tests__/      the re-export guard, LoginScreen, ConfirmScreen
```

Shared pieces it uses: `components/ui/TermsModal` (the Terms gate's panel, with `agree` and
`onCancel` for sign-up), `components/ui/Toast`, `lib/emailInput`, `lib/handoff.leaveTo`,
`lib/apiClient.ApiError`. `/login` is an open path (`lib/hubPaths.ts` `OPEN_PATHS`): no cookie,
no Terms gate.

**Extraction:** `git mv features/auth app/` in the accounts app, point `@/lib` and
`@/components/ui` at `@minty/shared`, and drop `/login` from this app's `OPEN_PATHS`.
