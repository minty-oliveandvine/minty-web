"use client";

/**
 * The payer portal's Manage Subscriptions page, composed (Figma section 04): the banner, the
 * transfer requests, the payment-failed line when a renewal failed, the search, and the list -
 * or its empty / no-match / loading / could-not-load state. A change being confirmed asks in
 * its modal (Figma section 06); a change that just landed shows its result (05·C): in the list,
 * as that company's row, or - a cancellation - as the whole page, the banner retitled.
 * `ManageSubscriptions` reads the URL and hands the parameters here; the tests render this
 * directly with fixtures.
 */

import { env } from "@/lib/env";

import { ChangeDialog } from "@/features/subscription/components/ChangeDialog";
import { ChangeResultPage } from "@/features/subscription/components/ChangeResultView";
import {
  ListEmpty,
  ListError,
  ListNoMatch,
  ListSkeleton,
} from "@/features/subscription/components/ListStates";
import { PaymentFailedBanner } from "@/features/subscription/components/PaymentFailedBanner";
import { PortalHero } from "@/features/subscription/components/PortalHero";
import { SearchField } from "@/features/subscription/components/SearchField";
import { StartTrialDialog } from "@/features/subscription/components/StartTrialDialog";
import { SubscriptionsTable } from "@/features/subscription/components/SubscriptionsTable";
import { TransferRequestCard } from "@/features/subscription/components/TransferRequestCard";
import {
  useSubscriptionsList,
  type UseSubscriptionsListArgs,
} from "@/features/subscription/hooks/useSubscriptionsList";
import type { MenuItem } from "@/features/subscription/lib/portalRows";

export function ManageSubscriptionsScreen(args: UseSubscriptionsListArgs) {
  const m = useSubscriptionsList(args);
  const nothingShown = m.active.length === 0 && m.suspended.length === 0;

  const onMenu = (entity: Parameters<typeof m.toggleRow>[0], item: MenuItem) => {
    if (item === "request_transfer") m.requestTransfer(entity);
    else if (item === "cancel_subscription") m.cancelSubscription(entity);
    else m.reactivate(entity);
  };

  if (m.result && m.result.result.layout === "page") {
    const { entity, result } = m.result;
    const row = [...m.active, ...m.suspended].find((r) => r.entity.entity_id === entity.entity_id);
    return (
      <div className="flex flex-col gap-8 pb-16">
        <PortalHero title={result.hero ?? "Manage Subscriptions"} />
        <ChangeResultPage
          entity={entity}
          result={result}
          menu={row?.menu ?? []}
          onMenu={(item) => onMenu(entity, item)}
          onBack={m.dismissResult}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-16">
      <PortalHero title="Manage Subscriptions" onBack={m.back} />

      {m.transfers.length > 0 && (
        <section aria-label="Transfer requests" className="flex flex-col gap-4">
          <h2 className="px-3 text-[25px] font-bold text-ink">Transfer Request Received</h2>
          {m.transfers.map((t) => (
            <TransferRequestCard key={t.id} transfer={t} onReview={m.reviewTransfer} />
          ))}
        </section>
      )}

      {m.paymentFailed && <PaymentFailedBanner onUpdatePaymentMethod={m.updatePaymentMethod} />}

      {m.status !== "error" && m.hasEntities && (
        <SearchField value={m.searchInput} onChange={m.setSearchInput} />
      )}

      {m.status === "loading" && <ListSkeleton />}
      {m.status === "error" && <ListError message={m.error ?? ""} onRetry={m.reload} />}
      {m.status === "ready" && !m.hasEntities && (
        <ListEmpty entityListHref={`${env.MINTY_URL}/entity`} />
      )}
      {m.status === "ready" && m.hasEntities && nothingShown && <ListNoMatch />}
      {m.status === "ready" && !nothingShown && (
        <SubscriptionsTable
          active={m.active}
          suspended={m.suspended}
          sort={m.sort}
          onToggleSort={m.toggleSort}
          focusEntityId={m.focusEntityId}
          open={
            m.openEntityId && m.summary.status !== "idle"
              ? {
                  entityId: m.openEntityId,
                  status: m.summary.status,
                  view: m.summary.view,
                  error: m.summary.error,
                }
              : null
          }
          result={
            m.result ? { entityId: m.result.entity.entity_id, result: m.result.result } : null
          }
          on={{
            onToggle: m.toggleRow,
            onStartTrial: m.askStartTrial,
            onSubscribe: m.subscribe,
            onMenu,
            onTick: (_entity, code) => m.summary.toggleTick(code),
            onConfirmChange: m.confirmChange,
            onChangePaymentMethod: m.changePaymentMethod,
            onRetrySummary: m.summary.reload,
            onResultBack: m.dismissResult,
          }}
        />
      )}

      {m.changePrompt && (
        <ChangeDialog
          modal={m.changePrompt.modal}
          entityName={m.changePrompt.entity.entity_name}
          busy={m.changeBusy}
          onConfirm={() => void m.applyChangePrompt()}
          onBack={m.dismissChangePrompt}
        />
      )}

      {m.trialPrompt && (
        <StartTrialDialog
          entityName={m.trialPrompt.entity.entity_name}
          code={m.trialPrompt.code}
          moduleName={m.trialPrompt.moduleName}
          busy={m.trialBusy}
          onConfirm={() => void m.confirmStartTrial()}
          onBack={m.dismissTrialPrompt}
        />
      )}
    </div>
  );
}
