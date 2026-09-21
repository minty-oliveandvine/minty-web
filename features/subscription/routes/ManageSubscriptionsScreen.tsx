"use client";

/**
 * The payer portal's Manage Subscriptions page, composed (Figma section 04): the banner, the
 * transfer requests, the payment-failed line when a renewal failed, the search, and the list -
 * or its empty / no-match / loading / could-not-load state. `ManageSubscriptions` reads the URL
 * and hands the parameters here; the tests render this directly with fixtures.
 */

import { env } from "@/lib/env";

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

  const onMenu = (entity: Parameters<typeof m.openRow>[0], item: MenuItem) => {
    if (item === "request_transfer") m.requestTransfer(entity);
    else if (item === "cancel_subscription") m.cancelSubscription(entity);
    else m.reactivate(entity);
  };

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
          on={{
            onOpen: m.openRow,
            onStartTrial: m.askStartTrial,
            onSubscribe: m.subscribe,
            onMenu,
          }}
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
