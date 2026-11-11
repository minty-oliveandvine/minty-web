# My Profile (`features/profile`)

The person's own profile (Figma 10-A / 10-B, `43YI3MYtTfX5Xzz6dRoRuT` 1410:3314 / 1410:3364),
moved from minty-payment-request-web on 2026-09-29 with the new design. **Since v0.6 its body is
`@minty/shared/profile`'s** (the owner, 2026-10-20: one implementation for every app, in two
designs - this branch draws the original, `look="classic"`); this feature keeps only its Flask
calls (`api/profile.ts` `profileApi`) and the panel that hands them to the package.

**My Profile is the sidebar's sheet and nothing else** (`routes/ProfilePanel.tsx`) on every page
of this app - the user's call, 2026-09-29: one sidebar, two views (`components/ui/Sidebar.tsx`).
It slides over the page; nothing navigates. 440 px wide from 640 px up (10-A is drawn at 375;
widened at the user's word so an ordinary email shows whole), the whole screen on a phone. It
never scrolls sideways: beside the caped cat, the company name keeps 74 px clear on both sides
and wraps (the cat once hung past the edge under a long name).

**No `/profile` page (the owner, 2026-11-03):** the full-screen page that used to sit beside the
sheet is gone, with its titlebar, back arrow and dev-only `?fixture=` switch; `/profile` is a
plain 404 (no redirect). The package's sidebar falls back to a link only when no sheet fills its
slot, and that fallback (`components/ui/sidebarHost.ts` `links.profile`) is the entity list -
`app/layout.tsx` always fills it.

**History - the other apps carried copies from 2026-09-30** (the user's "build it now and transfer
later to shared"): minty-payment-request-web holds COPIES of `components/ui/{Sidebar,SideMenu,ViewerBadge,NavMenu}.tsx`,
`lib/viewer.ts`, this feature (without the page) and the Subscriptions Overview, at the same
paths, with everything app-specific in its `components/ui/sidebarHost.ts` - they are lifted into
`@minty/shared` at Part 3 step 4. Flask's pages carry a Jinja port (Minty
`docs/features/sidebar.md`), retired with them in Part 3. Until then a change here is a change
in all three. One difference by design: in those two apps the menu's **Settings** opens that
app's own settings tab - the hub's Petty Cash Settings or Payment Settings since 2026-11-10 (the
user's call, 2026-09-30); here it opens General.

## How a person gets here

- **The header's initials** open the sidebar on My Profile; **the menu's name** (the avatar and
  the name at its top) switches to it; the panel's ‹ goes back to the menu, its × closes the
  sidebar. That is the only way in, on every page. The panel is mounted only once asked for, so
  nothing is read before then.
- **Minty's `/profile`** (`blueprints/entity/routes/modules.py::open_profile`), which older
  "open my profile" links still reach, hands off to minty-web's entity list (`/entities`) since
  2026-11-03, where the initials open the sheet. It no longer opens a profile page here.

## What it shows

Opened inside a company (the cookie names one): the company, its plan under it — "Payment
Request" in its blue, "Petty Cash" in its amber (`#ea9713`, the pair the subscription screens
draw the two modules in), or "SuperMinty" in teal with the caped cat for both — and the person's role there
("Shop Manager"). Opened from the entity list there is no company, so none of the three is
shown. Then the avatar and the name; the details card (first name, last name, email - no PASSWORD
row since 2026-10-20); the subscription feature's "Subscriptions Overview" in the sheet's slot; Log Out.

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

**No PASSWORD row (the owner, 2026-10-20):** Minty holds no password - people sign in with an
email code or with Xero - so the row that opened the Xero account page (the user's call of
2026-09-29) is gone, in both designs. "Sign out of Minty for good" is NOT on this page — Flask's API stays
(`DELETE /minty/api/users/me`); minty-payment-request-api's `PUT|DELETE /api/v1/profile/me` and
`GET /api/v1/auth/me` were removed on 2026-10-01 with that app's profile page (the user's call,
reversing the "its APIs stay" of 09-29 for minty-payment-request-api only).

## The slot, and why it is a slot

"Subscriptions Overview" is the subscription feature's `SubscriptionsOverviewCard` — 08-A's own
figures over the same read (`lib/billing.ts::overview`), so the profile and the portal never
disagree; _Manage Subscription_ goes to 08-A; paying for no company it is 10-B's quiet card;
a read that fails (a 404 included) says so in the card, with _Try again_. The profile cannot import it (the
boundary rules), so the shell composes the two in `app/layout.tsx`, for the sidebar - the only file where
features meet (pinned by `__tests__/reexports.test.ts`, which also holds that there is no
`app/profile`).

## Log Out and the way back

_Log Out_ is the side menu's Logout (`lib/logout.ts`): the token goes, and a top-level form
POST to Minty's `/logout` (`postNavigate` in `lib/handoff.ts`; a GET answers 405, and a
`strict-origin` referrer meta keeps the `Origin` it checks) ends the session everywhere. In the sheet, ‹ is the menu and × closes the sidebar, leaving the
person on the page they were on - the sheet never adds a history entry, so it is not part of
`lib/backLink.ts`'s settings area.

## Tests

`features/profile/__tests__/` (the panel in the sidebar; the composition guard, and no
`app/profile`), `components/ui/__tests__/Sidebar.test.tsx` (the sheet on any address, and the
no-sheet fallback to the list), `features/subscription/__tests__/SubscriptionsOverviewCard.test.tsx`;
the body's head, card, edit, refusal and Log Out are `@minty/shared/profile`'s, tested there.
Playwright `features/profile/e2e/08_profile.spec.ts`: the sheet from both doors, at desktop and
phone widths; 10-A inside a company (its name, plan and role, the details, no PASSWORD row, the
overview's Manage Subscription); opened from the list with no company named; an edit saved in
place, with the menu naming the person anew; and `/profile` answering 404. Flask's side: Minty's `tests/test_hub_profile.py`.
