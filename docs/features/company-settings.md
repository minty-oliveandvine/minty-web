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
  the page's own module list once loaded, the token's claims until then). **Users hides below shop
  manager** (owner, 2026-11-12; `seesCompanyUsers`, from the token's `role`): accounts-api refuses
  a cashier the list. A token naming no role keeps it, Minty staff visiting see it, and its own page
  keeps its tab.
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
**Scrolling (owner, 2026-11-12):** the page scrolls with the document under the sticky bar - the
frame no longer locks the window and scrolls inside `<main>` (that drew a second page scroll bar).
A long account-code list (Petty Cash Settings' codes, Payment Settings' codes) scrolls in its own
box, at most `min(24rem, 50vh)`, with Select all pinned on top; search still narrows it.

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
person may do: change the role (a select offering the roles below their own, plus Admin for an admin - accounts-api's rule) and remove
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

### Matching a Minty company's accounts to Xero (Settings Phase 2, 2026-11-11; SET-1b, frames 3-5)

A company that keeps its books in Minty (`setup_mode` `minty`, `own_accounts` > 0 in the read) is
asked first: **Connect to Xero** opens SET-1b, "One step before we connect / Your accounts live in
Minty, so we don't know where each one belongs in Xero yet. After you sign in we'll ask you to match
them up - N rows, a couple of minutes." Not now / **Sign in to Xero** (the same `/xero_reconnect`).
Its connect never mirrors (accounts-api `xero/services/matching.py`): it lands on
`/settings/integration/match` (`routes/MatchingScreen.tsx`, `CompanyMatchingPage`). While it isn't
finished (`matching.accounts`, or after Finish `matching.contacts`) the card is a fifth state,
**Matching isn't finished** / "Your accounts stay in Minty until you finish matching them to Xero.",
pill Matching, **Continue matching**.

The page (frame 3, under "Connect to Xero"): the progress ("N of M matched", "K to go", a bar, and
either "K accounts your records use still need a Xero match before you can finish." or that the
blank ones aren't used and will be archived), every own account by group ("Cash & bank · 1 of 2
matched"), each with its Xero account (a native select of the accounts that fit: a bank only a bank,
else the same class; "Choose a Xero account"). Rows show **Needed** when a record uses them and they
have no match (the house red `*` on the name, "(required)" for a screen reader, and frame 3b's
orange select), a same-code other-type conflict or "Combined with …" under the name, and a tick once
matched; a suggestion leads the select in its own "Suggested" group. The select is the frames' compact
one with its own chevron (44px on a phone, 36px for a pointer). The page scrolls as one document (the
header is sticky). Petty cash and the bank can't share a Xero account (refused with its sentence).
Each pick saves at once (`PATCH /api/me/company/xero/matching`), so the page can be finished later;
**Refresh from Xero** pulls an account made there meanwhile. **Finish** stays off, its reason beside
it, while a used account has no match (the owner's rule; frame 3b's "Finish anyway" is not built),
and asks first: "Finish matching? / Each matched account takes its Xero code and name, and Minty
publishes to Xero from today. This can't be undone." with what is archived and combined. Then
"Bringing your contacts over…" (frame 4); connected, it goes back to Integration ("Connected to
Xero."); contacts Xero refused are named (frame 5: "N contacts didn't make it over / Your account
matches are saved. Xero would not take these:" … Later / **Try again**), and the company stays
disconnected until they are through. On a phone each row stacks (name over its select). Tests:
`__tests__/matching.test.tsx`.

**Phase 3 (owner, 2026-11-12).** The card's Matching state names why the matching is open (the
accounts API's `matching.reason`): "Your new Xero organisation needs your accounts matched."
(`new_org`), "Some accounts were added while Xero was disconnected. Match them to finish reconnecting."
(`new_accounts`), or **Changing your matches** with **Continue changing** (`change`; publishing goes
on). A connected company's card offers **Change matches** (`XERO_SETTINGS_UPDATE`): it starts the
change (`POST .../xero/matching/change`) and opens the same page, every account on its current Xero
account, with **Cancel** beside Finish. The page's heading, lead and Finish confirm follow the reason:
"Only records published from now on use the new matches" (`change`, `new_accounts`), "Only records
from today go to <organisation>. Older records stay with your previous Xero organisation." (`new_org`).
Tests: `features/company-settings/__tests__/matching.test.tsx`.

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

## General: the chart of accounts and contacts (`components/ChartSection.tsx`, `ChartCards.tsx`)

On **General**, under the company's details (owner, 2026-11-12: its own tab first, merged into
General the same day so the tab row fits): the company's chart of accounts and its contacts,
added, edited and deleted in one place. General's view-only line covers it (the same roles).

### Where the work is done

The page calls accounts-api's company door - `GET/POST /api/me/company/accounts`,
`PATCH/DELETE /api/me/company/accounts/<id>`, the same for `contacts`, the company as `?entity=` -
which checks the person and hands the work to minty-onboarding-api, the ONE implementation of a
company's accounts and contacts (the owner's choice that day; its `docs/features/wizard-api.md`).
Each read carries `permissions` (`add`, `edit`, `delete`): the page draws its buttons from them,
never from a role. Viewing is cashier and up; changing is accountant and up.

### The rules the page shows

- **Every row is the company's own copy, to edit and delete** (owner, 2026-11-12): the accounts and
  contacts it made, those from its Xero, and its copies of Minty's starter chart and template
  contacts - marked **Comes with Minty** (`source` `template`), a label of where they came from.
  Minty's own list is never touched. Only the hidden system accounts daily closing needs stay out of
  the list.
- **With or without Xero.** A company live on Xero gets every change there first ("Your change is
  made in Xero too"); when Xero says no, its reason shows under the field or as a toast, and
  nothing changes. Without Xero the changes are the company's own; a row already linked to Xero
  waits for a reconnect (the API's sentence).
- **Add an account** works as Petty Cash Settings' Add New Method (owner, 2026-11-12): an
  **Account** dropdown of Minty's accounts (`minty_accounts` in the read: the starter chart for the
  company's country, every business type's, one per name, less the hidden system rows and any the
  company has) with "Type an account name to add a new account" on top as it opens. One picked is
  shown with its code, type and description (no other line - owner, 2026-11-12), and added as it
  is - Minty's copy, the company's to change from then on (`POST {template_id}`). A typed name that isn't there offers "+ Add
  '<name>' as a new account", which opens the fields for the company's own: Type, then Code - the
  next free code for the type filled in ("478 is the next free code for Expense. You can change
  it."; it follows the type until the person types a code) - Name (the typed name), Description.
  Nothing picked says "Pick one of Minty's accounts, or type a name to add your own." The dropdown
  is `components/ui/Combo` - Petty Cash Settings' picker, shared since that day. **Rename** a
  contact; **Add a contact**.
- **Checked as typed** (`lib/rules.ts`, the API's own words): too long, a bad character, a code or
  name already taken; an empty field says so only after a refused Save. Required fields carry the
  red asterisk and a screen-reader "(required)".
- **Add and Edit open inline** at the top of their card, above the search and the list - no dialog
  (owner, 2026-11-12, as Petty Cash Settings' Add New Method); the card's Add button hides while
  the form is open; Cancel or Escape closes it.
- **Deleted, then added again** (the same account code, name and type, or the same contact name):
  the deleted one comes back - in Xero too - with "<name> is back.", never a second one.
- **Delete asks first**: "Delete <name>?" - "This can't be undone.", plus "Records that already
  use it keep it, but it leaves every list." when it will be archived, and "It's archived in Xero
  too." when it is linked.
- **A view-only person** sees both lists and "You can see these, but only an Accountant or an
  Admin can change them."
- Each list has a search; a long list scrolls in its own box (at most `min(28rem, 60vh)`), the
  account groups' headings pinned as it scrolls.

### Tests

`features/company-settings/__tests__/` - `chartRules`, `chart` (the lists, the locks, add with the
next code, a refused Save's field sentence, delete's confirm, a contact's taken name, view-only, a
failed read); e2e `13_chart.spec.ts`.
