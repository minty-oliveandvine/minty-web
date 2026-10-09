"use client";

/**
 * "Subscription requests" - the recipient's side of a handover, composed (Figma 07-D/E/F): the
 * banner, then "No requests waiting" (07-F), the requests to pick from when several wait, the
 * one under review with its Confirm Subscription Transfer (07-D), or the billing-account picker
 * (07-E) - with the billing-account sheet over it while a new account is opened. The
 * `SubscriptionRequests` reads the URL and hands the parameters here; the tests render this
 * directly with fixtures.
 */

import Image from "next/image";

import { NewAccountDialog } from "@/features/subscription/components/BillingAccountDialogs";
import { PortalHero } from "@/features/subscription/components/PortalHero";
import {
  IncomingRequestReview,
  NoRequests,
  RequestList,
  TransferAccountPicker,
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
    <div data-portal-col="960" className="mx-auto flex w-full max-w-[960px] flex-col gap-8 pb-16">
      <PortalHero title={title} />

      {r.status === "error" && (
        <div
          role="alert"
          className="flex items-center gap-4 rounded-xl border border-transparent bg-danger-bg px-4 py-3 text-body-m text-danger"
        >
          <p>{r.error}</p>
          <button type="button" onClick={r.reload} className="min-h-11 px-2 font-semibold underline">
            Try again
          </button>
        </div>
      )}
      {r.status === "loading" && (
        <div className="h-[132px] animate-pulse rounded-xl bg-sunk" role="status">
          <span className="sr-only">Loading…</span>
        </div>
      )}

      {r.status === "ready" && r.requests.length === 0 && <NoRequests onBack={r.backToList} />}

      {r.status === "ready" && r.requests.length > 1 && !r.reviewed && (
        <RequestList requests={r.requests} onReview={r.review} />
      )}

      {r.status === "ready" && r.reviewed && (
        <section className="flex flex-col gap-6 rounded-xl border border-line bg-card p-4 sm:p-5">
          {picking ? (
            <>
              <h2 className="text-display-m font-bold text-ink">{r.reviewed.row.entity_name}</h2>
              <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex justify-center">
                  <TransferAccountPicker
                    targets={r.reviewed.targets}
                    accountId={r.reviewed.accountId}
                    busy={r.busy}
                    actionError={r.actionError}
                    onPick={r.pickAccount}
                    onAdd={r.addAccount}
                    onConfirm={r.confirmAccount}
                  />
                </div>
                <Image
                  src="/portal/minty-lemon-handoff.png"
                  alt=""
                  width={433}
                  height={270}
                  unoptimized
                  className="h-auto w-[260px] justify-self-center lg:mt-16 lg:w-[300px]"
                />
              </div>
            </>
          ) : (
            <IncomingRequestReview
              reviewed={r.reviewed}
              busy={r.busy}
              actionError={r.actionError}
              onChangeCard={r.chooseAccount}
              onToggleModule={r.toggleModule}
              onAccept={() => void r.accept()}
              onDecline={() => void r.decline()}
            />
          )}
        </section>
      )}

      {r.addingAccount && (
        <NewAccountDialog
          fixture={args.fixture}
          onOpened={r.accountOpened}
          onClose={r.cancelAddAccount}
        />
      )}
    </div>
  );
}
