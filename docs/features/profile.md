# My Profile (`features/profile`)

The person's own page (Figma 10-A / 10-B, `43YI3MYtTfX5Xzz6dRoRuT` 1410:3314 / 1410:3364),
moved from minty-payment-request-web on 2026-09-29 with the new design, and drawn in two places - one
body (`components/ProfileBody.tsx`), so the two cannot drift:

- **the sidebar's My Profile** (`routes/ProfilePanel.tsx`) on every page of this app - the user's
  call, 2026-09-29: one sidebar, two views (`components/ui/Sidebar.tsx`). It slides over the page;
  nothing navigates. 440 px wide from 640 px up (10-A is drawn at 375; widened at the user's
  word so an ordinary email shows whole), the whole screen on a phone. It never scrolls
  sideways: beside the caped cat, the company name keeps 74 px clear on both sides and wraps
  (the cat once hung past the edge under a long name);
- **the `/profile` page** (`routes/ProfilePage.tsx`) - for Minty's `/profile` router and the links
  that still use it. A phone gets it as drawn, a wider screen the same column centred at up to
  560 px.

**The other apps carry the sidebar since 2026-09-30** (the user's "build it now and transfer
later to shared"): minty-payment-request-web holds COPIES of `components/ui/{Sidebar,SideMenu,ViewerBadge,NavMenu}.tsx`,
`lib/viewer.ts`, this feature (without the page) and the Subscriptions Overview, at the same
paths, with everything app-specific in its `components/ui/sidebarHost.ts` - they are lifted into
`@minty/shared` at Part 3 step 4. Flask's pages carry a Jinja port (Minty
`docs/features/sidebar.md`), retired with them in Part 3. Until then a change here is a change
in all three. One difference by design: in those two apps the menu's **Settings** opens that
app's own settings (Flask's Petty Cash Settings, or the payments app's Payment Settings - the
user's call, 2026-09-30); here it stays the module settings page.

## How a person gets here

- **The header's initials** open the sidebar on My Profile; **the menu's name** (the avatar and
  the name at its top) switches to it; the panel's ‹ goes back to the menu, its × closes the
  sidebar. On the `/profile` page itself the menu's name only closes the sidebar - that page IS
  the profile. The panel is mounted only once asked for, so nothing is read before then.
- **Minty's `/profile`** (`blueprints/entity/routes/modules.py::open_profile`) — every "open my
  profile" link in Minty's ~20 page headers and in the payments app goes through it, and it
  decides: minty-web's `/profile` page when `MINTY_WEB_HUB` is on, minty-payment-request-web's otherwise.
  `?entity_id=` scopes it to the company it was opened from. The page's titlebar is sticky (2026-09-29, the user: every header in
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
The rules are minty-payment-request-api's, ported to Flask (`services/profile.py`): an emptied email is
refused here first ("We'll need an email here."); Flask refuses a malformed or taken address in
its own words, shown in the card with what was typed; the sign-in username moves with the email
only when it WAS the email. After a save the header and the side menu show the new name at once
(`primeViewer`) — minty-payment-request-web's badge kept the old initials until the next token.

**Decided by the user, 2026-09-29:** PASSWORD · _Change_ opens the Xero account page, as the old
profile did (most people sign in with an email code or with Xero, and Minty holds no password
for them). "Sign out of Minty for good" is NOT on this page — Flask's API stays
(`DELETE /minty/api/users/me`); minty-payment-request-api's `PUT|DELETE /api/v1/profile/me` and
`GET /api/v1/auth/me` were removed on 2026-10-01 with that app's profile page (the user's call,
reversing the "its APIs stay" of 09-29 for minty-payment-request-api only).

## The slot, and why it is a slot

"Subscriptions Overview" is the subscription feature's `SubscriptionsOverviewCard` — 08-A's own
figures over the same read (`lib/billing.ts::overview`), so the profile and the portal never
disagree; _Manage Subscription_ goes to 08-A; paying for no company it is 10-B's quiet card;
a read that fails (a 404 included) says so in the card, with _Try again_. The profile cannot import it (the
boundary rules), so the shell composes the two - in `app/profile/page.tsx` for the page and in
`app/layout.tsx` for the sidebar - the only two files where features meet (both pinned by
`__tests__/reexports.test.ts`).

## Log Out and the way back

_Log Out_ is the side menu's Logout (`lib/logout.ts`): the token goes, and Minty's `/logout`
ends the session everywhere. On the page, the back arrow returns to the page the person came
from, whichever app (`components/ui/BackLink.tsx`, `lib/backLink.ts`; no `?from=bills` since
2026-10-05); its `href`, for a new tab, is the company it was opened from (Minty's module
selector) or - opened from the list - the list. In the sidebar, ‹ is the menu.

## Tests

`features/profile/__tests__/` (the rules, the screen: head, card, edit, refusal, slot, Log Out;
the panel in the sidebar; the two composition guards), `components/ui/__tests__/Sidebar.test.tsx`,
`features/subscription/__tests__/SubscriptionsOverviewCard.test.tsx`, Playwright
`features/profile/e2e/08_profile.spec.ts` (the page, and the sidebar from both doors). Flask's
side: Minty's `tests/test_hub_profile.py`.
