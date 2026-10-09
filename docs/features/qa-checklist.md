# Manual QA checklist — minty-web

A manual walkthrough checklist for the hub (`minty-web`), to run alongside the automated suites
named in each feature doc's own `## Tests` section (`authentication.md`, `entities.md`,
`profile.md`, `company-settings.md`, `subscriptions.md`). This is not a replacement for those —
it exists for exercising the app by hand in a browser before a release, and for checking the
sharp edges the docs call out explicitly. Tick each box against a disposable test entity and a
disposable payer/billing account — **never a real one** (see "Billing Accounts is not a dry
run" below).

## Auth and the gate (`authentication.md`)

- [ ] No `minty_token` cookie on any page but `/login`, `/landing`, `/maintenance` → `307` to
      Flask's `/handoff/minty-web?next=<page>`.
- [ ] An expired token (cookie `max-age` = the token's `exp`) is caught by `proxy.ts` before the
      page renders — not by a failed API call.
- [ ] `/landing?token=x&next=/%5Cevil.com` (or `/%09/evil.com`) is refused, not followed — the
      pre-2026-10-05 open-redirect bug (backslash / control char before the origin check).
- [ ] `/landing?token=x&next=//evil.com` is refused the same way.
- [ ] Entering a company (a card, or a module choice) scopes the token; the side menu's _Select
      Entity_ and a result screen's _Back to Manage Subscriptions_ each trade it back for an
      unscoped one through Flask's re-handoff — confirm the header/menu no longer names a company
      afterward.
- [ ] A 401 from `SUBSCRIPTION_API_URL` clears the cookies and redirects through the re-handoff
      **once** — several requests failing together must not cause several navigations.
- [ ] Sign-in, log-in mode: an email with no account is refused (Flask's own words).
- [ ] Sign-up / an invitation: the Terms panel (`TermsModal`) must be read to the end (4px
      tolerance) before _Agree_ unlocks; the accepted version rides with `verify-code`.
- [ ] Xero sign-in navigates to Flask's `/xero_auth`, not an in-app form.
- [ ] A flash from Flask (e.g. "you don't have permission to look there") arrives signed in
      `?flash=` and shows once as a toast; reloading the same URL does not show it again.
- [ ] A forged or >5-minute-old `?flash=` shows nothing (check Flask's own log, not the UI).
- [ ] Terms gate owed: the page behind is inert (no focus, no close button, no Escape, no
      click-outside); _Cancel_ logs out.
- [ ] Accepting with the current version posts and lifts the gate on the same page (no
      navigation); a **409** (version changed while it sat open) re-reads a new, unticked,
      locked panel.
- [ ] Simulate a Terms-check failure (Flask down) — the page must still render, **without** the
      gate (fails open), and log the console warning.
- [ ] Terms gate asks only once per token — navigating client-side within the same token does not
      re-ask after "nothing owed" or an acceptance.

## The entity list — "Select Company" (`entities.md`)

- [ ] Arriving from Flask's `/entity` always lands on `/entities` with an unscoped token,
      regardless of whether Terms are owed.
- [ ] Sort order: "Setup in progress" companies first, then A→Z case-insensitive, natural order
      ("Scenario 2" before "Scenario 10") — not Flask's own onboarding-then-recent order.
- [ ] Search matches case-insensitively, anywhere in the name (not just the start).
- [ ] A card's last-opened time renders in the viewer's own timezone; hovering shows "By
      <name>"; a never-opened company shows grey "Not opened yet".
- [ ] The "+" / empty-state _Create Entity_ goes to Minty's onboarding wizard, not an in-app form.
- [ ] A company still onboarding resumes the wizard on click; one module on goes straight into
      it; two modules land on "Choose Module Type".
- [ ] On "Choose Module Type", the two doors reflect the company's actual modules
      (`GET /api/me/entities`) — never the token's stale claims.
- [ ] The header initials open the sidebar on **My Profile**; the ≡ opens it on **the menu** —
      same sidebar, two views; neither navigates away from the current page.
- [ ] The side menu shows Petty Cash / Payment Request sections and Settings only while inside a
      company, never on the entity list itself.

## My Profile (`profile.md`)

- [ ] Opened inside a company: shows the company name, its plan color (Petty Cash amber
      `#ea9713`, Payment Request blue, SuperMinty teal with the caped cat) and the person's role.
- [ ] Opened from the entity list (no company in the cookie): none of the company/plan/role trio
      shows.
- [ ] _Edit_ → change only the email → _Save_ sends only the changed field (check the network
      call's body).
- [ ] Clearing the email entirely is refused client-side first: "We'll need an email here."
- [ ] A malformed or already-taken email is refused in Flask's own wording, shown under the
      field with what was typed.
- [ ] PASSWORD · _Change_ opens the Xero account page, not an in-app password form.
- [ ] After Save, the header's initials and the side menu's name update immediately — no need to
      reload or wait for a new token.
- [ ] The "Subscriptions Overview" card's figures match the portal landing's for the same payer.
- [ ] Force that card's read to fail (e.g. offline) — it shows its own refusal with _Try again_,
      the rest of the profile still renders.
- [ ] The sidebar panel and the `/profile` page show identical content for the same person/company
      (they share one body).
- [ ] **DB:** `SELECT email, first_name, last_name, username FROM pettycashv3.user WHERE id =
      '<id>';` — Save writes only the changed field(s) to `email`/`first_name`/`last_name`;
      `username` only moves too when it currently mirrors the old email (sign-in/OTP reads
      `username`, password reset reads `email` — a stale mismatch between the two is the bug to
      watch for).

## Settings — Users tab (`company-settings.md`)

- [ ] The role `<select>` on any row only offers ranks at or below the viewer's own rank.
- [ ] Attempting to remove the payer, the last admin, or a pending handover's nominee is refused
      in Flask's own words — try each of the three.
- [ ] The "Subscriber" tag appears only on the one person whose card actually pays.
- [ ] View page source / inspect a member's address field — it must render as plain text, never
      as `innerHTML` (the Jinja-tab bug that let an invited address run script).
- [ ] Invite with a non-English-character email is refused (`lib/emailInput.ts`); first name,
      last name and a role are all required.
- [ ] Invite, then press Resend immediately — Flask's `retry_after` cooldown counts down and
      blocks a second send until it expires.
- [ ] Cancelling a pending invitation asks for confirmation first.
- [ ] **DB:** `SELECT status, role, invited_by FROM pettycashv3.invitation WHERE entity_id =
      '<id>' ORDER BY created_at DESC;` — a new invite inserts `status = 'pending'`; cancelling
      updates `status` on the same row (never deletes it); Resend rotates `token`, same row.
- [ ] **DB:** `SELECT role FROM pettycashv3.user_entity WHERE user_id = '<id>' AND entity_id =
      '<entity_id>';` — a role change updates this row in place; Remove deletes it outright
      (composite key `user_id, entity_id` — confirm the row is actually gone, not just hidden).

## Settings — Entity & Integration tab (`company-settings.md`)

- [ ] The company name field is editable only as an admin; country/currency only as an
      accountant or above — confirm a lower role sees them read-only with the reason stated.
- [ ] Saving edits only the fields that changed; Flask's refusal (if any) stays under the form,
      not a toast.
- [ ] Xero card shows one of Connected / Reconnect needed / Not connected, with the
      organisation name and connect date when connected.
- [ ] Connect / Reconnect navigate out to Flask's OAuth flow and land back on this tab.
- [ ] Disconnect asks for confirmation before it fires (it used to be a single click).
- [ ] **DB:** `SELECT name, country_code, currency_id, status, xero_org_id,
      connected_by_user_id FROM pettycashv3.entities WHERE id = '<id>';` — a details save
      touches only `name`/`country_code`/`currency_id` (plus `currency_format`, derived);
      Disconnect sets `status = 'disconnected'` and nulls `xero_org_id`/`connected_by_user_id`
      — and clears that user's Xero token columns on `pettycashv3.user` too, but only when no
      other entity still uses the same connector.

## Module settings page (`subscriptions.md` §9)

- [ ] Each of the six card states shows its documented CTA: past_due → Reactivate Subscription;
      pending_cancel → Resume Subscription; trialing → Manage Subscription (label turns red at
      ≤7 days remaining); active → Manage Subscription; trial_eligible → Start Free Trial;
      expired → Activate Subscription.
- [ ] A module's settings pill and drawer section appear only while that module is actually on —
      confirm they don't flash in/out while the page model is still loading.
- [ ] _Start Free Trial_ always opens `StartTrialDialog` first; only _Confirm_ posts
      `start-trial`; _Go back_/Escape/backdrop post nothing.
- [ ] A refused trial start shows a toast and leaves the dialog open (don't lose the state).
- [ ] Confirming a trial lands on its **Congratulations result in the cards' place**
      (2026-10-08) — "<Module> free trial has started — 30 days, free." — with the Settings
      chrome and tabs still there, and **Back to Company** leaving for `/entity/<shortid>/<name>`.
      It must NOT navigate to the Manage Subscriptions list any more, and must not just refresh
      the cards.
- [ ] Clicking Resume / Reactivate / the failed-module's Activate lands on the Manage
      Subscriptions list with that company's row open and the module **ticked but nothing
      posted yet** — no modal should appear immediately.
- [ ] The "Payment failed" banner's link opens the company's **billing account** page, not a
      per-company payment screen.
- [ ] Confirm there is no `?session_id=` / `?checkout_error=` handling left — nothing on this
      page should ever hand the browser to a Stripe-hosted page.
- [ ] As a non-admin, or an admin who isn't the payer, the cards render with no CTA and a line
      naming who the payer is (or that only admins can change modules).
- [ ] **DB:** `SELECT function_code, phase, trial_end, payer_user_id, app_access_until FROM
      pettycashv3.entity_module_subscription WHERE entity_id = '<id>';` — a confirmed trial
      start inserts/updates the row for that `function_code` and projects into
      `pettycashv3.entity_function_map` (`is_enabled`, `enabled_at`) — that second table is
      what actually gates app access, so check both, not just the subscription row. Since
      2026-10-08 `payer_user_id` must be **NULL** after a trial start - whoever pressed the
      button is not the subscriber.
- [ ] Manage Subscriptions: the CLOSED row of a company with no subscriber carries no extra
      button. Open it with nothing ticked and the panel shows "No pending changes" and **no
      button at all** — neither Activate nor Confirm.
- [ ] Tick a module on that company: the teal button appears and reads **Activate Subscription**
      (not Confirm), in _Confirm Subscription Change_'s place.
- [ ] Pressing it opens the SAME section-06 modal a change opens ("You have unlocked Super
      Minty" etc.) naming the company and the modules chosen, and posts nothing. Its Confirm
      opens Billing Accounts; that Confirm posts **two** requests in order —
      `activate-subscription` with `{account}` and **no `codes`**, then the ticked change's own
      action — and the row lands on its 05·C result, whose button still reads *Back to Manage
      Subscriptions*.
- [ ] **It charges when the tick does.** Tick a LAPSED module and activate: the card is charged
      (`restart-billing`), which is what the modal said. Tick a running trial instead and
      nothing is charged (`authorize-billing`).
- [ ] **DB:** after activating with a lapsed tick there is **exactly one** new
      `pettycashv3.subscription_invoice` row for that module, not two — the activation sends no
      `codes`, so only the apply pass buys it back.
- [ ] Force a decline on the apply pass (Stripe test card): the company is left **with** its
      subscriber and the ticks still pending, and 06·B's *Try again now* posts only the charging
      action — never `activate-subscription` a second time.
- [ ] Make the activation itself fail (402): **nothing** else is posted, no result appears, and
      the ticks are untouched.
- [ ] Module settings: activating lands on the **Congratulations result in the cards' place**,
      not a toast — one line per confirmed module, the money line — with the Settings chrome and
      tabs still there. Its button reads **Back to Company** and leaves for
      `/entity/<shortid>/<name>` (which itself redirects on into the app when the company has
      only one module enabled — expected).
- [ ] On a company where **both** trials are unconfirmed the page draws **one** Activate
      Subscription button, centred between the cards, and pressing it **activates** — it must
      not navigate to the Manage Subscriptions list.
- [ ] On a company whose trial is unconfirmed, the card's button reads **Activate Subscription**
      (the trial line itself unchanged) while a module with no trial still offers **Start Free
      Trial**; a SECOND admin sees the same buttons, because nobody is being billed yet.
- [ ] Pressing it opens Billing Accounts over the page; an account with no card cannot be
      picked. Confirm posts `activate-subscription` with `{account}` and nothing else - no
      `codes`, so nothing is charged.
- [ ] **DB after confirming:** one `pettycashv3.entity_billing_group` row for the company, one
      `pettycashv3.entity_billing_consent` row, and EVERY `entity_module_subscription` row of the
      company stamped with that admin. No `subscription_invoice` row.
- [ ] Cancel out of the sheet instead, or hit the 402: `payer_user_id` is still NULL and there
      is no consent row, so the picker can be answered again.
- [ ] **DB:** confirm each state change also appends a `pettycashv3.subscription_audit_log` row
      — a CTA that changed `phase` with no matching audit row is a silent write to report.

## Manage Subscriptions list (`subscriptions.md` §10-§13)

- [ ] A company with every module suspended appears under "Suspended Subscriptions"; a company
      with one suspended module and one active/trialing module stays in the main list.
- [ ] The ⋮ menu shows exactly: _Request transfer_ always; _Cancel subscription_ only when a
      module is ACTIVE; _Reactivate_ only when a module is not ACTIVE but has a tick to give.
- [ ] Clicking a row's name or the empty space opens it; clicking the ⋮, a cell's own
      Start Trial/Subscribe link, or the chevron does ONLY that control's job.
- [ ] With a row open and a module card ticked, clicking inside a module card that is NOT the
      checkbox (but is part of its click target) does not collapse the row.
- [ ] Tick a module, then press the same box again — the change undoes in place (no network
      call either way until Confirm).
- [ ] Tick a module, then close the row (or open another company, or reload) — the pending tick
      is dropped; reloading specifically should trigger the browser's own `beforeunload` warning,
      not the app's "Leave without saving?" dialog.
- [ ] Tick a module, then try to close the row via its chevron — the in-app "Leave without
      saving?" (A-11) appears; _Discard changes_ drops the tick and closes; _Go Back_ keeps it
      open with the tick intact.
- [ ] A change that ONLY cancels (no billing involved) applies directly on Confirm — no "Billing
      Accounts" step.
- [ ] A change that bills anything (a trial confirmed, an expired trial reactivated, a
      cancellation resumed) opens "Billing Accounts" after the change's own modal, before
      anything is charged.
- [ ] While the "Billing Accounts" sheet is open for a pending change, Escape and the backdrop do
      nothing, and the rows/New billing account/X controls are all disabled until the result
      comes back.
- [ ] Force a card decline during a change that bills — the "Payment could not be processed"
      dialog names the card; "We'll automatically retry" text appears ONLY for a suspension's
      scheduled dunning retry, never for a fresh purchase's decline.
- [ ] Verify the four result-screen routings: removing the only module → full cancellation page;
      removing one module while another paid one survives → module cancellation page; one
      removed + one added in the same change → in-row "Subscription updated"; anything
      added/restored/started → "Congratulations!" row.
- [ ] From any result screen, _Back to Manage Subscriptions_ returns to the landing with an
      **unscoped** token — confirm the header reads "Subscriptions", not a company name.
- [ ] At 375px width, no element scrolls sideways; a row's name+chevron/⋮ sit on one line and
      each module cell sits on its own full line.
- [ ] **DB:** moving a company to a different account (the account picker inside this flow)
      upserts `pettycashv3.entity_billing_group` (`entity_id`, `billing_group_id`,
      `source = 'moved'`) — confirm it is the SAME row updated, not a second one left behind
      for the entity.
- [ ] **DB:** a Confirm that bills anything inserts one `pettycashv3.subscription_invoice` row
      plus a `pettycashv3.subscription_invoice_line` row per affected company/kind
      (full/remaining/unused/extension) — a cancel-only Confirm must create neither.

## Handing a subscription over (`subscriptions.md` §14)

- [ ] On the payer's side, the current payer's own name in the picker is disabled and tagged
      "Current" — it cannot be selected.
- [ ] A candidate the API flags with a blocker is shown in amber and disables _Request transfer_
      for that pick.
- [ ] With a request already pending, _Withdraw request_ fires with **no confirmation dialog**
      (there's nothing to lose), shows "Transfer request has been withdrawn", then returns to the
      picker.
- [ ] On the recipient's review screen, every module the company holds starts **ticked**;
      unticking one marks it to be cancelled as part of accepting.
- [ ] With only one module ticked, attempt to untick it — the checkbox and its card must go
      inert (the last ticked module cannot be removed).
- [ ] Confirming the transfer charges **nothing at that moment** — no money line appears on this
      screen at all.
- [ ] With no billing account yet, _New billing account_ opens the account sheet **over the
      offer** (the offer is not lost) rather than navigating away.
- [ ] Open each of the four outcome dialogs (withdrawn / accepted / declined / expired) and
      dismiss one via Escape or the backdrop, then reload — it reappears (not marked seen);
      dismiss one via _Done_, then reload — it does not reappear.
- [ ] **DB:** `SELECT status, from_user_id, to_user_id, responded_at, outcome_seen_at FROM
      pettycashv3.subscription_transfer WHERE entity_id = '<id>' ORDER BY created_at DESC;` —
      one row per offer throughout: Request inserts `status='pending'`; Withdraw/Decline/Accept
      all UPDATE that same row's `status`/`responded_at`, never insert a second one; _Done_ on
      an outcome dialog is what sets `outcome_seen_at`.
- [ ] **DB:** an Accept that charges also nominates `pettycashv3.entity_billing_group` onto the
      new payer's account (`source = 'transfer'`) — confirm the OLD payer's row for that
      entity is gone/replaced, not left as a second nomination.

## Billing accounts, cards and invoices (`subscriptions.md` §15)

- [ ] The landing's "Next Billing Date" is identical no matter which billing account is shown
      (every account shares the payer's one anchor).
- [ ] Picking a different account in the landing's picker only rewrites `?account=` in the URL —
      no network call, nothing about billing changes.
- [ ] "Change billing account" (clicking the account's name) walks two steps — company, then
      account; a past-due company is shown disabled in step 1; an account in dunning or with no
      card is disabled with its reason in step 2.
- [ ] _Set as default_ on a card changes what the **account** charges for every company on it —
      confirm the payer-wide Stripe default is unaffected (check another account's default card
      separately).
- [ ] Attempt to remove the card an account currently charges — refused in-page (08-R) with one
      way out stated: make another card the default first.
- [ ] Remove a non-default card — asks for confirmation first, then removes it from every
      account that held it.
- [ ] Add a card (08-Y) to a specific account via its SetupIntent — the number never appears
      outside Stripe's iframe; retrying after a failed confirm does not double-confirm the
      intent.
- [ ] **DB:** _Set as default_ updates `is_default` on `pettycashv3.billing_account_payment_method`
      (demotes the old row, promotes the chosen one — never two `is_default = true` rows for
      the same `billing_group_id`, which is also DB-enforced by `uq_bapm_one_default`) AND
      mirrors the card onto `pettycashv3.payer_billing_group.stripe_payment_method_id` — check
      both columns moved together.
- [ ] **DB:** adding a card inserts a `pettycashv3.billing_account_payment_method` row
      (`billing_group_id`, `stripe_payment_method_id`, `is_default`); a brand-new billing
      account's first card insert carries `is_default = true` plus a new
      `pettycashv3.payer_billing_group` row (`billing_email`, `billing_company`).
- [ ] **DB — known gap, confirm before relying on it:** remove a card today only detaches it at
      Stripe (`payment_methods.remove`) — no code path was found that deletes or updates the
      matching `pettycashv3.billing_account_payment_method` row. After removing a non-default
      card, check `SELECT * FROM pettycashv3.billing_account_payment_method WHERE
      stripe_payment_method_id = '<pm_id>';` — if the row still reads back, that's a stale
      local row pointing at a card Stripe no longer holds; flag it rather than treat it as
      expected.
- [ ] Open "New billing account" — try Save with either Billing Email or Billing Company blank;
      both are required and checked before Stripe is asked for anything.
- [ ] While the new-account sheet is mid-save, confirm nothing (Escape, backdrop, X) closes it.
- [ ] On the billing-details form (08-C), change only the billing email — confirm only that
      field is sent, not the whole form.
- [ ] A company name already set on the account cannot be blanked via this form.
- [ ] **DB:** renaming an account (08-C) updates only `billing_email`/`billing_company` on
      `pettycashv3.payer_billing_group` — the address/cardholder name typed there is Stripe-only
      and has no local column; "Change billing account" (moving a company) upserts
      `pettycashv3.entity_billing_group` the same way as the Manage Subscriptions picker above,
      and carries the elapsed days of the current cycle across to the new
      `payer_billing_group` row rather than losing them.
- [ ] _Retry payment_ appears only on an invoice flagged `retryable`; an older declined/abandoned
      invoice shows red with no action button.
- [ ] Download an Invoice PDF — saved as `Inv-<reference>.pdf`.
- [ ] Click the Inv# itself (not the download column) — opens a view-only preview dialog with no
      Download/Print/Open control and nothing saved to disk; only invoices the processor still
      has (paid/open/uncollectible) have one at all (`has_pdf`).
- [ ] Download the Billing Breakdown CSV for an older invoice — the rate/days shown are what was
      RECORDED at issue time, not recomputed against today's pricing.
- [ ] **DB:** _Retry payment_, on success, flips `pettycashv3.subscription_invoice.status` to
      `paid` and sets `paid_at`, and ends dunning on `entity_module_subscription`
      (`phase`/`app_access_until`) for the module(s) that invoice covers — a retry that is
      declined again must leave `status` exactly as it was, not move it sideways.
- [ ] Across the whole billing area, confirm there is no route that hands the browser to a
      Stripe-hosted Checkout or customer-portal page — every card action happens through a
      billing account inside this app.

## Toasts and modals — design conformance

- [ ] Every confirm/leave dialog in this app renders through the shared `ConfirmDialog`/
      `ModalFrame` shell — compare visually against minty-payment-request-web's and Flask's
      copies of the same dialog family; a visible drift here is a drift in all three.
- [ ] **Mandatory fields show a red `*` on open**, and nothing is red until a submit is
      refused. Check Invite someone, Company details, sign-in/sign-up and a new billing
      account. A screen reader says "Email, required", not "Email star".
- [ ] Editing a card: an expiry of `13`/`99` is **refused with a message** and the pair turns
      red. It must not report success and navigate away (it used to, dropping the expiry).
      Leaving both boxes blank still saves the name and keeps the card's current expiry.
- [ ] Toasts render as plain white cards with no colour or icon, matching the system-wide rule.
- [ ] In a company-named modal (e.g. a change confirmation), the entity name renders teal while
      the "Entity" label above it stays the default grey — a specific, easy-to-miss distinction.

## Billing Accounts is not a dry run (read before testing any of the above by hand)

**Never walk the tick → Confirm Subscription Change → "Billing Accounts" → Confirm path against
a real payer's billing account.** Once a company's row is on the account picked, _Confirm_
immediately moves the company (`POST /billing/accounts/move`) and then applies the change — a
trial confirmation, an expired-trial reactivation or a suspension reactivation **charges that
account's card** in the same step, with no further confirmation afterward. There is no "undo"
screen for either action from this app.

Use the dev fixture switches instead wherever they cover the state you need, against the real
app or in isolation:

- `?fixture=A` … `F` on the Manage Subscriptions list and the module page (every Figma state,
  no API calls).
- `?summary=M11` … `N21a` for a specific open-row state, `?result=RU22` … `RNX21a` for a result
  screen.
- `?fixture=A|B|H|I|J|N` on the billing page, `?fixture=A|C|BLOCKED|D|TRIAL|F` on the transfer
  screens.

If a real billing account must be exercised (e.g. before a release that touches §15), use a
disposable payer and a Stripe test-mode card, and confirm the account held nothing of value
before the walk — never the production payer's account.

## Out of scope for this checklist

- **Stripe's own hosted fields and iframes** (`js.stripe.com`) — deliberately kept out of
  Playwright per the docs; their behaviour is covered by unit tests with Stripe stubbed, not by
  a manual click-through here.
- **The email OTP sign-in's inbox step** — ends at a real inbox; not testable in this app alone.
- **Each other app's own settings tab** (Flask's Petty Cash Settings, the payments app's
  Payment Request Settings) — those belong to their own repo's checklist, not this one; this
  app only owns Users and Entity & Integration.

## See also

- [authentication.md](authentication.md) — the gate, the Terms modal, the token rules behind
  the first section.
- [entities.md](entities.md) — the entity list and the module choice screen.
- [profile.md](profile.md) — My Profile, in the sidebar and as a page.
- [company-settings.md](company-settings.md) — the Users and Entity & Integration tabs.
- [subscriptions.md](subscriptions.md) — the module settings page, Manage Subscriptions,
  transfers and billing accounts; §7 names every automated test these items are derived from.
- `minty-subscription-api/docs/features/subscriptions-api.md` — the API contract behind the
  module settings, list, transfer and billing sections.
