# Required fields

**A mandatory field says so before anything is attempted**: a red `*` on its label from the
moment the form opens. The control turns red only once a submit has actually been refused, so
an untouched form is never shown as an error.

Built 2026-10-09. Before that this repo had **eighteen** mandatory fields and **no marker at
all** — no asterisk anywhere, and six forms with no invalid state in the JSX either.

## The two halves

| Half | What | Why |
|---|---|---|
The mark | `components/ui/RequiredMark.tsx`, coloured by `SHEET_REQUIRED` in `components/ui/sheetClasses.ts` | For the eye |
The announcement | `aria-required="true"` (or the native `required`) on the **control** | For everyone else |

The mark is **`aria-hidden`**, because an asterisk read aloud is "star". That is why the
attribute on the control is not optional: hide the mark without it and the field becomes
silent to assistive tech, which is worse than before. The accessible name stays clean — a field
labelled `Email *` has the accessible name "Email", asserted in
`components/ui/__tests__/RequiredMark.test.tsx`.

`SHEET_REQUIRED` is **mirrored into `minty-onboarding-web/app/globals.css`** as
`.billing-label .req`, because `sheetClasses.ts` is a copy of onboarding's `.billing-*` rules
and its own header says: *"the same dialog in two apps must be the same dialog, so a change to
one is a change to the other."* Change both or neither.

## Where it is applied

| Form | Fields marked |
|---|---|
`features/company-settings/components/InviteDialog.tsx` | Email, Role, First name, Last name |
`features/company-settings/components/DetailsForm.tsx` | Company name, Country, Currency |
`features/auth/routes/LoginScreen.tsx` | First name, Last name (sign-up only), Email |
`features/subscription/components/AccountSheet.tsx` | `IdentityField`'s `{label}` — one renderer, so Billing Email and Billing company both get it |
`features/subscription/components/CardCaptureForm.tsx` | the "Payment method" caption |

`components/ui/__tests__/requiredFieldsMarked.test.ts` locks this list by reading the source,
because several of these forms sit behind API mocks and a branch no test renders is exactly
where a marker goes missing.

## Four places it deliberately does NOT appear

1. **`features/profile/components/DetailsCard.tsx` — Email.** Mandatory (`profileView.ts`
   refuses a blank), but the card shows no visible label for it, only a mail tile. There is
   nowhere to hang an asterisk, so it carries `aria-required` alone. Giving it a visible label
   is a layout decision, not a code one.
2. **`features/auth/components/CodeInput.tsx` — the 6-digit code.** Same: the only visible
   prompt is the lead sentence above it. The `role="group"` carries `aria-required`.
3. **`features/subscription/components/BillingDetailsForm.tsx`.** Billing email **accepts a
   blank**, and Billing Company is refused only when the account already had one — a condition
   that lives in `validateDetails(fields, initial)`, and `initial` never reaches that
   component. Marking it unconditionally would lie on a fresh account. Its invalid half already
   works: `errors.company` reddens the field and prints the message when it really is required.
4. **Anything inside a Stripe Element.** `PaymentElement` and `AddressElement` render in a
   cross-origin `js.stripe.com` iframe; `appearance.rules` can style Stripe's labels but cannot
   add content to them. Only the captions we own are marked.

## The red state, and where it cannot reach

`SHEET_INPUT_BAD` (`sheetClasses.ts`) is the invalid border — correct red `#b4231f`, paired
with `SHEET_FIELD_ERROR` under the field. Its own note is the rule: *"the border AND the
message under it; colour alone is no signal."*

**`InviteDialog` and `LoginScreen` gate on a disabled primary button**, so a refused submit
never happens and the red can never show. The `*` is the whole fix there. A disabled button
with no explanation is arguably the same silence that prompted this work, so making those
buttons live and validating on click is **open, and deliberately not done here** — it is a real
UX change, not a marker change.

## One bug fixed on the way

`features/subscription/hooks/useCardForm.ts` — an out-of-range card expiry was **dropped from
the request** and the save then reported success and navigated away. Typing `13`/`99` looked
like it had worked while nothing changed. It is now refused with `EXPIRY_INVALID`, and the
expiry pair in `CardScreens.tsx` reddens. A blank pair is still fine — it means "keep the
card's current expiry".

The test at `features/subscription/__tests__/useCardForm.test.tsx` used to assert the drop
("a bad month out of the request") and never checked that the person was told, which is how
the silent loss survived. It now asserts the refusal.

## See also

- `minty-payment-request-web/docs/features/payment-requests.md` — the same convention there,
  including the attachment drop zones.
- `Minty/docs/features/required-field-marks.md` — Flask's ~33 unmarked fields, audited the
  same day and deliberately left alone.
