"use client";

/**
 * "Manage billing details and Payment Methods" - one billing account's page, composed (Figma
 * 08-B and its states): the banner, the account's next bill and who it is addressed to (with
 * the way to 08-C), the expired-card line when there is one (08-I), its cards with their menus
 * (08-W/08-X, 08-H when there are none, 08-J expanded), its invoices, and the two things a card
 * can ask - it has just been added (08-N/08-S) or it is being removed (08-R). A payer with no
 * account at all is offered one instead, opened in onboarding's sheet (`NewAccountDialog`).
 * `BillingPage` reads the URL and hands the parameters here; the tests render this directly with
 * fixtures.
 */

import { NewAccountDialog } from "@/features/subscription/components/BillingAccountDialogs";
import { PortalHero } from "@/features/subscription/components/PortalHero";
import {
  ExpiredCardNotice,
  InvoiceHistoryTable,
  NextBillingCard,
  NoAccountPanel,
  PaymentMethodsPanel,
} from "@/features/subscription/components/BillingPanels";
import { CardAddedDialog, RemoveCardDialog } from "@/features/subscription/components/CardDialogs";
import {
  useBillingPage,
  type UseBillingPageArgs,
} from "@/features/subscription/hooks/useBillingPage";
import { BILLING_TITLE } from "@/features/subscription/lib/billing";

export function BillingPageScreen(args: UseBillingPageArgs) {
  const b = useBillingPage(args);

  return (
    <div className="flex flex-col gap-8 pb-16">
      <PortalHero title={BILLING_TITLE} onBack={b.back} />

      {b.status === "error" ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {b.error}
          <button
            type="button"
            onClick={b.reload}
            className="rounded-lg border border-rose-300 bg-white px-4 py-1.5 font-semibold"
          >
            Try again
          </button>
        </div>
      ) : b.status === "ready" && !b.account ? (
        <div className="mx-auto flex w-full max-w-[942px] flex-col gap-8">
          <NoAccountPanel onOpen={b.openAccount} />
        </div>
      ) : (
        // The design's blocks sit in a 942px column inside the banner's 1298px one.
        <div className="mx-auto flex w-full max-w-[942px] flex-col gap-8">
          <NextBillingCard
            next={b.next}
            onChangeDetails={b.account ? b.changeDetails : undefined}
          />
          {b.expired && <ExpiredCardNotice text={b.expired} onAdd={b.addCard} />}
          <PaymentMethodsPanel
            rows={b.rows}
            shown={b.shown}
            expanded={b.expanded}
            showMore={b.showMore}
            busy={b.busy || b.status === "loading"}
            actionError={b.actionError}
            menuFor={b.menuFor}
            onMenu={b.onMenu}
            onToggle={b.toggleExpanded}
            onAdd={b.addCard}
          />
          <InvoiceHistoryTable
            invoices={b.invoices}
            amountHeader={b.invoiceHeader}
            paging={b.invoicePaging}
            onPage={b.goToInvoicePage}
            onPerPage={b.setInvoicesPerPage}
            onBreakdown={(invoiceId) => void b.downloadBreakdown(invoiceId)}
            breakdownBusy={b.breakdownBusy}
            breakdownError={b.breakdownError}
          />
        </div>
      )}

      {b.added && (
        <CardAddedDialog
          added={b.added}
          busy={b.busy}
          onSetDefault={b.makeAddedDefault}
          onDone={b.dismissAdded}
        />
      )}
      {b.prompt && (
        <RemoveCardDialog
          prompt={b.prompt}
          busy={b.busy}
          error={b.actionError}
          onConfirm={b.confirmRemove}
          onBack={b.dismissPrompt}
        />
      )}
      {b.opening && (
        <NewAccountDialog
          fixture={args.fixture}
          onOpened={b.accountOpened}
          onClose={b.closeOpening}
        />
      )}
    </div>
  );
}
