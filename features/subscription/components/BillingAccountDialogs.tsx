"use client";

/**
 * The billing-account dialogs of 08-A and 08-B, all three built from onboarding's sheet
 * (`AccountSheet` - its `BillingSheet`, 01-L / 01-D / 01-J), so they look and behave as it does:
 *
 * - WHICH ACCOUNT TO SHOW (`AccountPickerDialog`) - opened by clicking 08-A's card: the accounts
 *   as radio rows, *New billing account* under them, Confirm. Picking changes nothing but the
 *   page (the choice rides in the URL). *New billing account* turns the SAME sheet into the form,
 *   and a saved account into 01-J; Done lands 08-A on it. With no account to list, it opens on
 *   the form (onboarding's empty wallet).
 * - "CHANGE BILLING ACCOUNT" (`MoveCompanyDialog`) - moves ONE company to another account, in
 *   two steps: the company (each row names the account it is on now), then where it goes.
 *   Nothing is charged; its paid days travel with it. The rows the API would refuse are shown
 *   and disabled with the reason, rather than refused after Confirm. Step 2's *New billing
 *   account* opens one in place, and the company moves onto it.
 * - "OPEN A BILLING ACCOUNT" (`NewAccountDialog`) - 08-B for a payer with none: the form, then 01-J.
 *
 * Section 08 draws none of these: the look is onboarding's, the pickers' words are ours.
 */

import { useMemo, useState } from "react";

import type { BillingAccounts } from "@/features/subscription/api/payerPortal";
import {
  AccountRow,
  NewAccountStage,
  SheetFlag,
  SheetFrame,
  SheetRow,
  newAccountFrame,
  useNewAccountSheet,
} from "@/features/subscription/components/AccountSheet";
import {
  SHEET_ADD,
  SHEET_ERROR,
  SHEET_GHOST,
  SHEET_LIST,
  SHEET_PAIR,
  SHEET_PAIR_BACK,
  SHEET_PAIR_MAIN,
  SHEET_PRIMARY,
  SHEET_SINGLE,
} from "@/features/subscription/components/sheetClasses";
import type { OpenedAccount } from "@/features/subscription/hooks/useCardForm";
import {
  BILLING_ACCOUNTS,
  MOVE_BLOCK_LABEL,
  MOVE_BUSY,
  MOVE_NO_COMPANIES,
  MOVE_PICK_COMPANY,
  MOVE_PICK_COMPANY_LEAD,
  NEW_BILLING_ACCOUNT,
  PAYMENT_FAILED_CHIP,
  moveTargets,
  movableCompanies,
} from "@/features/subscription/lib/billingAccounts";

/** Which billing account 08-A shows - and the way to open another. */
export function AccountPickerDialog({
  data,
  currentId,
  fixture,
  onConfirm,
  onOpened,
  onClose,
}: {
  data: BillingAccounts;
  currentId: string | null;
  fixture?: string | null;
  onConfirm: (accountId: string) => void;
  /** An account was opened here, and the payer said Done. */
  onOpened: (opened: OpenedAccount) => void;
  onClose: () => void;
}) {
  const empty = data.accounts.length === 0;
  const [picked, setPicked] = useState<string | null>(currentId);
  const [adding, setAdding] = useState(empty);
  const sheet = useNewAccountSheet(onOpened);

  if (adding || sheet.opened) {
    return (
      <SheetFrame {...newAccountFrame(sheet, onClose)}>
        {/* Cancel goes back to the list (01-D's arrow to 01-L) - or closes, with none to go to. */}
        <NewAccountStage
          sheet={sheet}
          fixture={fixture}
          onBack={empty ? onClose : () => setAdding(false)}
        />
      </SheetFrame>
    );
  }

  return (
    <SheetFrame
      size="list"
      label={BILLING_ACCOUNTS}
      title={BILLING_ACCOUNTS}
      busy={false}
      onClose={onClose}
      onDismiss={onClose}
    >
      <ul className={SHEET_LIST}>
        {data.accounts.map((account) => (
          <AccountRow
            key={account.id}
            name="billing-account"
            account={account}
            checked={picked === account.id}
            onSelect={setPicked}
          />
        ))}
      </ul>
      <button type="button" onClick={() => setAdding(true)} className={SHEET_ADD}>
        {NEW_BILLING_ACCOUNT}
      </button>
      <div className={SHEET_SINGLE}>
        <button
          type="button"
          onClick={() => picked && onConfirm(picked)}
          disabled={!picked}
          className={`${SHEET_PRIMARY} min-w-[130px]`}
        >
          Confirm
        </button>
      </div>
    </SheetFrame>
  );
}

/** "Change billing account": one company to another of the payer's accounts, or a new one. */
export function MoveCompanyDialog({
  data,
  busy,
  error,
  fixture,
  onMove,
  onOpened,
  onClose,
}: {
  data: BillingAccounts;
  busy: boolean;
  /** The API's refusal, as written. */
  error: string | null;
  fixture?: string | null;
  onMove: (entityId: string, accountId: string) => void;
  /** An account was opened for the company picked (and it moved onto it, or was refused). */
  onOpened: (opened: OpenedAccount) => void;
  onClose: () => void;
}) {
  const [entityId, setEntityId] = useState<string | null>(null);
  const [step, setStep] = useState<"company" | "account" | "form">("company");
  const [accountId, setAccountId] = useState<string | null>(null);
  const sheet = useNewAccountSheet(onOpened);

  const companies = useMemo(() => movableCompanies(data), [data]);
  const company = companies.find((c) => c.entityId === entityId) ?? null;
  const targets = useMemo(() => (company ? moveTargets(data, company) : []), [data, company]);

  if ((step === "form" || sheet.opened) && company) {
    return (
      <SheetFrame {...newAccountFrame(sheet, onClose)}>
        <NewAccountStage
          sheet={sheet}
          fixture={fixture}
          move={company.entityId}
          onBack={() => setStep("account")}
        />
      </SheetFrame>
    );
  }

  if (step === "account" && company) {
    const title = `Move ${company.entityName} to`;
    return (
      <SheetFrame
        size="list"
        label={title}
        title={title}
        busy={busy}
        onClose={onClose}
        onDismiss={onClose}
      >
        <ul className={SHEET_LIST}>
          {targets.map(({ account, block }) => (
            <AccountRow
              key={account.id}
              name="move-to"
              account={account}
              checked={accountId === account.id}
              disabled={busy || block !== null}
              onSelect={setAccountId}
              flags={
                block ? (
                  <SheetFlag
                    text={MOVE_BLOCK_LABEL[block]}
                    tone={block === "current" ? "grey" : "red"}
                  />
                ) : null
              }
            />
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setStep("form")}
          disabled={busy}
          className={SHEET_ADD}
        >
          {NEW_BILLING_ACCOUNT}
        </button>
        {error && (
          <p role="alert" className={SHEET_ERROR}>
            {error}
          </p>
        )}
        <div className={SHEET_PAIR}>
          <button
            type="button"
            onClick={() => {
              setAccountId(null);
              setStep("company");
            }}
            disabled={busy}
            className={`${SHEET_GHOST} ${SHEET_PAIR_BACK}`}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => accountId && onMove(company.entityId, accountId)}
            disabled={busy || !accountId}
            aria-busy={busy || undefined}
            className={`${SHEET_PRIMARY} ${SHEET_PAIR_MAIN}`}
          >
            {busy ? MOVE_BUSY : "Confirm"}
          </button>
        </div>
      </SheetFrame>
    );
  }

  return (
    <SheetFrame
      size="list"
      label={MOVE_PICK_COMPANY}
      title={MOVE_PICK_COMPANY}
      sub={MOVE_PICK_COMPANY_LEAD}
      busy={busy}
      onClose={onClose}
      onDismiss={onClose}
    >
      {companies.length === 0 ? (
        <p className="text-[13.5px] text-[#6b7a80]">{MOVE_NO_COMPANIES}</p>
      ) : (
        <ul className={SHEET_LIST}>
          {companies.map((row) => (
            <SheetRow
              key={row.entityId}
              name="move-company"
              value={row.entityId}
              checked={entityId === row.entityId}
              // Its debt, its retries and "Pay now" follow the account it is on: it stays.
              disabled={row.pastDue}
              onSelect={setEntityId}
              title={row.entityName}
              meta={`On ${row.accountName}`}
              flags={row.pastDue ? <SheetFlag text={PAYMENT_FAILED_CHIP} tone="red" /> : null}
            />
          ))}
        </ul>
      )}
      <div className={SHEET_PAIR}>
        <button type="button" onClick={onClose} className={`${SHEET_GHOST} ${SHEET_PAIR_BACK}`}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => setStep("account")}
          disabled={!company}
          className={`${SHEET_PRIMARY} ${SHEET_PAIR_MAIN}`}
        >
          Next
        </button>
      </div>
    </SheetFrame>
  );
}

/**
 * 08-B's "Open a billing account": the sheet straight on the form, as onboarding opens it for a
 * payer with no card - Cancel closes it, there is no list to go back to.
 */
export function NewAccountDialog({
  fixture,
  onOpened,
  onClose,
}: {
  fixture?: string | null;
  onOpened: (opened: OpenedAccount) => void;
  onClose: () => void;
}) {
  const sheet = useNewAccountSheet(onOpened);
  return (
    <SheetFrame {...newAccountFrame(sheet, onClose)}>
      <NewAccountStage sheet={sheet} fixture={fixture} onBack={onClose} />
    </SheetFrame>
  );
}
