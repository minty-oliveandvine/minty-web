# The entity list — "Select Company" (`features/entities`)

`/entities` — where a person picks a company, and the hub's first page (`/` and a landing with
no `next` go here). It replaced Minty's Jinja `/entity` on 2026-09-29, as Part 3 step 4's first
piece, pulled forward at the user's word. The contents are Flask's page, moved as they were (Figma
02, `43YI3MYtTfX5Xzz6dRoRuT` 1410:2898, draws the side menu over a screenshot of it); the frame
is the whole screen (the layout, below).

## How a person gets here

- **From Minty.** Flask's `GET /entity` (the page every login lands on, and the target of
  seventy-odd redirects) mints an unscoped token and sends the browser to
  `/landing?next=/entities` — whether or not the person owes a Terms acceptance: this app's
  Terms gate takes it (`authentication.md`). Always, since phase 2 (2026-10-05): the
  `MINTY_WEB_HUB` switch and Flask's own list are gone.
- **From this app.** The side menu's _Select Entity_, the portal overview's _Back to the entity
  dashboard_ when no company is in the cookie, the empty Manage Subscriptions list and `mintyEntryUrl`'s fallback all
  lead here (`HUB_PATHS.entities`).
- **A token minted inside a company** (the menu's Select Entity from a company page) is traded
  first for an unscoped one through Flask's re-handoff: a person choosing a company is in none,
  and every page after this one must stop describing the company just left.

## The layout (the user's calls, 2026-09-29)

Flask drew the list as a phone-shaped card fixed in the middle of the screen. Here:

- **The header bar spans the screen** (`components/ui/AppHeader`, `showLogo` + `centerTitle`):
  the Minty mark at the left, "Select Company" in the middle, the initials and the ≡ at the
  right. It stays put.
- **Under it, Flask's column in the middle** — its widths (640 px from 640, 768 from 1024, 1024
  from 1200; the whole width on a phone), its 24 px padding and its spacing: the doors in
  Flask's box (at least 160 px tall, 120 from 640 — taller than the picture, which is what leaves
  65 px above the search box, 76 on a phone), the search box, then the rows 24 px under it.
- **The screen scrolls as one** under the header, so the scrollbar is the screen's own right
  edge; **the search box stays** at the top while the rows scroll under it; the "+" is held to
  the screen's bottom-right corner.

Tried and dropped the same day: a grid of cards, then the rows in a 70% column — the user asked
for Flask's widths and spacing instead.

## What it shows, and where it comes from

One read: Flask's `GET /api/me/entities` (`blueprints/entity/routes/me_api.py`), the SAME
builder the Jinja list draws from (`services/entity_list.build_entity_list`); a superuser sees
every company. Flask sends them onboarding first, then most recently opened; minty-web re-sorts
(`lib/entityRows.sortRows`, user's choice 2026-10-05): "Setup in progress" first, then A→Z by
name (case-insensitive, "Scenario 2" before "Scenario 10"). Flask's own Jinja list keeps its order. Per card (`components/EntityCard`):
the "Setup in progress" pill, the name, the free-trial badge (the design's own tag, named
"Free trial: <modules>"), one badge per module that is on, the last-opened clock ("9 Jun 5:42
PM" in the viewer's zone, "By <name>" on hover, grey "Not opened yet" when nobody has) and the
chevron. Search is Flask's: case-insensitive, anywhere in the name. The "+" and the empty
state's _Create Entity_ go to Minty's `/entity/create` (the onboarding wizard).

**A card leads into its company** through Minty's `/entity/<id>/enter?token=…&next=/entity/<id>/modules`
(`lib/mintyEntry.ts::mintyEnterCompanyUrl`): `/enter` re-establishes the Flask session from the
token, and the module selector checks the membership, records the visit on the clock and picks
the module (or resumes the wizard for a company still in onboarding).

## What Flask flashed on the way

Seventy-odd Flask routes `flash()` a message and redirect to `/entity` ("I looked everywhere but
couldn't find that one", "you don't have permission to look there"). minty-web cannot read
Flask's session, so the redirect drains the flashes, signs them (`itsdangerous`, salt
`hub-flash`) into `/entities?flash=…`, and the API verifies them and answers `notices`. Each is a
toast, once; the spent `flash` leaves the URL. Forged or older than five minutes, it says
nothing (and Flask logs it).

Only flashes meant for this hop arrive. Flask drops the queue, and logs it, on any redirect into
another app (onboarding, minty-web, the payments app), because those apps never show it. Before
2026-10-02 onboarding's Xero connect flashed on every attempt. Finishing the wizard (→ `/entity`)
then opened this list under a stack of stale "Connected to Xero!" / "Connection failed" toasts.

## A company's module choice (`/entity/<shortid>/<name>`, phase 2 - 2026-10-05)

The address is SINGULAR, and so is everything under it (the settings tabs): it names ONE company.
It was the plural `/entities/<shortid>/<name>/…` until 2026-10-07 - `proxy.ts` 307s the old
form, so the links already out there still land. The plural `/entities` is the LIST alone, and
nothing lives below it (`HUB_PATHS.company` vs `HUB_PATHS.entities`, `lib/hubPaths.ts`).

Clicking a row goes through Minty's `/entity/<id>/enter` to its router, `/entity/<co>/modules`
(Minty `routes/modules.py::module_selector`): a company still onboarding resumes its wizard, one
module switched on goes straight into it, and **two come back here**, to "Choose Module Type"
(`features/entities/routes/ModuleChoiceScreen.tsx`) with a token scoped to the company. It was
minty-payment-request-web's `/module-selection` until 2026-10-05 and looks as it did: the mark,
the company, two doors (`components/ModuleChoiceButton.tsx`, Minty peeking out on hover). The
doors are the DATABASE's modules - the list's row, `GET /api/me/entities` - never the token's
claims; each enters its module through Minty's `/enter` (`lib/moduleChoice.ts`): Petty Cash's
dashboard, or `/entity/<id>/payment-request`, which mints the payments app's token. Opened some
other way (a bookmark), one module goes straight in and none says so with the way to the
Module tab; a failed read says so, logs it and offers Try again. The company comes from the
address (`components/ui/CompanyFromAddress`), a wrong name corrected in place. Header: Back
(where the person came from, else the list), the initials and the menu. The browser tab reads
"Choose Module Type - <company>" (`lib/companyTitle.ts`, as for the settings tabs -
`docs/features/company-settings.md`).

## The header and the sidebar

On the right of the bar, the person's initials (`components/ui/ViewerBadge`) and the ≡
(`components/ui/NavMenu`). Both open **the sidebar** (`components/ui/Sidebar.tsx`, the user's
call 2026-09-29: one sidebar, two views, over the page — nothing navigates):

- the initials open it on **My Profile** (`profile.md`) — their name still shows on hover. This
  reverses the morning's rule that the badge was not a button;
- the ≡ opens it on **the menu** (`components/ui/SideMenu.tsx`, the Figma 02 design on every
  page): the Minty mark; the person (avatar + name), which switches to My Profile; Select Entity;
  Manage subscriptions (only while subscriptions are on); inside a company only, its Petty Cash
  and Payment Request sections; the cat (Flask's `sidepanel_cat`), above the last group;
  Settings (inside a company only — never on this list) and Logout.

The initials and name come from Flask's `GET /api/me/profile`, read once per token
(`lib/viewer.ts`); the read is decoration, so a failure leaves the badge empty and never moves
the page.

## Tests

Module choice: `features/entities/__tests__/ModuleChoiceScreen.test.tsx` (the doors, one
module straight in, none, a failed read) and `features/entities/e2e/11_module_choice.spec.ts`
(the doors' addresses, a corrected name, one module, 360 / 768 / 1440); Flask's router:
Minty's `tests/test_module_selector.py`.

`features/entities/__tests__/` (the rules, the screen with its states and notices, the
re-export guard), `components/ui/__tests__/{NavMenu,Sidebar}.test.tsx`,
`lib/__tests__/{viewer,mintyFetch}`, Playwright `features/entities/e2e/07_entity_list.spec.ts`
(stubbed Flask; the layout is measured - Flask's widths, the 65 / 24 px, the search box that
stays). Flask's side: Minty's `tests/test_hub_entity_list.py`.
