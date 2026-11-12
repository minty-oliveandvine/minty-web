# Petty Cash Settings (`features/petty-cash-settings`)

A company's **Petty Cash Settings** tab: its sales methods and how its petty cash reaches Xero (or
its own books). It moved here from minty-petty-cash-web on 2026-11-10 (owner: every company
setting lives in the hub), at `/entity/<shortid>/<name>/settings/petty-cash`, the fourth of the six
settings tabs (Figma 353:999; the chrome is `components/ui/SettingsPage.tsx`,
[company-settings.md](company-settings.md)). Behaviour and copy are the old page's - itself Flask's
ORIGINAL `entity/settings_entity.html` (Minty `1c25b35^1`); the host and the look changed. The tab
shows only when Petty Cash is on.

## Getting here

- The tab row, from any settings tab.
- accounts-api's `/entity/<co>/settings/petty-cash` hands over here (`hub/redirects.py`
  `settings_petty_cash`, gated on the CoA permission and Petty Cash being on) - what the Petty Cash
  app's old address (now a redirect), its dashboard's Entity Settings and Setup Required, and its
  sidebar's Settings reach (the last three through `/handoff/minty-web`).

## The API

minty-petty-cash-api, through `lib/apiClient.ts` `pettyCashFetch` (the module token's bearer; the
company is in the path - its door, `core/auth.py`, never reads a header, wants `module ==
"billing"`, and answers 409 for a company still onboarding). `PETTY_CASH_API_URL` (`lib/env.ts`;
local `http://localhost:8010`); the API lists the hub in its CORS origins (`MINTY_WEB_URL` in its
default since 2026-11-10; development's override in minty-infra lists `dev-my`). Every path is
under `/api/petty-cash/v1/companies/<entity_id>/` (`api/pettyCashSettings.ts`): `GET /settings`,
`GET /settings/xero`, `POST`/`PUT`/`DELETE /sales-methods...`, `PUT /sales-methods/order`,
`PUT /settings/xero/mapping`, `PUT /settings/xero/account-codes`, `POST /suppliers`.

## The cards

Each card is a `SettingsCard` (a region named by its title), folding under a 44px chevron;
buttons, fields and colours are the settings frames' (`settingsButtons`, `settingsFields`, the
`set-*` tokens). The searchable pickers (account by name or code, "+ Other", "+ Add '<name>' as a
new contact") are this feature's own (`components/parts.tsx`) - `MintySelect` has no search. The
mapping's five group headings are h4 (the card title is h3). The view-only notice shows when the
person may change nothing; a card they cannot change is grey with its controls off.

- **Electronic and Delivery**, a card each: the methods in order; the name to click for a rename (Enter or leaving the box saves, Escape puts it back); a bin ("Delete <name>", the confirm below) and a drag handle ("Move <name>") on each row - drag a row onto another to reorder (`placedIds`; the type's whole list goes to `PUT /sales-methods/order`), or the up and down arrow keys on the focused handle move it one place (owner, 2026-11-12: they replace the ⋮ menu; no Move up / Move down; the rows keep their plain look); **Add New Method** with the catalogue picker ("No matching payment method found", "+ Other (type a new name)" opening the Name box) and Cancel / Add.
- **The cards follow the business type (owner, 2026-11-11):** the API's `sales_groups` (from `entities.business_type`, as onboarding's step 5 groups them). `non_cash` - a retail shop, a service or a general business - shows one **Non-cash** card (the electronic list, titled "Non-cash", lead "Card, wallet and transfer payments a sales report can record.") and no Delivery card, unless Delivery still holds methods from before (then it shows, so they can be removed). `electronic_delivery` (Restaurant & Food, or a company onboarding never asked) and an answer without the key keep both cards (`lib/settings.ts` `shownTypes`/`kindFor`).
- **Delete asks first**, in the settings dialog (`SettingsDialog`, no Minty picture): "Delete Electronic Method", 'Are you sure you want to delete "<name>"? This action cannot be undone.', Go back / Delete.
- **Xero account mapping:** Flask's five groups in its order - Petty Cash Account, Deposit Bank Account, Cash Sales (account code, contact), Director Personal Account (account code, Director or Responsible person) and Discrepancy - Other Expense (account code, contact) - each picker under Flask's line ("Select Petty Cash bank account from Xero", ...), showing the saved choice as Flask did ("Petty Cash - 090", a contact by name). The pickers are Flask's searchable ones: an account by name or code, each row the name with its code under it, the bank chosen for the other bank field never offered. The Discrepancy Bank Account is not shown: it mirrors the Petty Cash Account and the API sets it. Then **Save Changes**.
- **A new contact** from any contact picker: "+ Add '<name>' as a new contact" (or "No Xero contact found" and "+ Add as a new contact"), Flask's New Contact box with the name in it, Cancel / **Create** ("Creating contact…", `POST /suppliers`, "That contact's added!"), and the new contact chosen - and offered in the other contact pickers.
- **Petty Cash Account Code** (under Xero account mapping since 2026-11-12, owner; it came after Delivery, as in Flask): the search ("Search account code"), "Select all" for the rows shown (mixed when some are ticked), each row "<code> - <name>" with Flask's tick, "No codes match your search.", "No account codes yet - ...", then **Save Changes**. At least one stays ticked: unticking the last says "Pick at least one account code." beside Save at once and Save goes off; the API refuses it too.
- **Xero isn't connected** (`live` false: never connected, disconnected or a dead token): both Xero cards keep their heading and show "Xero isn't connected. Connect it in Integration to set these up.", its link the hub's Integration tab - the one notice (`components/ui/XeroNotConnected.tsx`, the danger tint with the red link-off icon), shared with Payment Settings (owner, 2026-11-12: it was grey here).
- Each card folds under its heading.

What differs from Flask (kept from the old page):

- **A company keeping its books in Minty (Xero optional, 2026-11-10).** `GET /settings/xero` says `minty: true` for it, and both cards draw anyway: the mapping card is _Account mapping_ ("The accounts daily closing uses."), with only the five account pickers the API sends - its own accounts, no contacts, no "from Xero" in the lines - and the account codes are its own. Setup Required (only those five accounts for such a company, in onboarding's words) leads here, and a save clears it. The API's side is minty-petty-cash-api `docs/features/xero-optional.md`; tests `__tests__/xeroCards.test.tsx`.
- **The Xero cards save on their own.** Flask's one Save Changes saved the mapping and the ticks with everything else; here each Xero card has its own Save Changes (`PUT /settings/xero/mapping`, `PUT /settings/xero/account-codes`), on only once something changed. The answer is drawn and its sentence shown ("Xero account mapping saved.", "Account codes saved."). A refusal says the API's sentence as Flask's error toast and keeps the choices; a 422 also marks the fields it names in red ("Choose the <label>.", "Choose the <label> from the list.", the two banks being one). A 409 (not live, or not synced from Xero yet) says why.
- **The first mapping save stays here, like every save** (owner, 2026-11-11): its sentence ("Xero account mapping saved.") shows and the page stays; the answer's `first_save` is ignored. Flask's page (and this port until then) left for the Petty Cash dashboard, and the sentence was lost with the page, since a flash cannot cross apps.
- **The Xero read is asked once per page load** (it asks Xero on the server), apart from the other cards: they show at once, the Xero cards show Flask's skeleton until it answers, and a failed read says the API's sentence in both cards with Try again (none for a 403).
- **The mapping's own rules as it is filled in** (CLAUDE.md): nothing is red on open; a Save refused for empty fields says "Choose the <label>." under each, focusing the one field, or, with two or more, a summary at the top of the card that takes focus and links to each. The two banks being one is said at once. Flask toasted "Please select: ...". The pickers carry `aria-required` and a screen-reader "(required)"; Flask's mapping drew no red asterisks, so neither does this card.
- **A cashier sees the Xero cards read-only:** the choices and ticks, the pickers and ticks off, no Save (Flask showed a greyed one), no "+ Add" offer; the code search still works.
- **Left out:** Flask's "I couldn't refresh these lists from Xero just now" note (the API does not say when its refresh failed) and the account number under a bank (the API sends a bank's Xero code, not its masked number).
- **Each change is saved at once.** Flask held every change for one Save Changes at the bottom. The API takes one change a call, so an add, a rename, a move or a delete goes as it is made, the list is drawn from the API's answer, and its sentence shows as Flask's success toast ("Octopus added.", "Name saved.", "Order saved.", "Method removed. Reports that used it keep their amounts."). A refusal (403, 404, 409, 422) shows the API's sentence and keeps what was there.
- **No Country & currency card** (owner, 2026-11-03): the country and currency are set only on the General tab. minty-petty-cash-api's `PUT /settings/country` was removed with it, `GET /settings` carries no `country`, and the Xero-save right is `permissions.edit_xero`.
- **A name's own rules as it is typed** (CLAUDE.md): over the API's limit - 74 characters for a new method (its value name adds "_sales" within 80), 80 for a rename ("That name is too long. Keep it to 74 characters or fewer.", `ADD_NAME_MAX` / `RENAME_NAME_MAX`) - or already on that list in any case ("visa is already on the list."), said under the Name or rename box. An Add with no name says "The method's name is still empty. Type a name to add it." under the box. Flask only toasted, and checked names across both lists; the API checks one type's list, and so does the page.
- **A shared method says so at once.** A method another company has too (`shared` in the read) cannot be renamed (the API's 409), so clicking its name opens no box and says under it: "Other companies use Visa too, so it can't be renamed here. Delete it and add a new method instead." Flask let the person type, then refused on Save.
- **A person who may not see the sales methods** (no `view_sales_methods`) is told so in each card.
- **"Leave without saving?" (2026-11-11)** - as the hub's General and Payment Settings tabs: the mapping and codes cards each report their unsaved choices (`onDirty`), and one guard (`useLeaveGuard`, `LeaveDialog`) holds a link, Back or a reload while either card has some. "Discard changes" remounts both forms from what the API holds (`resetKey`). The sales methods save at once, so they never arm it.
- **Left out:** Flask's reveal of a collapsed card on a refused save.

## Known rough edges (from the old page, kept)

A company still onboarding (the door's 409) shows its sentence with no Try again, as a 403 does
(2026-11-11). Still open: an Add with nothing
picked says so as a toast, not under the field; a rename the API refuses closes the box and drops
what was typed; the view-only notice reads `permissions.edit_xero` from `GET /settings` while the
Xero cards read their own rights from `GET /settings/xero`; Cancel in the Add form is not off while
a call runs.

## Tests

`__tests__/settings.test.ts` and `__tests__/xeroCards.test.tsx` (the rules, ported),
`__tests__/screens.test.tsx` (the cards over a stubbed API), `__tests__/reexports.test.ts`;
`e2e/13_petty_cash_settings.spec.ts` (stubbed: the old `11_settings` spec but "the way in", plus a
fold, the 409 and no sideways scroll at 360 / 768 / 1440).
