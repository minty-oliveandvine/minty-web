# My Profile (`features/profile`)

The person's own page (Figma 10-A / 10-B, `43YI3MYtTfX5Xzz6dRoRuT` 1410:3314 / 1410:3364),
moved from billing-frontend on 2026-09-29 with the new design, and drawn in two places - one
body (`components/ProfileBody.tsx`), so the two cannot drift:

- **the sidebar's My Profile** (`routes/ProfilePanel.tsx`) on every page of this app - the user's
  call, 2026-09-29: one sidebar, two views (`components/ui/Sidebar.tsx`). It slides over the page;
  nothing navigates. 440 px wide from 640 px up (10-A is drawn at 375; widened at the user's
  word so an ordinary email shows whole), the whole screen on a phone. It never scrolls
  sideways: beside the caped cat, the company name keeps 74 px clear on both sides and wraps
  (the cat once hung past the edge under a long name);
- **the `/profile` page** (`routes/ProfilePage.tsx`) - for the other apps, until they carry the
  sidebar themselves (the payments app through `@minty/shared` at Part 3 step 4, then Flask's
  pages). A phone gets it as drawn, a wider screen the same column centred at up to 560 px.

## How a person gets here

- **The header's initials** open the sidebar on My Profile; **the menu's name** (the avatar and
  the name at its top) switches to it; the panel's ‹ goes back to the menu, its × closes the
  sidebar. On the `/profile` page itself the menu's name only closes the sidebar - that page IS
  the profile. The panel is mounted only once asked for, so nothing is read before then.
- **Minty's `/profile`** (`blueprints/entity/routes/modules.py::open_profile`) — every "open my
  profile" link in Minty's ~20 page headers and in the payments app goes through it, and it
  decides: minty-web's `/profile` page when `MINTY_WEB_HUB` is on, billing-frontend's otherwise.
  `?entity_id=` scopes it to the company it was opened from, `?from=bills` sends the back arrow to
  the payments app. The page's titlebar is sticky (2026-09-29, the user: every header in
  minty-web stays put while the page scrolls).

## What it shows

Opened inside a company (the cookie names one): the company, its plan under it — "Payment
Request" in its blue, "Petty Cash" in its amber (`#ea9713`, the pair the subscription screens
draw the two modules in), or "SuperMinty" in teal with the caped cat for both — and the person's role there
("Shop Manager"). Opened from the entity list there is no company, so none of the three is
shown. Then the avatar and the name; the details card (first name, last name, email, PASSWORD ·
Change); the subscription feature's "Subscriptions Overview" in the page's slot; Log Out.

All of it is one read: Flask's `GET /api/me/profile[?entity=<id>]`
(`blueprints/user_management/routes/me_api.py`) — identity is Flask's until minty-accounts-api
(Part 3). A company the person may not see is a 403, and only the cookie's company is ever asked.

## Editing

_Edit_ turns the names and the email into fields in the same card (_Cancel_ puts them back);
_Save_ sends only what changed as `PATCH /api/me/profile`, and the answer is the fresh profile.
The rules are billing-backend's, ported to Flask (`services/profile.py`): an emptied email is
refused here first ("We'll need an email here."); Flask refuses a malformed or taken address in
its own words, shown in the card with what was typed; the sign-in username moves with the email
only when it WAS the email. After a save the header and the side menu show the new name at once
(`primeViewer`) — billing-frontend's badge kept the old initials until the next token.

**Decided by the user, 2026-09-29:** PASSWORD · _Change_ opens the Xero account page, as the old
profile did (most people sign in with an email code or with Xero, and Minty holds no password
for them). "Sign out of Minty for good" is NOT on this page — but its APIs stay (Flask
`DELETE /minty/api/users/me`, billing-backend `DELETE /api/v1/profile/me`).

## The slot, and why it is a slot

"Subscriptions Overview" is the subscription feature's `SubscriptionsOverviewCard` — 08-A's own
figures over the same read (`lib/billing.ts::overview`), so the profile and the portal never
disagree; _Manage Subscription_ goes to 08-A; paying for no company it is 10-B's quiet card;
switched off (or the API dark) it is not there at all. The profile cannot import it (the
boundary rules), so the shell composes the two - in `app/profile/page.tsx` for the page and in
`app/layout.tsx` for the sidebar - the only two files where features meet (both pinned by
`__tests__/reexports.test.ts`).

## Log Out and the way back

_Log Out_ is the side menu's Logout (`lib/logout.ts`): the token goes, and Minty's `/logout`
ends the session everywhere. On the page, the back arrow goes to the payments app
(`?from=bills`), to the company it was opened from (Minty's module selector), or — opened from
the list — to the list; in the sidebar, ‹ is the menu.

## Tests

`features/profile/__tests__/` (the rules, the screen: head, card, edit, refusal, slot, Log Out;
the panel in the sidebar; the two composition guards), `components/ui/__tests__/Sidebar.test.tsx`,
`features/subscription/__tests__/SubscriptionsOverviewCard.test.tsx`, Playwright
`features/profile/e2e/08_profile.spec.ts` (the page, and the sidebar from both doors). Flask's
side: Minty's `tests/test_hub_profile.py`.
