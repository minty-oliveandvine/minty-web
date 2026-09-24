"use client";

/**
 * "Transfer Subscription" - the payer's side of a handover, composed (Figma 07-A/B/C/K): the
 * banner, the company, then one of three - the picker beside Minty and Lemon (07-A), the
 * request already waiting beside Minty with a clock (07-C), or "Transfer requested" (07-B) -
 * and the footer sentence. Withdrawing asks nothing and tells with 07-K's modal. `TransferSubscription`
 * reads the URL and hands the parameters here; the tests render this directly with fixtures.
 */

import Image from "next/image";

import { PortalHero } from "@/features/subscription/components/PortalHero";
import { TransferOutcomeDialog } from "@/features/subscription/components/TransferOutcomeDialog";
import {
  PendingRequestPanel,
  ResponsibilityNote,
  SubscriberPicker,
  TransferRequested,
} from "@/features/subscription/components/TransferSubscriptionPanels";
import {
  useTransferSubscription,
  type UseTransferSubscriptionArgs,
} from "@/features/subscription/hooks/useTransferSubscription";

export function TransferSubscriptionScreen(args: UseTransferSubscriptionArgs) {
  const t = useTransferSubscription(args);

  return (
    <div className="flex flex-col gap-8 pb-16">
      <PortalHero title="Transfer Subscription" />

      <section className="flex flex-col gap-6 rounded-xl bg-white px-8 pb-8 pt-10 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]">
        {t.status === "error" ? (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
          >
            {t.error}
          </div>
        ) : t.requested ? (
          <>
            <h2 className="text-[25px] font-bold text-black">{t.entityName}</h2>
            <TransferRequested
              email={t.requested.email}
              note={t.note}
              entityName={t.entityName}
              onBack={t.backToRow}
            />
          </>
        ) : (
          <>
            <h2 className="text-[25px] font-bold text-black">
              {t.status === "loading" ? "Loading…" : t.entityName}
            </h2>
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
              {t.pending ? (
                <PendingRequestPanel
                  recipient={t.pending}
                  busy={t.busy}
                  sendError={t.sendError}
                  onBack={t.backToRow}
                  onWithdraw={() => void t.withdraw()}
                />
              ) : (
                <SubscriberPicker
                  candidates={t.candidates}
                  selected={t.selected}
                  blockers={t.blockers}
                  invite={t.invite}
                  inviting={t.inviting}
                  inviteError={t.inviteError}
                  invited={t.invited}
                  busy={t.busy}
                  canRequest={t.canRequest}
                  sendError={t.sendError}
                  loading={t.status === "loading"}
                  on={{
                    onSelect: t.select,
                    onInviteChange: t.setInvite,
                    onSendInvite: () => void t.sendInvite(),
                    onCancel: t.backToRow,
                    onRequest: () => void t.request(),
                  }}
                />
              )}
              <Image
                src={t.pending ? "/portal/minty-clock.png" : "/portal/minty-lemon-handoff.png"}
                alt=""
                width={t.pending ? 330 : 433}
                height={t.pending ? 277 : 270}
                unoptimized
                className="justify-self-center lg:mt-16"
              />
            </div>
            {!t.pending && t.status === "ready" && (
              <ResponsibilityNote note={t.note} entityName={t.entityName} />
            )}
          </>
        )}
      </section>

      {t.withdrawn && (
        <TransferOutcomeDialog
          outcome="withdrawn"
          entityName={t.entityName}
          onDone={t.dismissWithdrawn}
        />
      )}
    </div>
  );
}
