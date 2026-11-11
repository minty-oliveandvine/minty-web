# A company's settings (`features/company-settings` and the shared chrome)

Every company setting lives in this app since 2026-11-10 (owner), on one page with six tabs
(Figma `LGkVZqcyxSIh6pp5ihDjXw`, section 353:999 - the frames are the visual design; behaviour
follows the rules below):

| Tab                                   | Address (`/entity/<shortid>/<name>/settings/…`) | Feature                                                                           |
| ------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| Users                                 | `users`                                         | `features/company-settings`                                                       |
| General                               | `general`                                       | `features/company-settings`                                                       |
| Integration                           | `integration`                                   | `features/company-settings`                                                       |
| Petty Cash Settings (Petty Cash on)   | `petty-cash`                                    | `features/petty-cash-settings` ([petty-cash-settings.md](petty-cash-settings.md)) |
| Payment Settings (Payment Request on) | `payment`                                       | `features/payment-settings` ([payment-settings.md](payment-settings.md))          |
| Module & Subscription                 | `modules`                                       | `features/subscription` ([subscriptions.md](subscriptions.md) §9)                 |

Users and the old Entity & Integration came from Flask's Jinja pages in phase 2 (2026-10-05); on
2026-11-10 Entity & Integration split into General and Integration, and Petty Cash Settings and
Payment Settings moved in from minty-petty-cash-web and minty-payment-request-web, whose old
addresses now only redirect. accounts-api is the backend for this feature (`/api/me/company/*`,
`hub/company.py`).

## Getting here

- The tab row, from any tab (`lib/settingsTabs.ts`; a module's tab hides when the module is off -
  the page's own module list once loaded, the token's claims until then).
- The side menu's Settings opens General (`companySettingsPath`'s default, `lib/hubPaths.ts`); the
  module choice's "no module" link opens Module & Subscription.
- From the other apps and old links: accounts-api's `/entity/<co>/settings/users|general|
integration|petty-cash|payment-request|modules` hand over here with a token scoped to the company
  (`hub/redirects.py` `_to_hub_tab`; `payment-request` lands on the `payment` tab). Whatever it
  flashed on the way travels signed in `?flash=` and is shown once as a toast - how a Xero
  connect's outcome arrives on Integration. `?xero_conflict=` rides along the same way when that
  connect was refused because another company holds the organisation.
- The company comes from the address (`components/ui/CompanyFromAddress`); every accounts-api call
  names it with `?entity=`, and accounts-api checks it is one of the person's.

## The page (`components/ui/SettingsPage.tsx`, `SettingsShell.tsx`, `SettingsTabs.tsx`)

The app's bar (Back, "Settings", the initials, the menu), then an 880px column: the company's name
(13px, muted), "Settings" (28px bold, an h2 under the bar's h1), the tab row - plain tabs on a
hairline, the open one underlined in teal and bold (`aria-current="page"`) - and the tab's cards.
On a phone the tab row scrolls sideways inside itself (never the page) and starts scrolled so the
open tab is in view. Every tab is a plain link to this app's page, so the leave guard sees it.

The pieces every tab is built from (`components/ui/SettingsShell.tsx`): `SettingsCard` (white,
radius 14, the frames' edge; a region named by its title), `ReadOnlyNotice`, `LoadState` and
`SettingsDialog` (the frames' dialog: the #111313 scrim at 48%, radius 16, 460px, Escape and the
scrim close it unless busy, focus starts on its first button and returns to the opener).
Buttons: `components/ui/settingsButtons.ts` - `SETTINGS_PRIMARY` (the Minty Action fill
`#3CBCC3` with its teal shadow; hover `#35B2B9`, pressed `#2FA4AB`; disabled grey),
`SETTINGS_OUTLINE`, `SETTINGS_DANGER` (outlined red) and `SETTINGS_DANGER_FILL`; radius 12, 14px
SemiBold, at least 44px. Fields: `components/ui/settingsFields.ts`. Colours are tokens
(`--set-*`, `--action*` in `app/globals.css`), never a hex in a component. Inter stays the body
face (the frames' Plus Jakarta Sans is the wordmark's only, CLAUDE.md).

The browser tab names the tab and the company ("General - <company>", `SETTINGS_TAB_LABELS`,
`lib/companyTitle.ts`, re-exported as each route's `generateMetadata`).

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

## General (Figma SET-G)

The **Entity name** card - "The name people see for this company" - with the country and currency
under it (the frame draws only the name; General = name + country + currency, owner 2026-11-10).
The name is an admin's to change; the country and currency an accountant's and up; saved with
only what changed (`PATCH /api/me/company/integration`; the page model is Integration's,
`hooks/useIntegrationTab.ts`). **This is the one place the country and currency change after the
company is created** (owner, 2026-11-03; Petty Cash's Setup Required gate and the bill form's
no-currency line link here): a country sent alone brings its own currency, and the currency
rebuilds the company's notes and coins (`hub/cash_settings.py`). **Save changes** waits for a
change and says "No changes to save yet" beside it; a refusal stays under the form. An emptied
name is never sent: "The company name is still empty. Add the company name to continue." shows
under the field once Save is tried or the field is left, and goes as soon as the user types.
Read-only with the reason said above the card.

### Leaving with changes not saved (General)

An unsaved name, country or currency (and only where the viewer may change them) arms the leave
guard, `@minty/shared/leaveGuard`: every way out asks "Leave without saving?" first
(`components/ui/LeaveDialog.tsx`, Figma A-11) - _Discard changes_ puts the saved values back and
goes on, _Go Back_, Escape and the backdrop stay.

What it holds: the tab row, the header's Back and the sidebar's
links - all anchors, caught on `window` in the capture phase, so before their own handlers run -
and Back / Forward, which are soft navigations no `beforeunload` could catch (the guard keeps a
history sentinel for them). A reload, a typed address and a closed tab get the browser's own
prompt. Logout is a button rather than a link, so `components/ui/SideMenu.tsx` asks through
`guardLeave` instead; it has to, because `logOut` clears the token before it navigates.

A SUCCESSFUL save leaves the page clean, so nothing is asked after it. A refused one
does not: the typed values are still there, and still guarded. The draft and the dirty test live in
`hooks/useDetailsDraft.ts` - the form used to hold them and be remounted by a `key`, which the
guard could not see.

## Integration (Figma SET-1, SET-2, SET-2b)

The Xero card (`components/XeroCard.tsx`): the Xero mark, what the connection means and its pill;
under a hairline, Last connected ("01 Sep 2026", Hong Kong's day - `formatInstantDay`; "Never")
and the Xero organisation ("None yet"); then the one thing to do. Four states - two drawn in the
frames, two filling gaps they leave:

- **Not connected** (SET-1): "Not connected to Xero / Reports stay in Minty until you connect.",
  **Connect to Xero** (Reconnect when it was connected once), and "Prefer some help first? Our
  service team can set up the Xero connection with you." (plain text, as drawn - the Minty cat
  on every page is the way to ask; `@minty/shared` has no call to open its chat from a page).
- **Connected** (SET-2): "Connected to Xero / Reports and petty cash publish to <org> in Xero.",
  **Disconnect from Xero** (outlined red), which asks first (SET-2b): "Disconnect from Xero? /
  Minty carries on as normal — reports, petty cash, all of it. They just stop publishing to Xero.
  Your account matches are kept, so reconnecting later is quicker." Cancel / Disconnect. True since
  2026-11-10: a disconnect keeps the organisation, its chart, contacts and mappings
  (accounts-api `xero/services/disconnect.py`). The old dialog said they were cleared.
- **Disconnected** (filled in): `status` `disconnected` with the organisation kept -
  "Disconnected from Xero / Nothing is published to <org> until you reconnect.", **Reconnect to
  Xero**, nothing left to disconnect.
- **Reconnect needed** (filled in): still connected but Xero no longer accepts Minty's sign-in -
  "Xero needs you to sign in again", the same line, Reconnect and Disconnect.

Connect / Reconnect navigate to accounts-api's `/entity/<id>/enter?…&next=/xero_reconnect?entity_id=<id>`.
**Not built yet:** Figma's SET-1b ("One step before we connect") and the matching screens (frames
3, 3b, 4, 5) - a Minty-only company connecting needs account matching first, and today's connect
replaces its own accounts and contacts (Phase 2 of the settings plan).

### The organisation is already in use (2026-10-09)

One Xero organisation belongs to one company, so Flask refuses a connect that picks one another
company holds — the person's **own** other company included, which until 2026-10-09 connected
anyway and silently unlinked it (a plain success message, no error, and the other company lost
Xero with nobody told).

The refusal comes back with a toast AND `?xero_conflict=`, signed like `?flash=` and read once;
`/api/me/company/integration` answers it as `xero_conflict` (which company, the organisation's
name, and whether this person may free it). That raises **"That Xero organisation is taken"**
(`XeroConflictDialog`, the `ConfirmDialog` frame) — a dialog, not a toast alone, because the way
on is a real disconnect of another company and that is asked for:

- _**Move it here**_ (orange) → `POST /api/me/company/xero/release` with the **other** company's
  id, which Flask authorizes on that company (`XERO_SETTINGS_UPDATE` there) and leaves
  `disconnected`; then the browser goes back through `/xero_reconnect` for this one. Two steps,
  because the refused attempt's grant was handed back to Xero.
- **No permission there, or not development** → no _Move it here_ (Flask sends `can_move`
  true only when `APP_ENV=development`, and refuses the release elsewhere; owner, 2026-11-03),
  only "disconnect it from <company> first, then connect again" and _Close_.
- _**Go back**_, Escape and the backdrop change nothing, on either company.

A refused release stays **in** the dialog (`role="alert"`) and it stays open to retry — the
success case leaves the page, so a toast would not outlive it.

## Tests

`features/company-settings/__tests__/screens.test.tsx` (the chrome's six tabs; Users: each row's
offers, the address as text, a role change, a refused removal keeping its dialog, the invite, the
cooldown, the flashed notice; General: SET-G's card and "No changes to save yet", a save of only
what changed, the empty name, read-only, the leave guard's cases; Integration: SET-1, SET-2 and
SET-2b, the disconnected and reconnect-needed states, read-only, the refused connect and its
move), `__tests__/reexports.test.ts`, `lib/__tests__/settingsTabs.test.ts`,
`e2e/12_company_settings.spec.ts` (what only a real browser shows: the browser's own Back held by
the sentinel, the header's Back link, Disconnect from Xero, the tab row, and nothing wider than the
screen at 360 / 768 / 1440). The guard itself: `@minty/shared`'s `leaveGuard` tests. accounts-api's
side: `hub/tests/test_redirects.py` (the hand-overs), `hub/tests/` for `/api/me/company/*`.
