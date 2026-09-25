"use client";

/**
 * The billing-account sheet - onboarding's `BillingSheet` (`onboarding/components/BillingSheet.tsx`,
 * Figma 01-L / 01-D / 01-J), drawn in this app for the payer portal's billing accounts.
 *
 * THREE FRAMES, ONE DIALOG. The radio list (01-L, 481 wide), the New billing account form (01-D,
 * 880: a form column and Minty holding a card) and the card that says it worked (01-J, 435) are
 * three states of one sheet rather than three dialogs - two are reached from the third, and the
 * payer only ever sees one. So the frame is ONE element across them: it changes its width and
 * never remounts (which would replay the entrance and throw the focus away), and the width does
 * NOT transition - Stripe measures the box it mounts into, and a sheet still growing from 481 to
 * 880 lays the card form out too narrow.
 *
 * The dialogs are composed from these parts in `BillingAccountDialogs` (08-A's picker, the move's
 * two steps, 08-B's "Open a billing account"). What they share - the form, 01-J, and not letting
 * the sheet close mid-save - is `useNewAccountSheet` + `newAccountFrame` + `NewAccountStage`.
 *
 * Kept from onboarding: the scrim (#16202E at 12% behind a 6px blur - the blur does the work),
 * the shell, the drawn radio, the rows' shadow and ring, the teal link, the button pair, and the
 * ways out (the X, Escape and the backdrop close; on 01-J closing IS Done - the account exists).
 * Two changes, both toward safety: nothing closes the sheet while a save is in flight (onboarding
 * lets the X do it, and the result is lost), and a card form that fails to open offers Try again
 * in place (`CardCapturePanel`) instead of falling back to the list.
 */

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import type { BillingAccount, SavedPaymentMethod } from "@/features/subscription/api/payerPortal";
import { CardBrand } from "@/features/subscription/components/CardBrand";
import { CardCapturePanel } from "@/features/subscription/components/CardCaptureForm";
import { shortCardName } from "@/features/subscription/components/CardDialogs";
import {
  SHEET_DONE,
  SHEET_FIELD,
  SHEET_FIELD_ERROR,
  SHEET_INPUT,
  SHEET_INPUT_BAD,
  SHEET_INPUT_OK,
  SHEET_LABEL,
} from "@/features/subscription/components/sheetClasses";
import { useNewAccount, type OpenedAccount } from "@/features/subscription/hooks/useCardForm";
import {
  CARD_ADDED,
  CARD_ADDED_DEFAULT,
  CARD_ADDED_TAIL,
  STRIPE_NOTE,
} from "@/features/subscription/lib/billing";
import {
  CARD_ADDED_LABEL,
  CARD_EXPIRED_FLAG,
  CARD_EXPIRING_FLAG,
  COMPANY_LABEL,
  COMPANY_PLACEHOLDER,
  EMAIL_LABEL,
  EMAIL_PLACEHOLDER,
  NEW_BILLING_ACCOUNT,
  PAYMENT_FAILED_CHIP,
  accountCardLine,
  companyCount,
} from "@/features/subscription/lib/billingAccounts";

// --- The frame ----------------------------------------------------------------------

export type SheetSize = "list" | "form" | "done";

/** `.billing-sheet` and its three modifiers - and 01-L's width again for the form on a small screen. */
const SIZE: Record<SheetSize, string> = {
  list: "max-w-[481px] p-[30px] max-[560px]:px-[18px] max-[560px]:py-[22px]",
  form: "max-w-[880px] px-7 pb-7 pt-[26px] max-[900px]:max-w-[481px] max-[560px]:px-[18px] max-[560px]:py-[22px]",
  done: "max-w-[435px] px-12 pb-10 pt-[67px] max-[560px]:px-[22px] max-[560px]:pb-8 max-[560px]:pt-[30px]",
};

export type SheetFrameProps = {
  size: SheetSize;
  /** The dialog's accessible name - onboarding names each stage. */
  label: string;
  title?: string;
  /** The line under the title: the form's Stripe note, the move's question. */
  sub?: string;
  /** A save or a move in flight: NOTHING closes the sheet - not the X, Escape or the backdrop. */
  busy: boolean;
  /** The X. Absent on 01-J, whose one way out is Done. */
  onClose?: () => void;
  /** Escape and a click on the backdrop. */
  onDismiss: () => void;
};

export function SheetFrame({
  size,
  label,
  title,
  sub,
  busy,
  onClose,
  onDismiss,
  children,
}: SheetFrameProps & { children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onDismiss]);

  // Focus starts inside: the sheet covers the page, and a keyboard left behind it would tab
  // through a page it cannot see. (01-J focuses its own Done - it has no X.)
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    // The scrim is the overlay itself, not a button laid over it: it scrolls when a tall form
    // does, and a click that lands on it (not on the sheet) is the backdrop.
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onDismiss();
      }}
      className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto overscroll-contain bg-[rgba(22,32,46,0.12)] p-5 backdrop-blur-[6px] transition-opacity duration-150 ease-out starting:opacity-0 motion-reduce:transition-none"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        // `m-auto`, not only the overlay's centring: a sheet taller than the window then scrolls
        // from its top instead of being cut off above it. Translate only, never scale - Stripe
        // measures the box it mounts into.
        className={`relative m-auto w-full rounded-2xl bg-white shadow-[0_16px_44px_rgba(22,32,46,0.16)] transition-[opacity,translate] duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)] starting:translate-y-2 starting:opacity-0 motion-reduce:transition-none ${SIZE[size]}`}
      >
        {(title || onClose) && (
          <div className="mb-[22px] flex items-start gap-3">
            <div className="min-w-0">
              {title && (
                <h2
                  className={`mb-1.5 leading-[normal] tracking-[-0.01em] text-[#16202e] ${
                    size === "list" ? "text-[16px] font-semibold" : "text-[20px] font-bold"
                  }`}
                >
                  {title}
                </h2>
              )}
              {sub && (
                <p className="max-w-[434px] text-[13.5px] leading-[normal] text-[#6b7a80]">{sub}</p>
              )}
            </div>
            {onClose && (
              <button
                ref={closeRef}
                type="button"
                aria-label="Close"
                onClick={onClose}
                disabled={busy}
                className="ml-auto flex-none rounded-lg p-1 leading-none text-[#8a8d8b] hover:bg-[#f5f5f3] hover:text-[#4a4d4b] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// --- 01-L: the rows -----------------------------------------------------------------

type FlagTone = "red" | "amber" | "grey";

const FLAG_TONE: Record<FlagTone, string> = {
  red: "border-[#ffcccc] bg-[#fff1f1] text-[#b4231f]",
  amber: "border-[#f2d59b] bg-[#fce6bd] text-[#9e690d]",
  // Ours: onboarding has no neutral fact to flag ("Billed here now").
  grey: "border-[#e3e7ec] bg-[#eff1f4] text-[#6b7380]",
};

/** `.billing-pm-flag` - a fact about the row, as a pill; only the colour family changes. */
export function SheetFlag({ text, tone }: { text: string; tone: FlagTone }) {
  return (
    <span
      className={`flex-none whitespace-nowrap rounded-full border px-2 py-[3px] text-[11.5px] font-bold tracking-[0.02em] ${FLAG_TONE[tone]}`}
    >
      {text}
    </span>
  );
}

/** `.pm-brand` - a fixed chip, so the labels beside it line up down the list; empty with no card. */
function BrandChip({ card }: { card: SavedPaymentMethod | null }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-9 w-14 flex-none items-center justify-center rounded-[7px] border border-[#eff1f3] bg-white"
    >
      {card && <CardBrand brand={card.brand} label={card.brand_label} className="h-[30px] w-[46px]" />}
    </span>
  );
}

/**
 * One choice (`.billing-pm`): the whole row is the label, the radio is DRAWN (a 6px teal ring
 * round a white core - no `accent-color` turns a dot into that), and the chosen row gets an
 * outline rather than a border so choosing it does not shunt the list by 2px. No border at rest
 * either: a shadow alone separates one row from the next.
 */
export function SheetRow({
  name,
  value,
  checked,
  disabled = false,
  onSelect,
  leading,
  title,
  meta,
  detail,
  flags,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: (value: string) => void;
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  detail?: ReactNode;
  flags?: ReactNode;
}) {
  return (
    <li>
      <label
        className={`flex min-h-[95px] items-center gap-[18px] rounded-xl bg-white px-5 py-3.5 outline-2 -outline-offset-2 transition-[box-shadow,outline-color] duration-150 max-[560px]:flex-wrap max-[560px]:gap-3.5 max-[560px]:px-4 ${
          checked
            ? "shadow-[0_2px_10px_rgba(79,199,199,0.18)] outline-[#4fc7c7]"
            : "shadow-[0_2px_8px_rgba(0,0,0,0.1)] outline-transparent"
        } ${
          disabled
            ? "cursor-not-allowed opacity-60"
            : checked
              ? "cursor-pointer"
              : "cursor-pointer hover:shadow-[0_3px_12px_rgba(0,0,0,0.14)]"
        }`}
      >
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={() => onSelect(value)}
          className="size-5 flex-none cursor-pointer appearance-none rounded-full border-2 border-[#d7dee2] bg-white transition-[border-color,border-width] duration-150 checked:border-[6px] checked:border-[#2e9b9b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4fc7c7] disabled:cursor-not-allowed"
        />
        {leading}
        <span className="flex min-w-0 flex-col gap-[5px]">
          <span className="text-[14px] font-bold tracking-[-0.005em] text-[#16202e]">{title}</span>
          {meta && <span className="text-[12px] text-[#16202e]">{meta}</span>}
          {detail && <span className="text-[12.5px] text-[#8a8d8b]">{detail}</span>}
        </span>
        {flags && (
          <span className="ml-auto flex flex-none flex-col items-end gap-1.5 max-[560px]:ml-0 max-[560px]:basis-full max-[560px]:flex-row max-[560px]:justify-start">
            {flags}
          </span>
        )}
      </label>
    </li>
  );
}

/**
 * What a row says about an account beyond its name, in onboarding's order: what it IS (a payment
 * on it failed), then how close its card is to not working - an expired card would still be
 * charged, and saying so here beats the first failed renewal.
 */
export function accountFlags(account: BillingAccount): ReactNode {
  const card = account.card;
  const flags = [
    account.past_due && <SheetFlag key="failed" text={PAYMENT_FAILED_CHIP} tone="red" />,
    card?.expires_soon && !card.expired && (
      <SheetFlag key="soon" text={CARD_EXPIRING_FLAG} tone="amber" />
    ),
    card?.expired && <SheetFlag key="expired" text={CARD_EXPIRED_FLAG} tone="red" />,
  ].filter(Boolean);
  return flags.length > 0 ? flags : null;
}

/** A billing account as a row: its card's mark, its name, the card it charges, its companies. */
export function AccountRow({
  account,
  name,
  checked,
  disabled,
  onSelect,
  flags,
}: {
  account: BillingAccount;
  name: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: (accountId: string) => void;
  /** In place of the account's own flags (`accountFlags`) - the move's reason a row is shut. */
  flags?: ReactNode;
}) {
  return (
    <SheetRow
      name={name}
      value={account.id}
      checked={checked}
      disabled={disabled}
      onSelect={onSelect}
      leading={<BrandChip card={account.card} />}
      title={account.name}
      meta={accountCardLine(account)}
      detail={companyCount(account.companies.length)}
      flags={flags === undefined ? accountFlags(account) : flags}
    />
  );
}

// --- 01-D: the new billing account form -----------------------------------------------

function IdentityField({
  id,
  label,
  error,
  onChange,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
  onChange: (value: string) => void;
} & Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "autoComplete" | "placeholder" | "value" | "disabled"
>) {
  return (
    <div className={SHEET_FIELD}>
      <label className={SHEET_LABEL} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        required
        {...input}
        className={`${SHEET_INPUT} ${error ? SHEET_INPUT_BAD : SHEET_INPUT_OK}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        // The message clears as they start fixing it (`setField`), not at the next submit.
        onChange={(e) => onChange(e.target.value)}
      />
      {error && (
        <p id={`${id}-error`} className={SHEET_FIELD_ERROR}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * 01-D: the email invoices go to and the company they are addressed to - the account's identity,
 * both required, checked before Stripe is touched - then the card in Stripe's own fields.
 * Mounting this is what opens the SetupIntent: never preloaded behind the list.
 */
function NewAccountForm({
  fixture,
  move,
  onBusy,
  onSaved,
  onBack,
}: {
  fixture?: string | null;
  move?: string | null;
  onBusy: (busy: boolean) => void;
  onSaved: (opened: OpenedAccount) => void;
  onBack: () => void;
}) {
  const open = useNewAccount({ move, fixture, onSaved });
  const emailId = useId();
  const companyId = useId();

  return (
    <div className="flex items-start gap-20 max-[900px]:block">
      <div className="min-w-0 max-w-full flex-[0_0_434px]">
        <CardCapturePanel
          look="sheet"
          setup={open}
          onSaved={open.saved}
          onCancel={onBack}
          onBusy={onBusy}
          beforeConfirm={open.beforeConfirm}
          account={open.account}
          fields={(busy) => (
            <>
              <IdentityField
                id={emailId}
                label={EMAIL_LABEL}
                type="email"
                autoComplete="email"
                placeholder={EMAIL_PLACEHOLDER}
                value={open.identity.email}
                error={open.errors.email}
                disabled={busy}
                onChange={(value) => open.setField("email", value)}
              />
              <IdentityField
                id={companyId}
                label={COMPANY_LABEL}
                type="text"
                autoComplete="organization"
                placeholder={COMPANY_PLACEHOLDER}
                value={open.identity.company}
                error={open.errors.company}
                disabled={busy}
                onChange={(value) => open.setField("company", value)}
              />
            </>
          )}
        />
      </div>
      {/* Decoration, gone below the two-column breakpoint. `alt=""`: it says nothing the form
          does not, and read out it would sit between the company and the card number. */}
      <Image
        src="/portal/billing-cat-card.png"
        alt=""
        aria-hidden="true"
        width={232}
        height={302}
        unoptimized
        className="h-auto w-[232px] max-w-full flex-auto self-center max-[900px]:hidden"
      />
    </div>
  );
}

// --- 01-J: it worked ------------------------------------------------------------------

/**
 * A CONFIRMATION, NOT A RECEIPT - nothing was charged. The default line is read off the answer
 * (the card is the one the new account charges), never printed regardless: it is a statement
 * about which card gets charged.
 */
function AccountAdded({
  card,
  isDefault,
  onDone,
}: {
  card: SavedPaymentMethod;
  isDefault: boolean;
  onDone: () => void;
}) {
  // Done is the only control here, and the button focused a moment ago (Save) has just gone.
  const doneRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    doneRef.current?.focus();
  }, []);

  return (
    <div className="relative">
      {/* Heading and cat are one row, centred against each other; a column, cat on top, on a phone. */}
      <div className="flex items-center justify-between gap-3 max-[560px]:flex-col-reverse max-[560px]:gap-1.5">
        <h2 className="text-[26px] font-bold leading-[1.2] tracking-[-0.02em] text-[#16202e] max-[560px]:text-center max-[560px]:text-[24px]">
          {CARD_ADDED}
          <br />
          <span className="text-[#18c4c7]">{CARD_ADDED_TAIL}</span>
        </h2>
        <Image
          src="/portal/billing-cat-celebrate.png"
          alt=""
          aria-hidden="true"
          width={106}
          height={129}
          unoptimized
          className="pointer-events-none h-auto w-[106px] flex-none max-[560px]:w-[120px]"
        />
      </div>
      <p className="pt-12 text-[15px] leading-[1.2] text-[#737a87]">
        <span className="text-[#ea9713]">{shortCardName(card.brand_label, card.last4)}</span> is
        added successfully.
      </p>
      {isDefault && (
        <p className="pt-[18px] text-[15px] leading-[1.2] text-[#737a87]">{CARD_ADDED_DEFAULT}</p>
      )}
      <div className="mt-12 flex justify-center max-[560px]:mt-8">
        <button
          ref={doneRef}
          type="button"
          onClick={onDone}
          className={`${SHEET_DONE} max-[560px]:w-full`}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// --- What every dialog that opens an account shares -------------------------------------

export type NewAccountSheet = {
  /** The card is being saved: the frame refuses to close until it is done or has failed. */
  saving: boolean;
  setSaving: (saving: boolean) => void;
  /** The account the form opened, once it has - 01-J is showing. */
  opened: (OpenedAccount & { card: SavedPaymentMethod }) | null;
  /** The form's outcome. */
  saved: (opened: OpenedAccount) => void;
  /** Done (or Escape, or the backdrop) on 01-J: the page under the sheet takes it from here. */
  finish: () => void;
};

export function useNewAccountSheet(onOpened: (opened: OpenedAccount) => void): NewAccountSheet {
  const [saving, setSaving] = useState(false);
  const [opened, setOpened] = useState<(OpenedAccount & { card: SavedPaymentMethod }) | null>(
    null,
  );

  const saved = useCallback(
    (result: OpenedAccount) => {
      setSaving(false);
      // 01-J names the card it saved, so one that cannot be named finishes without it
      // (onboarding's rule): a success card with a blank in it is worse than none.
      if (result.card) setOpened({ ...result, card: result.card });
      else onOpened(result);
    },
    [onOpened],
  );

  const finish = useCallback(() => {
    if (opened) onOpened(opened);
  }, [opened, onOpened]);

  return { saving, setSaving, opened, saved, finish };
}

/** The frame for the form and for 01-J - the same element as the list's, so it never remounts. */
export function newAccountFrame(sheet: NewAccountSheet, onClose: () => void): SheetFrameProps {
  return sheet.opened
    ? { size: "done", label: CARD_ADDED_LABEL, busy: false, onDismiss: sheet.finish }
    : {
        size: "form",
        label: NEW_BILLING_ACCOUNT,
        title: NEW_BILLING_ACCOUNT,
        // What happens to the card number, worded as onboarding, Minty and the portal word it.
        sub: STRIPE_NOTE,
        busy: sheet.saving,
        onClose,
        onDismiss: onClose,
      };
}

/** The form, then 01-J once the account is open. `move`: the company it is for; `onBack`: Cancel. */
export function NewAccountStage({
  sheet,
  fixture,
  move,
  onBack,
}: {
  sheet: NewAccountSheet;
  fixture?: string | null;
  move?: string | null;
  onBack: () => void;
}) {
  if (sheet.opened) {
    return (
      <AccountAdded
        card={sheet.opened.card}
        isDefault={sheet.opened.isDefault}
        onDone={sheet.finish}
      />
    );
  }
  return (
    <NewAccountForm
      fixture={fixture}
      move={move}
      onBusy={sheet.setSaving}
      onSaved={sheet.saved}
      onBack={onBack}
    />
  );
}
