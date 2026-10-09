# A company's Users and Entity & Integration tabs (`features/company-settings`)

Phase 2 (2026-10-05) moved these two of a company's settings tabs from Flask's Jinja pages to this
app, beside the Module tab: `/entity/<shortid>/<name>/settings/users` and `…/integration`. The
other two tabs stay in their apps (Petty Cash Settings in Flask, Payment Request Settings in the payments
app) - each app keeps its own settings. Flask is the backend (`/api/me/company/*`, Minty
`blueprints/entity/routes/hub_settings.py`; Minty `docs/features/entities-and-members.md` has the
rules) until `minty-accounts-api` exists.

## Getting here

- From this app: the pill row on any of the three tabs (`lib/settingsTabs.ts`).
- From Flask and the payments app: their old addresses, `/entity/<co>/settings/users|integration`,
  hand over here with a token scoped to the company (Flask `routes/settings.py::_to_hub_tab`).
  Whatever Flask flashed on the way travels signed in `?flash=` and is shown once as a toast - how
  a Xero reconnect's outcome arrives (Connect / Reconnect leave for Flask's OAuth and come back
  through that address).
- The company comes from the address (`components/ui/CompanyFromAddress`); every call names it
  with `?entity=`, and Flask checks it is one of the person's.

## Users

The members - initials, name, address, role, "You", and "Subscriber" on the person whose card pays
(only they, and only as an admin, can change the company's modules). Per row Flask says what this
person may do: change the role (a select offering the roles at or below their own) and remove
(asks first, `ConfirmDialog`; Flask refuses the payer, the last admin and a pending handover's
nominee in its own words). Names are not edited here - each person keeps their own in My Profile.
Invite (shop manager and up): an address (English only, `lib/emailInput.ts`), a role and the
person's first and last name - both required (a new invitee's account is made from them), in the
modal family's frame; Enter sends. Invitations waiting: Resend counts Flask's
cooldown down (`retry_after`), Cancel asks first. An address is drawn as text - the Jinja tab built
these cards with `innerHTML`, which let an invited address run script.

## Entity & Integration

The company's name (admins), country and currency (accountants and up), saved with only what
changed; Flask's refusal stays under the form. Read-only below that, with the reason said. The
Xero card: Connected / Reconnect needed (a grant revoked at Xero, or no token) / Not connected, the
organisation and when it was connected; Connect / Reconnect navigate to Flask's
`/entity/<id>/enter?…&next=/xero_reconnect?entity_id=<id>`; Disconnect asks first (it was one
click) and shows the new state.

### Leaving with changes not saved

An unsaved name, country or currency (and only where the viewer may change them) arms the leave
guard, `lib/leaveGuard.ts`: every way out asks "Leave without saving?" first
(`components/ui/LeaveDialog.tsx`, Figma A-11) - *Discard changes* puts the saved values back and
goes on, *Go Back*, Escape and the backdrop stay.

What it holds: the pill row, the header's Back, Connect / Reconnect to Xero and the sidebar's
links - all anchors, caught on `window` in the capture phase, so before their own handlers run -
and Back / Forward, which are soft navigations no `beforeunload` could catch (the guard keeps a
history sentinel for them). A reload, a typed address and a closed tab get the browser's own
prompt. Logout is a button rather than a link, so `components/ui/SideMenu.tsx` asks through
`guardLeave` instead; it has to, because `logOut` clears the token before it navigates.

A SUCCESSFUL save or disconnect leaves the page clean, so nothing is asked after it. A refused one
does not: the typed values are still there, and still guarded. The draft and the dirty test live in
`hooks/useDetailsDraft.ts` - the form used to hold them and be remounted by a `key`, which the
guard could not see.

## Layout and look

The Module tab's chrome (`components/SettingsShell.tsx`): `AppHeader` (Back, "Settings", the
company, the initials, the menu), the sticky pill row in a 1024px column, then Payment Request Settings'
cards. Members stack on a phone (name over role and actions), one line from 640px; every control is
at least 44px; nothing is wider than the screen at 360 / 768 / 1440 (`e2e/12_company_settings.spec.ts`).

The browser tab names the company (2026-10-05), as Flask's and Payment Request's do: "Users -
<company>", "Entity & Integration - <company>" (and the Module tab's "Modules - <company>"). The
words are the pills' (`SETTINGS_TAB_LABELS`, `lib/settingsTabs.ts`); the title is the server's
(`lib/companyTitle.ts`, re-exported as each page's `generateMetadata` on the route file's one
line): the company is the `minty_entity_name` cookie's when the address names that company, and
the tab says only the page while the address names another (the hand-off is on its way).

## Tests

`features/company-settings/__tests__/screens.test.tsx` (each row's offers, the address as text, a
role change, a refused removal keeping its dialog, the invite, the cooldown, the flashed notice; a
save of only what changed, read-only, the Xero card's states and Disconnect; the leave guard's
three cases - a pill and the Xero link asking, Go Back keeping what was typed, Discard changes
putting the saved value back, nothing asked after a save or of a viewer),
`__tests__/reexports.test.ts`, `e2e/12_company_settings.spec.ts` (and there what only a real
browser shows: the browser's own Back held by the sentinel, the header's Back link, and the dialog
at 360 / 768 / 1440). The guard itself: `lib/__tests__/leaveGuard.test.tsx` (which links are held,
which go straight through). Flask's side: Minty
`tests/test_hub_company_settings.py` (the company from one source, the four roles, addresses,
rank, the guards, the hand-overs).
