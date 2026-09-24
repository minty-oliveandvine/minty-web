"use client";

/**
 * "Subscription requests" - the recipient's side of a handover, composed (Figma 07-D/E/F): the
 * banner, then "No requests waiting" (07-F), the requests to pick from when several wait, the
 * one under review with its Confirm Subscription Transfer (07-D), or the card picker (07-E).
 * `SubscriptionRequests` reads the URL and hands the parameters here; the tests render this
 * directly with fixtures.
 */

import Image from "next/image";

import { PortalHero } from "@/features/subscription/components/PortalHero";
import {
  AddCardPanel,
  IncomingRequestReview,
  NoRequests,
  PaymentMethodPicker,
  RequestList,
} from "@/features/subscription/components/SubscriptionRequestsPanels";
import {
  useSubscriptionRequests,
  type UseSubscriptionRequestsArgs,
} from "@/features/subscription/hooks/useSubscriptionRequests";

export function SubscriptionRequestsScreen(args: UseSubscriptionRequestsArgs) {
  const r = useSubscriptionRequests(args);
  const reviewing = r.reviewed && r.step === "review";
  const picking = r.reviewed && r.step !== "review";
  const title = reviewing
    ? "Transfer Subscription - Choose Modules"
    : picking
      ? "Transfer Subscription"
      : "Subscription requests";

  return (
    <div className="flex flex-col gap-8 pb-16">
      <PortalHero title={title} />

      {r.status === "error" && (
        <div
          role="alert"
          className="flex items-center gap-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
        >
          <p>{r.error}</p>
          <button type="button" onClick={r.reload} className="font-bold">
            Try again
          </button>
        </div>
      )}
      {r.status === "loading" && (
        <div className="h-[132px] animate-pulse rounded-xl bg-[#f7f9fa]" role="status">
          <span className="sr-only">Loading…</span>
        </div>
      )}

      {r.status === "ready" && r.requests.length === 0 && <NoRequests onBack={r.backToList} />}

      {r.status === "ready" && r.requests.length > 1 && !r.reviewed && (
        <RequestList requests={r.requests} onReview={r.review} />
      )}

      {r.status === "ready" && r.reviewed && (
        <section className="flex flex-col gap-6 rounded-xl bg-white px-8 pb-8 pt-10 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.1)]">
          {picking ? (
            <>
              <h2 className="text-[25px] font-bold text-black">{r.reviewed.row.entity_name}</h2>
              <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex justify-center">
                  {r.step === "add-card" ? (
                    <AddCardPanel
                      setup={r.setup}
                      onSaved={r.cardSaved}
                      onCancel={r.cancelAddCard}
                    />
                  ) : (
                    <PaymentMethodPicker
                      cards={r.reviewed.cards}
                      cardId={r.reviewed.cardId}
                      busy={r.busy}
                      actionError={r.actionError}
                      onPick={r.pickCard}
                      onAdd={r.addCard}
                      onConfirm={() => void r.confirmCard()}
                    />
                  )}
                </div>
                <Image
                  src="/portal/minty-lemon-handoff.png"
                  alt=""
                  width={433}
                  height={270}
                  unoptimized
                  className="justify-self-center lg:mt-16"
                />
              </div>
            </>
          ) : (
            <IncomingRequestReview
              reviewed={r.reviewed}
              busy={r.busy}
              actionError={r.actionError}
              onChangeCard={r.changeCard}
              onToggleModule={r.toggleModule}
              onAccept={() => void r.accept()}
              onDecline={() => void r.decline()}
            />
          )}
        </section>
      )}
    </div>
  );
}
