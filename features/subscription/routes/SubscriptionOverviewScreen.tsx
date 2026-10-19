"use client";

/**
 * "Subscription & Billing" - the portal's landing, composed (Figma 08-A as a Decision dashboard,
 * Part 15.6b, 2026-10-19; a 1200px column): the way back into Minty (in the header bar,
 * `PortalBack`), the position header (the shown account's next bill, who it is billed to and
 * Manage Subscription), a Page banner per thing that needs the payer, then the modules and -
 * side by side from `md` - the payment method and the invoices; and the two account dialogs the
 * header opens - which account to show, and "Change billing account" - each
 * of which can open a new account in place (onboarding's sheet, `BillingAccountDialogs`).
 * `SubscriptionOverview` reads the URL and hands the parameters here; the tests render this
 * directly with fixtures.
 *
 * The way back goes to the COMPANY this browser is scoped to, not to Minty's entity picker: a
 * person here from a company's module settings goes back through `/entity/<id>/modules`, to its
 * module selection - or straight into the module, when only one is on (Minty routes it). A
 * result's Back to Manage Subscriptions lands here UNSCOPED (it trades the company's token for
 * the payer's), and then the way back is Minty's entity list.
 */

import { useSyncExternalStore } from "react";

import { getAuth } from "@/lib/auth";
import { mintyModulesUrl } from "@/lib/mintyEntry";

import {
  AccountPickerDialog,
  MoveCompanyDialog,
} from "@/features/subscription/components/BillingAccountDialogs";
import {
  AttentionBanners,
  InvoicesSection,
  ModulesSection,
  PaymentMethodSection,
  PositionHeader,
} from "@/features/subscription/components/BillingOverviewPanels";
import { BACK_LINE_CLASS, PortalBack } from "@/features/subscription/components/PortalBack";
import { TransferOutcomeDialog } from "@/features/subscription/components/TransferOutcomeDialog";
import {
  useBillingOverview,
  type UseBillingOverviewArgs,
} from "@/features/subscription/hooks/useBillingOverview";
import { BACK_TO_ENTITIES } from "@/features/subscription/lib/billing";
import { BILLING } from "@/features/subscription/lib/paths";

// A primitive, not the auth object: a fresh object per read makes the store loop (PortalChrome).
const noSubscribe = () => () => {};
const readEntityId = () => getAuth()?.entityId ?? "";
const serverEmpty = () => "";

export function SubscriptionOverviewScreen(args: UseBillingOverviewArgs) {
  const o = useBillingOverview(args);
  const entityId = useSyncExternalStore(noSubscribe, readEntityId, serverEmpty);

  return (
    <div
      className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 pb-16"
      data-portal-col="1200"
      aria-busy={o.status === "loading"}
    >
      <PortalBack>
        <a href={mintyModulesUrl(entityId)} className={BACK_LINE_CLASS}>
          {BACK_TO_ENTITIES}
        </a>
      </PortalBack>
      <PositionHeader
        next={o.next}
        pill={o.status === "ready" ? o.pill : null}
        accountsFailed={o.accountsFailed}
        notice={o.notice}
        ready={o.status === "ready"}
        onPick={o.openPicker}
        onMove={o.openMove}
        onRetry={o.reload}
        onManage={o.manageSubscriptions}
      />

      {o.status === "error" ? (
        <div
          role="alert"
          className="flex w-full flex-col items-start gap-3 rounded-lg border border-transparent bg-danger-bg px-4 py-3 text-body-m text-danger"
        >
          {o.error}
          <button
            type="button"
            onClick={o.reload}
            className="h-11 rounded-lg border border-line-selected bg-card px-4 text-body-m font-semibold text-link hover:bg-selected"
          >
            Try again
          </button>
        </div>
      ) : (
        o.status === "ready" && (
          <>
            <AttentionBanners items={o.attention} onAction={o.go} />
            <ModulesSection
              rows={o.modules}
              overview={o.overview}
              updatesExpanded={o.updatesExpanded}
              onToggleUpdates={o.toggleUpdates}
            />
            <div className="grid w-full gap-8 md:grid-cols-2 md:gap-6">
              <PaymentMethodSection
                account={o.account}
                hasAccounts={Boolean(o.accounts && o.accounts.accounts.length > 0)}
                accountsFailed={o.accountsFailed}
                onOpenAccount={o.openPicker}
                onAdd={(accountId) => o.go(BILLING.add(accountId))}
                onOpen={o.goToBilling}
              />
              <InvoicesSection invoices={o.invoices} onRetry={o.retryInvoices} onOpen={o.goToBilling} />
            </div>
          </>
        )
      )}

      {/* Siblings of the header, never inside it: a click in a dialog would otherwise bubble to
          the header's own click and open the picker under the dialog. */}
      {o.picking && o.accounts && (
        <AccountPickerDialog
          data={o.accounts}
          currentId={o.account?.id ?? null}
          fixture={args.fixture}
          onConfirm={o.confirmPick}
          onOpened={o.accountOpened}
          onClose={o.closePicker}
        />
      )}
      {o.moving && o.accounts && (
        <MoveCompanyDialog
          data={o.accounts}
          busy={o.moveBusy}
          error={o.moveError}
          fixture={args.fixture}
          onMove={o.moveCompany}
          onOpened={o.accountOpened}
          onClose={o.closeMove}
        />
      )}

      {/* 07-I / A-07 (declined), A-08 (expired), 07-L (accepted) - all drawn OVER this page.
          The first modal on the landing, and it belongs here rather than on the transfer
          screen: that is where the design puts it, and it is the page the payer comes back
          to. Done marks it seen on the server, so it never opens again on any device. */}
      {o.outcome && (
        <TransferOutcomeDialog
          outcome={o.outcome.status}
          entityName={o.outcome.entity_name}
          who={o.outcome.who || null}
          onDone={o.dismissOutcome}
          onClose={o.closeOutcome}
        />
      )}
    </div>
  );
}
