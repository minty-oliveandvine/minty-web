import Link from "next/link";

import { PORTAL } from "@/features/subscription/lib/paths";

/**
 * The index - three doors. Part 2 step 4 replaces it with the ported ManageSubscriptions
 * screen; until then it is what the landing forwards to and what the e2e spec asserts.
 */
export function SubscriptionIndex() {
  return (
    <section>
      <h1 className="text-xl font-semibold">Your subscriptions</h1>
      <p className="mt-1 text-sm text-muted">
        Manage the companies you pay for, your cards and your invoices.
      </p>
      <ul className="mt-6 flex flex-col gap-2">
        <li>
          <Link className="underline" href={PORTAL.subscriptions}>
            Subscriptions
          </Link>
          <span className="text-muted"> · the companies you pay for, and who pays for them</span>
        </li>
        <li>
          <Link className="underline" href={PORTAL.billing}>
            Billing
          </Link>
          <span className="text-muted"> · your billing accounts and saved cards</span>
        </li>
        <li>
          <Link className="underline" href={PORTAL.invoices}>
            Invoices
          </Link>
          <span className="text-muted"> · every invoice, newest first</span>
        </li>
      </ul>
    </section>
  );
}
